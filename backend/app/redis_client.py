import fakeredis.aioredis
from typing import Optional

# Setup the in-memory FakeRedis instance for async operations
# Since we are using a single process, sharing this instance ensures that all WebSocket connections and HTTP handlers share the same database state.
_redis_instance: Optional[fakeredis.aioredis.FakeRedis] = None

def get_redis_client() -> fakeredis.aioredis.FakeRedis:
    global _redis_instance
    if _redis_instance is None:
        # decode_responses=True ensures that all outputs are returned as strings instead of bytes
        _redis_instance = fakeredis.aioredis.FakeRedis(decode_responses=True)
    return _redis_instance

# Rate limiting helper function
async def is_rate_limited(key: str, limit: int, period: int) -> bool:
    """
    Implements a rolling window rate limiter using Redis.
    Key should be unique to the user/IP and endpoint (e.g. rate_limit:auth:192.168.1.1).
    """
    client = get_redis_client()
    current_requests = await client.get(key)
    
    if current_requests is None:
        await client.set(key, 1, ex=period)
        return False
    
    count = int(current_requests)
    if count >= limit:
        return True
        
    await client.incr(key)
    return False
