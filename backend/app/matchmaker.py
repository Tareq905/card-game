import asyncio
import json
import uuid
import time
from typing import List, Dict, Any
from .redis_client import get_redis_client

CLASSIC_QUEUE_KEY = "matchmaking_queue:classic"
POKER_QUEUE_KEY = "matchmaking_queue:poker"
GAME_PREFIX = "game:"

def _queue_key(mode: str) -> str:
    return POKER_QUEUE_KEY if mode == "poker" else CLASSIC_QUEUE_KEY

class Matchmaker:
    @staticmethod
    async def add_to_queue(user_id: int, phone: str, mode: str = "classic") -> int:
        redis = get_redis_client()
        member_data = json.dumps({"id": user_id, "phone": phone, "mode": mode})
        await redis.zadd(_queue_key(mode), {member_data: time.time()})
        queue_size = await redis.zcard(_queue_key(mode))
        return queue_size

    @staticmethod
    async def remove_from_queue(user_id: int, phone: str, mode: str = "classic"):
        redis = get_redis_client()
        member_data = json.dumps({"id": user_id, "phone": phone, "mode": mode})
        await redis.zrem(_queue_key(mode), member_data)

    @staticmethod
    async def get_queue_players(mode: str = "classic") -> List[Dict[str, Any]]:
        redis = get_redis_client()
        players_raw = await redis.zrange(_queue_key(mode), 0, -1)
        return [json.loads(p) for p in players_raw]

    @staticmethod
    async def get_queue_size(mode: str = "classic") -> int:
        redis = get_redis_client()
        return await redis.zcard(_queue_key(mode))

    @classmethod
    async def run_matchmaking_loop(cls, ws_manager_callback):
        """
        Background loop to check queue and match players.
        Runs for both classic and poker queues simultaneously.
        """
        while True:
            try:
                for mode in ["classic", "poker"]:
                    await cls._process_queue(mode, ws_manager_callback)
            except Exception as e:
                print(f"Error in matchmaking loop: {e}")

            await asyncio.sleep(1.0)

    @classmethod
    async def _process_queue(cls, mode: str, ws_manager_callback):
        redis = get_redis_client()
        queue_key = _queue_key(mode)
        queue_size = await redis.zcard(queue_key)

        if queue_size < 1:
            return

        oldest_member_raw = await redis.zrange(queue_key, 0, 0, withscores=True)

        should_match = False
        match_count = 0

        if queue_size >= 4:
            should_match = True
            match_count = 4
        elif oldest_member_raw:
            _, oldest_score = oldest_member_raw[0]
            if time.time() - oldest_score >= 10.0:  # 10-second timeout
                should_match = True
                match_count = queue_size

        if should_match:
            matched_raw = await redis.zrange(queue_key, 0, match_count - 1)
            matched_players = [json.loads(p) for p in matched_raw]

            for p in matched_raw:
                await redis.zrem(queue_key, p)

            # Fill remaining slots with bots
            import random
            bot_names = ["Alex", "Jordan", "Sam", "Taylor", "Casey", "Morgan", "Riley"]
            for i in range(4 - match_count):
                bot_id = -1000 - i - int(time.time())
                matched_players.append({
                    "id": bot_id,
                    "phone": random.choice(bot_names),
                    "is_bot": True
                })

            game_id = f"game_{uuid.uuid4().hex[:10]}"
            await ws_manager_callback(game_id, matched_players, mode)

