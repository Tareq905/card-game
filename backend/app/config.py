import os

class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:admin@localhost:5432/one_left"
    )
    SYNC_DATABASE_URL: str = os.getenv(
        "SYNC_DATABASE_URL",
        "postgresql://postgres:admin@localhost:5432/one_left"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "one_left_super_secret_key_123456")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 1 day

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "1043422303331-vjs6rh7csprkhjfn8nojdkd2cljor25i.apps.googleusercontent.com")

    # Groq AI Chatbot
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "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")

    # Admin-configurable chatbot song request reply (change via env, no code change needed)
    SONG_REQUEST_REPLY: str = os.getenv(
        "SONG_REQUEST_REPLY",
        "Okay, I'll pass this along to the team to consider adding it!"
    )

settings = Settings()
