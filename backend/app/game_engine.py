import random
import time
from typing import List, Dict, Any, Optional

class GameEngine:
    @staticmethod
    def generate_deck() -> List[Dict[str, Any]]:
        colors = ["red", "blue", "green", "yellow"]
        deck = []
        card_id = 0

        # Number cards
        for color in colors:
            # One '0' card per color
            deck.append({
                "id": f"card_{card_id}",
                "color": color,
                "type": "number",
                "value": "0",
                "asset_path": f"/assets/cards/back/{color}-0.png"
            })
            card_id += 1
            # Two '1' to '9' cards per color
            for num in range(1, 10):
                for _ in range(2):
                    deck.append({
                        "id": f"card_{card_id}",
                        "color": color,
                        "type": "number",
                        "value": str(num),
                        "asset_path": f"/assets/cards/back/{color}-{num}.png"
                    })
                    card_id += 1

            # Actions: skip, reverse, draw2
            for action in ["skip", "reverse", "draw2"]:
                for _ in range(2):
                    deck.append({
                        "id": f"card_{card_id}",
                        "color": color,
                        "type": action,
                        "value": action,
                        "asset_path": f"/assets/cards/back/{color}-{action}.png"
                    })
                    card_id += 1

        # Wilds (4 wild, 4 wild-draw4)
        for _ in range(4):
            deck.append({
                "id": f"card_{card_id}",
                "color": "wild",
                "type": "wild",
                "value": "wild",
                "asset_path": "/assets/cards/back/wild.png"
            })
            card_id += 1
            deck.append({
                "id": f"card_{card_id}",
                "color": "wild",
                "type": "wild-draw4",
                "value": "wild-draw4",
                "asset_path": "/assets/cards/back/wild-draw4.png"
            })
            card_id += 1

        random.shuffle(deck)
        return deck


class GameSession:
    def __init__(self, game_id: str, players_info: List[Dict[str, Any]], mode: str = "classic"):
        self.game_id = game_id
        self.mode = mode  # "classic" | "poker"
        # players_info: list of {"id": int, "phone": str}
        self.players = []
        for p in players_info:
            self.players.append({
                "id": p["id"],
                "phone": p["phone"],
                "is_bot": p.get("is_bot", False),
                "hand": [],
                "is_active": True,
                "afk_warnings": 0
            })
        self.deck = GameEngine.generate_deck()
        self.discard_pile = []
        self.current_turn_index = 0
        self.direction = 1  # 1 for clockwise, -1 for counter-clockwise
        self.active_color = ""
        self.active_value = ""
        self.winner_id = None
        self.game_over = False
        self.last_action_timestamp = time.time()
        self.reconnect_grace_until = {}  # user_id: timestamp
        self.yelled_one_left = {}  # user_id: bool
        self.status = "playing"
        self.system_messages = []
        self.poker_bonus_active = None  # stores pending bonus info
        self.has_drawn_this_turn = False

        self.start_game()

    def start_game(self):
        # Deal 7 cards to each player
        for p in self.players:
            p["hand"] = [self.draw_card_from_deck() for _ in range(7)]
            self.yelled_one_left[p["id"]] = False

        # Put first card on discard pile (ensure it is not wild-draw4)
        first_card = self.deck.pop(0)
        while first_card["type"] == "wild-draw4":
            self.deck.append(first_card)
            random.shuffle(self.deck)
            first_card = self.deck.pop(0)

        self.discard_pile.append(first_card)
        self.active_color = first_card["color"]
        self.active_value = first_card["value"]

        # If first card is wild, color is picked at random
        if first_card["type"] == "wild":
            self.active_color = random.choice(["red", "blue", "green", "yellow"])
            self.system_messages.append(f"Starting card is Wild. Random color picked: {self.active_color}")

        # If first card is reverse, change direction
        if first_card["type"] == "reverse":
            self.direction = -1
            self.current_turn_index = len(self.players) - 1
            self.system_messages.append("Starting card is Reverse. Turn direction flipped.")

        # If first card is skip, skip first player
        if first_card["type"] == "skip":
            self.current_turn_index = (self.current_turn_index + self.direction) % len(self.players)
            self.system_messages.append(f"Starting card is Skip. Player {self.players[self.current_turn_index]['phone']} is skipped.")

        # If first card is draw2, first player draws 2 and is skipped
        if first_card["type"] == "draw2":
            first_player = self.players[self.current_turn_index]
            first_player["hand"].extend([self.draw_card_from_deck() for _ in range(2)])
            self.current_turn_index = (self.current_turn_index + self.direction) % len(self.players)
            self.system_messages.append(f"Starting card is Draw 2. Player {first_player['phone']} draws 2 and turn is skipped.")

        self.last_action_timestamp = time.time()

    def draw_card_from_deck(self) -> Dict[str, Any]:
        if not self.deck:
            # Reshuffle discard pile except top card
            top_card = self.discard_pile.pop()
            self.deck = self.discard_pile
            random.shuffle(self.deck)
            self.discard_pile = [top_card]
            
            # If still no cards, generate new deck
            if not self.deck:
                self.deck = GameEngine.generate_deck()
        return self.deck.pop(0)

    def to_json(self) -> Dict[str, Any]:
        return {
            "game_id": self.game_id,
            "mode": self.mode,
            "players": self.players,
            "deck": self.deck,
            "discard_pile": self.discard_pile,
            "current_turn_index": self.current_turn_index,
            "direction": self.direction,
            "active_color": self.active_color,
            "active_value": self.active_value,
            "winner_id": self.winner_id,
            "game_over": self.game_over,
            "last_action_timestamp": self.last_action_timestamp,
            "reconnect_grace_until": self.reconnect_grace_until,
            "yelled_one_left": self.yelled_one_left,
            "status": self.status,
            "system_messages": self.system_messages[-10:],
            "poker_bonus_active": self.poker_bonus_active,
            "has_drawn_this_turn": self.has_drawn_this_turn,
        }

    @classmethod
    def from_json(cls, data: Dict[str, Any]) -> 'GameSession':
        session = cls.__new__(cls)
        session.game_id = data["game_id"]
        session.mode = data.get("mode", "classic")
        session.players = data["players"]
        session.deck = data["deck"]
        session.discard_pile = data["discard_pile"]
        session.current_turn_index = data["current_turn_index"]
        session.direction = data["direction"]
        session.active_color = data["active_color"]
        session.active_value = data["active_value"]
        session.winner_id = data["winner_id"]
        session.game_over = data["game_over"]
        session.last_action_timestamp = data["last_action_timestamp"]
        session.reconnect_grace_until = {int(k): v for k, v in data["reconnect_grace_until"].items()}
        session.yelled_one_left = {int(k): v for k, v in data["yelled_one_left"].items()}
        session.status = data["status"]
        session.system_messages = data.get("system_messages", [])
        session.poker_bonus_active = data.get("poker_bonus_active", None)
        session.has_drawn_this_turn = data.get("has_drawn_this_turn", False)
        return session

    def get_player_view(self, player_id: int) -> Dict[str, Any]:
        players_view = []
        for p in self.players:
            players_view.append({
                "id": p["id"],
                "phone": p["phone"],
                "card_count": len(p["hand"]),
                "is_active": p["is_active"],
                "hand": p["hand"] if p["id"] == player_id or self.game_over else []
            })

        return {
            "game_id": self.game_id,
            "mode": self.mode,
            "players": players_view,
            "discard_top": self.discard_pile[-1] if self.discard_pile else None,
            "active_color": self.active_color,
            "active_value": self.active_value,
            "current_turn_player_id": self.players[self.current_turn_index]["id"],
            "direction": self.direction,
            "game_over": self.game_over,
            "winner_id": self.winner_id,
            "system_messages": self.system_messages,
            "yelled_one_left": self.yelled_one_left,
            "poker_bonus_active": self.poker_bonus_active,
            "has_drawn_this_turn": self.has_drawn_this_turn,
        }

    def is_playable(self, card: Dict[str, Any]) -> bool:
        # Wild card can be played anytime
        if card["color"] == "wild":
            return True
        # Normal card matches color or value
        return card["color"] == self.active_color or card["value"] == self.active_value

    def play_card(self, player_id: int, card_id: str, wild_color: Optional[str] = None) -> bool:
        if self.game_over:
            return False

        # Verify turn
        current_player = self.players[self.current_turn_index]
        if current_player["id"] != player_id:
            raise ValueError("It is not your turn.")

        # Find card in player's hand
        card = next((c for c in current_player["hand"] if c["id"] == card_id), None)
        if not card:
            raise ValueError("Card is not in your hand.")

        # Validate play
        if not self.is_playable(card):
            raise ValueError(f"Card {card['color']}-{card['value']} cannot be played on {self.active_color}-{self.active_value}.")

        # Remove card from hand
        current_player["hand"].remove(card)
        self.discard_pile.append(card)

        # Handle yelled state resetting
        # Play action means their "One Left" status is false again, unless they have exactly 1 card left and just yelled it
        self.yelled_one_left[player_id] = False

        # Apply Card Action/Effect
        next_turn_offset = 1
        card_type = card["type"]

        if card_type == "number":
            self.active_color = card["color"]
            self.active_value = card["value"]
            self.system_messages.append(f"{current_player['phone']} played {card['color']} {card['value']}.")

        elif card_type == "skip":
            self.active_color = card["color"]
            self.active_value = card["value"]
            next_turn_offset = 2
            skipped_player = self.players[(self.current_turn_index + self.direction) % len(self.players)]
            self.system_messages.append(f"{current_player['phone']} played Skip. {skipped_player['phone']} was skipped.")

        elif card_type == "reverse":
            self.active_color = card["color"]
            self.active_value = card["value"]
            self.direction *= -1
            if len(self.players) == 2:
                # In 2-player game, reverse works as skip
                next_turn_offset = 2
                self.system_messages.append(f"{current_player['phone']} played Reverse (Skipped opponent in 2P).")
            else:
                self.system_messages.append(f"{current_player['phone']} played Reverse. Direction changed.")

        elif card_type == "draw2":
            self.active_color = card["color"]
            self.active_value = card["value"]
            target_idx = (self.current_turn_index + self.direction) % len(self.players)
            target_player = self.players[target_idx]
            target_player["hand"].extend([self.draw_card_from_deck() for _ in range(2)])
            next_turn_offset = 2
            self.system_messages.append(f"{current_player['phone']} played Draw 2. {target_player['phone']} draws 2 and was skipped.")

        elif card_type == "wild":
            if not wild_color or wild_color not in ["red", "blue", "green", "yellow"]:
                raise ValueError("Must specify valid color when playing a Wild Card.")
            self.active_color = wild_color
            self.active_value = "wild"
            self.system_messages.append(f"{current_player['phone']} played Wild Card. Color changed to {wild_color}.")

        elif card_type == "wild-draw4":
            if not wild_color or wild_color not in ["red", "blue", "green", "yellow"]:
                raise ValueError("Must specify valid color when playing a Wild Draw 4.")
            self.active_color = wild_color
            self.active_value = "wild-draw4"
            target_idx = (self.current_turn_index + self.direction) % len(self.players)
            target_player = self.players[target_idx]
            target_player["hand"].extend([self.draw_card_from_deck() for _ in range(4)])
            next_turn_offset = 2
            self.system_messages.append(f"{current_player['phone']} played Wild Draw 4. Color changed to {wild_color}. {target_player['phone']} draws 4 and was skipped.")

        # Check Win Condition
        if len(current_player["hand"]) == 0:
            self.game_over = True
            self.winner_id = player_id
            self.status = "ended"
            self.system_messages.append(f"Game Over! {current_player['phone']} won the match!")
            return True

        # Advance Turn
        self.current_turn_index = (self.current_turn_index + self.direction * next_turn_offset) % len(self.players)
        
        # Ensure skipped or inactive players are handled
        self.has_drawn_this_turn = False
        self.last_action_timestamp = time.time()
        return True

    def draw_card(self, player_id: int) -> Dict[str, Any]:
        if self.game_over:
            return None

        current_player = self.players[self.current_turn_index]
        if current_player["id"] != player_id:
            raise ValueError("It is not your turn to draw a card.")
        if self.has_drawn_this_turn:
            raise ValueError("You have already drawn a card this turn. You must play or pass.")

        card = self.draw_card_from_deck()
        current_player["hand"].append(card)
        self.has_drawn_this_turn = True

        # Reset yelled state
        self.yelled_one_left[player_id] = False

        self.system_messages.append(f"{current_player['phone']} drew a card.")
        self.last_action_timestamp = time.time()

        # ===== POKER FUSION CHECKPOINT =====
        # When a player draws down to exactly 5 cards, evaluate their hand
        if self.mode == "poker" and len(current_player["hand"]) == 5:
            self._check_poker_checkpoint(player_id)

        return card

    # ===== POKER FUSION HAND EVALUATION =====
    def _check_poker_checkpoint(self, player_id: int):
        player = next((p for p in self.players if p["id"] == player_id), None)
        if not player:
            return
        hand = player["hand"]
        hand_rank, hand_name = self.evaluate_poker_hand(hand)
        if hand_rank >= 3:  # Three of a Kind equivalent or better
            bonus = self.apply_poker_bonus(player_id, hand_name)
            self.system_messages.append(
                f"🃏 POKER FUSION! {player['phone']} hit 5 cards with '{hand_name}' — Bonus: {bonus}!"
            )
        elif hand_rank >= 2:  # Pair equivalent
            self.system_messages.append(
                f"🃏 {player['phone']} has a Pair hand at checkpoint — no bonus triggered."
            )

    def evaluate_poker_hand(self, hand: List[Dict[str, Any]]) -> tuple:
        """
        Evaluates hand using card numbers as rank and colors as suit.
        Returns (rank_level, hand_name) where higher rank = stronger hand.
        Rank levels:
          0 = High Card, 1 = One Pair, 2 = Two Pair,
          3 = Three of a Kind, 4 = Straight, 5 = Flush, 6 = Full House, 7 = Four of a Kind
        """
        # Only count number cards for rank/suit evaluation
        number_cards = [c for c in hand if c["type"] == "number"]

        values = [c["value"] for c in number_cards]
        colors = [c["color"] for c in number_cards]

        from collections import Counter
        value_counts = Counter(values)
        color_counts = Counter(colors)

        counts = sorted(value_counts.values(), reverse=True)

        # Check for flush-like (all same color, at least 3 number cards)
        is_flush = len(number_cards) >= 4 and len(color_counts) == 1
        # Four of a kind
        if counts and counts[0] >= 4:
            return (7, "Four of a Kind")
        # Full house
        if len(counts) >= 2 and counts[0] >= 3 and counts[1] >= 2:
            return (6, "Full House")
        # Flush
        if is_flush:
            return (5, "Flush")
        # Three of a kind
        if counts and counts[0] >= 3:
            return (3, "Three of a Kind")
        # Two pair
        if len([c for c in counts if c >= 2]) >= 2:
            return (2, "Two Pair")
        # One pair
        if counts and counts[0] >= 2:
            return (1, "One Pair")
        return (0, "High Card")

    def apply_poker_bonus(self, player_id: int, hand_name: str) -> str:
        """
        Applies a bonus effect based on hand strength.
        Returns description of the bonus applied.
        """
        player = next((p for p in self.players if p["id"] == player_id), None)
        opponents = [p for p in self.players if p["id"] != player_id]

        # Four of a Kind or Full House → all opponents draw 1 card
        if hand_name in ("Four of a Kind", "Full House", "Flush"):
            for opp in opponents:
                opp["hand"].append(self.draw_card_from_deck())
            self.poker_bonus_active = {"type": "all_draw_1", "player_id": player_id}
            return "All opponents draw 1 card"

        # Three of a Kind → skip next player
        if hand_name == "Three of a Kind":
            # Skip next turn by advancing the turn index an extra step
            next_idx = (self.current_turn_index + self.direction) % len(self.players)
            skipped_player = self.players[next_idx]
            self.poker_bonus_active = {"type": "skip_next", "player_id": player_id, "skipped_id": skipped_player["id"]}
            # We'll apply the actual turn skip in the advance turn logic via bonus_active
            self.system_messages.append(f"{skipped_player['phone']} will be skipped due to Poker Bonus!")
            return f"Skip {skipped_player['phone']}'s next turn"

    def pass_turn(self, player_id: int):
        if self.game_over:
            return

        current_player = self.players[self.current_turn_index]
        if current_player["id"] != player_id:
            raise ValueError("It is not your turn.")

        # A player can only pass if they have drawn a card on this turn or have no playable cards.
        # To make gameplay robust, we allow passing after a draw.
        if not self.has_drawn_this_turn:
            # Optionally, you can force players to draw before passing if they have no playable cards.
            pass
        self.current_turn_index = (self.current_turn_index + self.direction) % len(self.players)
        self.has_drawn_this_turn = False
        self.system_messages.append(f"{current_player['phone']} passed.")
        self.last_action_timestamp = time.time()

    def yell_one_left_action(self, player_id: int):
        # Yell "One Left"
        self.yelled_one_left[player_id] = True
        player = next((p for p in self.players if p["id"] == player_id), None)
        phone = player["phone"] if player else "Player"
        self.system_messages.append(f"{phone} yelled 'ONE LEFT!'")

    def catch_player(self, catcher_id: int, target_id: int) -> bool:
        # Check if target player has exactly 1 card and has NOT yelled "One Left"
        target_player = next((p for p in self.players if p["id"] == target_id), None)
        catcher_player = next((p for p in self.players if p["id"] == catcher_id), None)
        
        if not target_player or not catcher_player:
            return False

        if len(target_player["hand"]) == 1 and not self.yelled_one_left.get(target_id, False):
            # Target gets penalized! Draws 2 cards.
            target_player["hand"].extend([self.draw_card_from_deck() for _ in range(2)])
            self.yelled_one_left[target_id] = False
            self.system_messages.append(
                f"{catcher_player['phone']} caught {target_player['phone']} with 1 card! {target_player['phone']} draws 2 penalty cards."
            )
            return True
        return False

    def handle_disconnect(self, player_id: int):
        player = next((p for p in self.players if p["id"] == player_id), None)
        if player:
            player["is_active"] = False
            # 30 seconds grace period
            self.reconnect_grace_until[player_id] = time.time() + 30.0
            self.system_messages.append(f"{player['phone']} disconnected. 30s grace period to reconnect.")

    def handle_reconnect(self, player_id: int):
        player = next((p for p in self.players if p["id"] == player_id), None)
        if player:
            player["is_active"] = True
            if player_id in self.reconnect_grace_until:
                del self.reconnect_grace_until[player_id]
            self.system_messages.append(f"{player['phone']} reconnected.")

    def check_timeouts(self) -> List[int]:
        """
        Processes turn timeouts (AFK) and disconnect grace periods.
        Returns a list of user_ids that have forfeited.
        """
        now = time.time()
        forfeited_users = []

        # Check disconnect grace periods
        for player_id, grace_time in list(self.reconnect_grace_until.items()):
            if now > grace_time:
                player = next((p for p in self.players if p["id"] == player_id), None)
                if player:
                    self.system_messages.append(f"{player['phone']} failed to reconnect in time and forfeited.")
                    forfeited_users.append(player_id)
                    # Forfeit match: mark game over
                    self.game_over = True
                    self.status = "ended"
                    # Determine winner (other player)
                    remaining = [p for p in self.players if p["id"] != player_id and p["is_active"]]
                    if remaining:
                        self.winner_id = remaining[0]["id"]
                    else:
                        # Pick any other player
                        others = [p for p in self.players if p["id"] != player_id]
                        if others:
                            self.winner_id = others[0]["id"]

        # Check AFK turn timer (25s) if game not over
        if not self.game_over and len(self.players) > 1:
            if now - self.last_action_timestamp > 25.0:
                current_player = self.players[self.current_turn_index]
                current_player["afk_warnings"] += 1
                self.system_messages.append(f"{current_player['phone']} turn timed out (Warning {current_player['afk_warnings']}/2).")
                
                if current_player["afk_warnings"] >= 2:
                    # Auto forfeit
                    self.system_messages.append(f"{current_player['phone']} was kicked for inactivity.")
                    forfeited_users.append(current_player["id"])
                    self.game_over = True
                    self.status = "ended"
                    remaining = [p for p in self.players if p["id"] != current_player["id"]]
                    if remaining:
                        self.winner_id = remaining[0]["id"]
                else:
                    # Auto draw card and skip
                    try:
                        self.draw_card_from_deck() # draw for them
                        self.current_turn_index = (self.current_turn_index + self.direction) % len(self.players)
                        self.last_action_timestamp = now
                    except Exception:
                        pass

        return forfeited_users

    def calculate_bot_move(self, bot_id: int) -> Dict[str, Any]:
        """
        Returns the action to take for a bot player.
        """
        bot_player = next((p for p in self.players if p["id"] == bot_id), None)
        if not bot_player:
            return {"action": "pass"}
            
        # 1. Catch player with 1 card
        if random.random() < 0.30:
            for p in self.players:
                if len(p["hand"]) == 1 and p["id"] != bot_id and not self.yelled_one_left.get(p["id"], False):
                    return {"action": "catch_player", "target_id": p["id"]}
                    
        # 2. Check if we need to yell "One Left"
        if len(bot_player["hand"]) == 1 and not self.yelled_one_left.get(bot_id, False):
            if random.random() < 0.90:
                return {"action": "yell_one_left"}
                
        # 3. Find playable cards
        playable = [c for c in bot_player["hand"] if self.is_playable(c)]
        
        if not playable:
            if getattr(self, "has_drawn_this_turn", False):
                return {"action": "pass"}
            return {"action": "draw_card"}
            
        # 1 in 20 chance to make a suboptimal play (random playable card)
        if random.random() < 0.05:
            card_to_play = random.choice(playable)
        else:
            # Strategic Play
            actions = [c for c in playable if c["type"] in ["skip", "reverse", "draw2"]]
            numbers = [c for c in playable if c["type"] == "number"]
            wilds = [c for c in playable if "wild" in c["type"]]
            
            if actions:
                card_to_play = random.choice(actions)
            elif numbers:
                card_to_play = max(numbers, key=lambda c: int(c["value"]))
            elif wilds:
                card_to_play = random.choice(wilds)
            else:
                card_to_play = random.choice(playable)
                
        wild_color = None
        if "wild" in card_to_play["type"]:
            colors = {"red": 0, "blue": 0, "green": 0, "yellow": 0}
            for c in bot_player["hand"]:
                if c["color"] in colors:
                    colors[c["color"]] += 1
            wild_color = max(colors, key=colors.get)
            if colors[wild_color] == 0:
                wild_color = random.choice(["red", "blue", "green", "yellow"])
            
        return {"action": "play_card", "card_id": card_to_play["id"], "wild_color": wild_color}
