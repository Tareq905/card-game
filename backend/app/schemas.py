from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class UserOut(BaseModel):
    id: int
    email: Optional[str] = None
    display_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    phone: Optional[str] = None
    tokens: int
    has_agreed_to_terms: bool = False
    is_admin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class MatchOut(BaseModel):
    id: int
    game_id: str
    mode: Optional[str] = "classic"
    players: List[Dict[str, Any]]
    winner_id: Optional[int]
    ended_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
