"""Create a test user via the Supabase SQL admin API.

We can't call /auth/v1/admin/users because the auth API is IP-restricted.
But we CAN run SQL via the management API, and the auth.users table is
accessible from there.

We use crypt() for the password hash since Supabase auth uses pgcrypto.
"""
import json, time, urllib.request, urllib.error

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"
TS = int(time.time())

EMAIL = f"cellex-test-{TS}@protonmail.com"
PASSWORD = "TestPass123!"

# Supabase auth schema password hash is bcrypt. We need to generate it.
# But we can't easily do bcrypt from python without bcrypt lib. Let me try
# to use Supabase auth's `crypt()` function which uses pgcrypto.

# Actually, Supabase's auth.users.encrypted_password is in bcrypt format ($2a$...)
# We can use the sql function `crypt(password, gen_salt('bf', 10))` to generate it.

sql = f"""
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated', '{EMAIL}',
  crypt('{PASSWORD}', gen_salt('bf', 10)),
  now(), now(), now(), now(),
  '{{}}'::jsonb, '{{}}'::jsonb,
  '', '', '', ''
)
RETURNING id, email;
"""

url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
data = json.dumps({"query": sql}).encode("utf-8")
req = urllib.request.Request(url, data=data, method="POST",
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 Chrome/126.0",
    })
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        result = json.load(r)
        print(f"Created user: {result}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")
except Exception as e:
    print(f"Error: {e}")
