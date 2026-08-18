from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from .config import settings
from .database import get_db
from .models import User

# JWT authentication helper
API_KEY_NAME = "Authorization"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(
    token: Optional[str] = Depends(api_key_header),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    # Strip "Bearer " if present
    if token.startswith("Bearer "):
        token = token[7:]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # sub is the user's email (google sign-in)
    result = await db.execute(select(User).filter(User.email == sub))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception

    # Ban check: if banned and ban not expired, block access
    if user.is_banned:
        if user.ban_expires_at is None:
            # Permanent ban
            raise HTTPException(status_code=403, detail="Your account has been permanently banned.")
        now = datetime.now(timezone.utc)
        ban_exp = user.ban_expires_at
        if ban_exp.tzinfo is None:
            ban_exp = ban_exp.replace(tzinfo=timezone.utc)
        if now < ban_exp:
            raise HTTPException(
                status_code=403,
                detail=f"Your account is banned until {ban_exp.strftime('%Y-%m-%d %H:%M UTC')}. Reason: {user.ban_reason}"
            )
        else:
            # Ban expired — auto-unban
            user.is_banned = False
            user.ban_reason = None
            user.ban_expires_at = None
            await db.commit()

    return user
