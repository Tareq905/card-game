from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean, Date, Float, Text
from sqlalchemy.sql import func
from .database import Base

class BlacklistedEmail(Base):
    __tablename__ = "blacklisted_emails"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    deleted_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # Google OAuth fields
    google_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    display_name = Column(String, nullable=True)
    profile_picture_url = Column(String, nullable=True)
    # Phone (nullable — collected only before first purchase)
    phone = Column(String, unique=True, index=True, nullable=True)
    tokens = Column(Integer, default=200, nullable=False)
    has_agreed_to_terms = Column(Boolean, default=False)

    # Token Reload & Ads
    last_reload = Column(DateTime(timezone=True), nullable=True)
    ad_views_today = Column(Integer, default=0)
    ad_views_date = Column(Date, nullable=True)

    # Audio Settings
    settings = Column(JSON, nullable=True)

    # Ban System
    is_banned = Column(Boolean, default=False)
    ban_reason = Column(String, nullable=True)
    ban_expires_at = Column(DateTime(timezone=True), nullable=True)  # None = permanent

    # Admin flag
    is_admin = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(String, unique=True, index=True, nullable=False)
    mode = Column(String, default="classic")  # "classic" | "poker"
    players = Column(JSON, nullable=False)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ThemeSong(Base):
    __tablename__ = "theme_songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    is_active = Column(Boolean, default=False)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invoice_id = Column(String, unique=True, index=True, nullable=False)
    bkash_txn_id = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    bkash_reported_amount = Column(Float, nullable=True)
    tokens = Column(Integer, nullable=False)
    status = Column(String, default="PENDING")  # PENDING, COMPLETED, FAILED, CANCELLED
    suspicious_flag = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(String, nullable=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String, default="pending")  # "pending" | "reviewed" | "dismissed"
    is_auto_flagged = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    achievement_key = Column(String, nullable=False)
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now())

class SongRequest(Base):
    __tablename__ = "song_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    song_text = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class BanLog(Base):
    __tablename__ = "ban_logs"

    id = Column(Integer, primary_key=True, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)   # "ban" | "unban"
    duration = Column(String, nullable=True)   # "temporary" | "permanent"
    reason = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
