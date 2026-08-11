import asyncio
import httpx
import json
import psycopg2
from jose import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = "one_left_super_secret_key_123456"

async def test():
    async with httpx.AsyncClient() as client:
        conn = psycopg2.connect('postgresql://postgres:admin@localhost:5432/one_left')
        cur = conn.cursor()
        cur.execute("SELECT email, has_agreed_to_terms FROM users WHERE email IS NOT NULL LIMIT 1;")
        row = cur.fetchone()
        if not row:
            print("No users with email in database!")
            return
        
        email, agreed = row
        print(f"User email: {email}, agreed: {agreed}")
        
        # Generate a JWT using the correct secret
        token = jwt.encode(
            {"sub": email, "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            SECRET_KEY,
            algorithm="HS256"
        )
        print(f"Generated token: {token[:40]}...")
        
        # Test /api/profile
        res = await client.get('http://127.0.0.1:8000/api/profile', headers={'Authorization': f'Bearer {token}'})
        print(f"\nProfile status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"has_agreed_to_terms in response: {'has_agreed_to_terms' in data}")
            print(f"has_agreed_to_terms value: {data.get('has_agreed_to_terms')}")
            print(f"Full profile: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {res.text}")
        
        # Test /api/profile/history
        res2 = await client.get('http://127.0.0.1:8000/api/profile/history', headers={'Authorization': f'Bearer {token}'})
        print(f"\nHistory status: {res2.status_code}")
        print(f"History response: {res2.text[:300]}")

asyncio.run(test())
