import asyncio
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from .redis_client import get_redis_client
from .game_engine import GameSession
from .models import Match, User, Achievement, Report
from .config import settings
from .database import async_session_maker
from groq import Groq

GAME_PREFIX = "game:"
PUB_SUB_PREFIX = "game_channel:"

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}
        # Maps user_id -> game_id (for current active game)
        self.user_to_game: Dict[int, str] = {}
        # Matches in-memory tasks for listening to redis pubsub
        self.pubsub_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    async def disconnect(self, user_id: int, websocket: WebSocket, db: AsyncSession):
        if self.active_connections.get(user_id) == websocket:
            del self.active_connections[user_id]

            # Handle game disconnection logic
            game_id = self.user_to_game.get(user_id)
            if game_id:
                redis = get_redis_client()
                game_data = await redis.get(f"{GAME_PREFIX}{game_id}")
                if game_data:
                    game_state = json.loads(game_data)
                    session = GameSession.from_json(game_state)
                    session.handle_disconnect(user_id)
                    await redis.set(f"{GAME_PREFIX}{game_id}", json.dumps(session.to_json()))
                    await self.publish_game_update(game_id)

    async def notify_user(self, user_id: int, event_type: str, data: dict = None):
        """Send a typed notification to a single connected user."""
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                payload = {"type": event_type}
                if data:
                    payload.update(data)
                await ws.send_json(payload)
            except Exception:
                pass

    async def broadcast(self, event_type: str, data: dict = None):
        """Send a typed notification to ALL connected users."""
        payload = {"type": event_type}
        if data:
            payload.update(data)
        dead = []
        for uid, ws in self.active_connections.items():
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.active_connections.pop(uid, None)

    async def register_player_to_game(self, user_id: int, game_id: str):
        self.user_to_game[user_id] = game_id
        # Start listening to pubsub if not already doing so
        await self.subscribe_to_game_channel(game_id)

    async def subscribe_to_game_channel(self, game_id: str):
        if game_id in self.pubsub_tasks:
            return

        # Start background listener task for Redis pubsub updates
        task = asyncio.create_task(self._redis_pubsub_listener(game_id))
        self.pubsub_tasks[game_id] = task

    async def publish_game_update(self, game_id: str):
        redis = get_redis_client()
        await redis.publish(f"{PUB_SUB_PREFIX}{game_id}", json.dumps({"type": "state_update", "game_id": game_id}))

    async def publish_chat_message(self, game_id: str, sender_phone: str, text: str):
        redis = get_redis_client()
        msg = {
            "type": "chat",
            "sender": sender_phone,
            "text": text,
            "timestamp": time.time()
        }
        await redis.publish(f"{PUB_SUB_PREFIX}{game_id}", json.dumps(msg))

    async def _redis_pubsub_listener(self, game_id: str):
        redis = get_redis_client()
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"{PUB_SUB_PREFIX}{game_id}")
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    if data["type"] == "state_update":
                        await self._send_game_state_to_local_players(game_id)
                    elif data["type"] == "chat":
                        await self._send_chat_message_to_local_players(game_id, data)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(f"{PUB_SUB_PREFIX}{game_id}")

    async def _send_game_state_to_local_players(self, game_id: str):
        redis = get_redis_client()
        game_data = await redis.get(f"{GAME_PREFIX}{game_id}")
        if not game_data:
            return

        game_state = json.loads(game_data)
        session = GameSession.from_json(game_state)

        # For every player in the game, if they are connected locally, send their view of the game state
        for p in session.players:
            p_id = p["id"]
            if p_id in self.active_connections:
                ws = self.active_connections[p_id]
                player_view = session.get_player_view(p_id)
                try:
                    await ws.send_json({
                        "type": "game_state",
                        "data": player_view
                    })
                except Exception:
                    # Connection might be dead, handled by disconnect
                    pass

    async def _send_chat_message_to_local_players(self, game_id: str, chat_data: dict):
        redis = get_redis_client()
        game_data = await redis.get(f"{GAME_PREFIX}{game_id}")
        if not game_data:
            return

        game_state = json.loads(game_data)
        session = GameSession.from_json(game_state)

        # Send chat message to all connected players in this game
        for p in session.players:
            p_id = p["id"]
            if p_id in self.active_connections:
                ws = self.active_connections[p_id]
                try:
                    await ws.send_json({
                        "type": "chat",
                        "sender": chat_data["sender"],
                        "text": chat_data["text"],
                        "timestamp": chat_data["timestamp"]
                    })
                except Exception:
                    pass

    async def handle_game_action(self, user_id: int, payload: dict, db: AsyncSession):
        game_id = self.user_to_game.get(user_id)
        if not game_id:
            return

        redis = get_redis_client()
        # Acquire game lock to prevent concurrent state modifications
        lock_key = f"lock:game:{game_id}"
        acquired = await redis.set(lock_key, "1", nx=True, ex=5)
        if not acquired:
            # Retry a few times or yield
            for _ in range(5):
                await asyncio.sleep(0.1)
                acquired = await redis.set(lock_key, "1", nx=True, ex=5)
                if acquired:
                    break
            if not acquired:
                return  # Could not acquire lock

        try:
            game_data = await redis.get(f"{GAME_PREFIX}{game_id}")
            if not game_data:
                return

            game_state = json.loads(game_data)
            session = GameSession.from_json(game_state)

            action = payload.get("action")
            user_phone = next((p["phone"] for p in session.players if p["id"] == user_id), "Player")

            if action == "get_game_state":
                player_view = session.get_player_view(user_id)
                if user_id in self.active_connections:
                    try:
                        await self.active_connections[user_id].send_json({
                            "type": "game_state",
                            "data": player_view
                        })
                    except Exception:
                        pass
                return

            if action == "play_card":
                card_id = payload.get("card_id")
                wild_color = payload.get("wild_color")
                session.play_card(user_id, card_id, wild_color)

            elif action == "draw_card":
                session.draw_card(user_id)

            elif action == "pass":
                session.pass_turn(user_id)

            elif action == "yell_one_left":
                session.yell_one_left_action(user_id)

            elif action == "catch_player":
                target_id = payload.get("target_id")
                session.catch_player(user_id, target_id)

            elif action == "quit_game":
                # Mark the quitting player inactive
                for p in session.players:
                    if p["id"] == user_id:
                        p["is_active"] = False
                        break

                # Remove their routing mapping
                if user_id in self.user_to_game:
                    del self.user_to_game[user_id]

                # End the game immediately — a player ran away!
                # Remaining active player (if any) is awarded the win as a forfeit.
                remaining = [p for p in session.players if p["id"] != user_id]
                session.game_over = True
                session.status = "ended"
                session.winner_id = remaining[0]["id"] if remaining else None
                session.system_messages.append(f"🏃 {user_phone} ran away from the game!")
                session.system_messages.append("__PLAYER_RAN_AWAY__")  # sentinel for frontend popup

                # Save the final state
                await redis.set(f"{GAME_PREFIX}{game_id}", json.dumps(session.to_json()))

                # Finalize the match in Postgres so history/leaderboard/achievements stay in sync
                stmt = select(Match).filter(Match.game_id == game_id)
                res = await db.execute(stmt)
                db_match = res.scalars().first()
                if db_match:
                    db_match.winner_id = session.winner_id
                    db_match.ended_at = datetime.utcnow()
                    await db.commit()

                await self._check_achievements(session, db)
                await self._flag_suspicious_pairs(session, db)

                # Send confirmation to the quitting player first (they leave immediately)
                if user_id in self.active_connections:
                    try:
                        await self.active_connections[user_id].send_json({"type": "quit_ack"})
                    except Exception:
                        pass

                # Broadcast final state to remaining players
                await self.publish_game_update(game_id)
                await self._send_game_state_to_local_players(game_id)
                return

            elif action == "send_chat":
                chat_text = payload.get("message")
                await self.publish_chat_message(game_id, user_phone, chat_text)
                
                # Launch async monitoring task
                asyncio.create_task(self._classify_chat_message(user_id, chat_text, game_id))
                
                return  # Chat publish handles websocket push, no state update needed

            # Save state
            await redis.set(f"{GAME_PREFIX}{game_id}", json.dumps(session.to_json()))


            # Check if match ended and save to Postgres
            if session.game_over:
                stmt = select(Match).filter(Match.game_id == game_id)
                res = await db.execute(stmt)
                db_match = res.scalars().first()
                if db_match:
                    db_match.winner_id = session.winner_id
                    db_match.ended_at = datetime.utcnow()
                    await db.commit()

                # Trigger achievement checks for human players
                await self._check_achievements(session, db)

                # Suspicious pattern check
                await self._flag_suspicious_pairs(session, db)

            # Publish state update
            await self.publish_game_update(game_id)

        except Exception as e:
            # Send error back to player
            if user_id in self.active_connections:
                ws = self.active_connections[user_id]
                try:
                    await ws.send_json({
                        "type": "error",
                        "message": str(e)
                    })
                except Exception:
                    pass
        finally:
            await redis.delete(lock_key)

    async def initialize_matchmaking_game(self, game_id: str, matched_players: List[Dict[str, Any]], db: AsyncSession, mode: str = "classic"):
        # Create game session with mode
        session = GameSession(game_id, matched_players, mode=mode)

        # Save to Redis
        redis = get_redis_client()
        await redis.set(f"{GAME_PREFIX}{game_id}", json.dumps(session.to_json()))

        # Save Match placeholder in database
        db_match = Match(
            game_id=game_id,
            mode=mode,
            players=matched_players,
            winner_id=None
        )
        db.add(db_match)
        await db.commit()

        # Update routes for each user and notify them
        for p in matched_players:
            p_id = p["id"]
            await self.register_player_to_game(p_id, game_id)
            if p_id in self.active_connections:
                ws = self.active_connections[p_id]
                try:
                    await ws.send_json({
                        "type": "match_found",
                        "game_id": game_id,
                        "mode": mode
                    })
                except Exception:
                    pass

        # Publish initial game state
        await self.publish_game_update(game_id)
        # Directly send to local connections to avoid pubsub subscription race condition
        await self._send_game_state_to_local_players(game_id)

    async def run_timeout_check_loop(self, db_factory):
        """
        Background loop to check for turn timeouts (AFK) and disconnect grace periods.
        """
        while True:
            try:
                redis = get_redis_client()
                # Scan all active games
                keys = await redis.keys(f"{GAME_PREFIX}*")
                for key in keys:
                    game_id = key.split(":")[1]
                    game_data = await redis.get(key)
                    if not game_data:
                        continue

                    game_state = json.loads(game_data)
                    session = GameSession.from_json(game_state)

                    if not session.game_over:
                        forfeited_users = session.check_timeouts()
                        
                        if forfeited_users or session.game_over:
                            # Save state
                            await redis.set(key, json.dumps(session.to_json()))
                            
                            # If game over, save winner to Postgres database
                            if session.game_over:
                                async for db in db_factory():
                                    stmt = select(Match).filter(Match.game_id == game_id)
                                    res = await db.execute(stmt)
                                    db_match = res.scalars().first()
                                    if db_match:
                                        db_match.winner_id = session.winner_id
                                        from datetime import datetime
                                        db_match.ended_at = datetime.utcnow()
                                        await db.commit()
                                    break
                            
                            await self.publish_game_update(game_id)
                        
                        # Check bot turn
                        current_player = session.players[session.current_turn_index]
                        if current_player.get("is_bot") and not session.game_over:
                            # 1.5s to 3s realistic delay
                            import random
                            delay_target = 1.5 + (random.random() * 1.5)
                            if time.time() - session.last_action_timestamp > delay_target:
                                action_data = session.calculate_bot_move(current_player["id"])
                                asyncio.create_task(self._run_bot_action(game_id, current_player["id"], action_data, db_factory))

            except Exception as e:
                print(f"Error in timeout loop: {e}")
                
            await asyncio.sleep(1.0) # Run faster for bot checks

    async def _run_bot_action(self, game_id: str, bot_id: int, action_data: dict, db_factory):
        async for db in db_factory():
            self.user_to_game[bot_id] = game_id
            await self.handle_game_action(bot_id, action_data, db)
            break

    async def _check_achievements(self, session: GameSession, db: AsyncSession):
        """Check and unlock achievements for all human players in a finished game."""
        ACHIEVEMENTS = {
            "first_win": "First Win",
            "played_10": "Played 10 Matches",
            "streak_5": "5 Win Streak",
            "poker_master_5": "Poker Fusion Master",
        }

        for p in session.players:
            if p.get("is_bot"):
                continue
            user_id = p["id"]
            if user_id < 0:
                continue

            try:
                # Get existing achievements
                stmt = select(Achievement).filter(Achievement.user_id == user_id)
                res = await db.execute(stmt)
                unlocked = {a.achievement_key for a in res.scalars().all()}

                # Count user matches
                all_matches_stmt = select(Match).order_by(Match.created_at.desc())
                all_res = await db.execute(all_matches_stmt)
                all_matches = all_res.scalars().all()
                user_matches = [m for m in all_matches if any(pl["id"] == user_id for pl in (m.players or []))]
                user_wins = [m for m in user_matches if m.winner_id == user_id]

                to_unlock = []

                # First Win
                if "first_win" not in unlocked and session.winner_id == user_id:
                    to_unlock.append("first_win")

                # Played 10 Matches
                if "played_10" not in unlocked and len(user_matches) >= 10:
                    to_unlock.append("played_10")

                # 5 Win Streak: check last 5 matches
                if "streak_5" not in unlocked and len(user_wins) >= 5:
                    last_5 = [m for m in user_matches[:5] if m.winner_id == user_id]
                    if len(last_5) == 5:
                        to_unlock.append("streak_5")

                # Poker Fusion Master: 5 poker wins
                if "poker_master_5" not in unlocked:
                    poker_wins = [m for m in user_wins if getattr(m, 'mode', 'classic') == 'poker']
                    if len(poker_wins) >= 5:
                        to_unlock.append("poker_master_5")

                for key in to_unlock:
                    ach = Achievement(user_id=user_id, achievement_key=key)
                    db.add(ach)

                if to_unlock:
                    await db.commit()

                    # Notify the player of unlocked achievements
                    if user_id in self.active_connections:
                        ws = self.active_connections[user_id]
                        try:
                            await ws.send_json({
                                "type": "achievements_unlocked",
                                "keys": to_unlock
                            })
                        except Exception:
                            pass

            except Exception as e:
                print(f"Achievement check error for user {user_id}: {e}")

    async def _flag_suspicious_pairs(self, session: GameSession, db: AsyncSession):
        """Auto-flag if two human players played 10+ matches together within 24 hours."""
        try:
            human_ids = [p["id"] for p in session.players if not p.get("is_bot") and p["id"] > 0]
            if len(human_ids) < 2:
                return

            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(hours=24)

            for i in range(len(human_ids)):
                for j in range(i + 1, len(human_ids)):
                    uid_a = human_ids[i]
                    uid_b = human_ids[j]

                    all_res = await db.execute(select(Match))
                    all_matches = all_res.scalars().all()

                    shared_matches = [
                        m for m in all_matches
                        if m.created_at and m.created_at > cutoff
                        and any(pl["id"] == uid_a for pl in (m.players or []))
                        and any(pl["id"] == uid_b for pl in (m.players or []))
                    ]

                    if len(shared_matches) >= 10:
                        # Check if already flagged recently
                        flag_key = f"suspicious_flag:{min(uid_a, uid_b)}:{max(uid_a, uid_b)}"
                        redis = get_redis_client()
                        already_flagged = await redis.get(flag_key)
                        if not already_flagged:
                            # Create auto-flagged report
                            report = Report(
                                game_id=session.game_id,
                                reporter_id=uid_a,
                                reported_id=uid_b,
                                reason="Suspicious pattern: 10+ matches together in 24 hours",
                                is_auto_flagged=True,
                                status="pending"
                            )
                            db.add(report)
                            await db.commit()
                            # Set flag in Redis for 24h to avoid duplicate flagging
                            await redis.set(flag_key, "1", ex=86400)

        except Exception as e:
            print(f"Suspicious pair check error: {e}")

    async def _classify_chat_message(self, user_id: int, text: str, game_id: str):
        if not settings.GROQ_API_KEY:
            return
            
        system_prompt = "Does this message suggest real-money gambling, side-betting, or arranging payment outside the platform? Respond only YES or NO with a brief reason."
        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
            # Synchronous Groq client inside async needs to run in executor or use async client. 
            # We will use asyncio.to_thread since we don't have AsyncGroq setup verified.
            def _call_groq():
                return client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text}
                    ],
                    max_tokens=100,
                    temperature=0.0
                )
            response = await asyncio.to_thread(_call_groq)
            reply = response.choices[0].message.content.strip().upper()
            
            if reply.startswith("YES"):
                async with async_session_maker() as session:
                    report = Report(
                        game_id=game_id,
                        reporter_id=user_id,
                        reported_id=user_id,  # System flagged this user's message
                        reason="suspicious_chat_pattern",
                        notes=f"Message: '{text}'.\nAI Reason: {reply}",
                        is_auto_flagged=True
                    )
                    session.add(report)
                    await session.commit()
        except Exception as e:
            # Silently fail monitoring if API issue
            print("Chat classification failed:", str(e))

ws_manager = ConnectionManager()
