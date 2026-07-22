"""Inspect Supabase Postgres tables and structure."""
import psycopg2, sys

DB = dict(host="aws-0-eu-central-1.pooler.supabase.com",
          user="postgres.tcwdbokruvlizkxcpkzj", password="qTYBd6N1STurzwqg",
          dbname="postgres", port=5432)

try:
    conn = psycopg2.connect(**DB, connect_timeout=15)
except Exception as e:
    print(f"connect failed: {e}")
    sys.exit(1)

cur = conn.cursor()

print("=== PUBLIC TABLES ===")
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY table_name;
""")
tables = [r[0] for r in cur.fetchall()]
print("\n".join(tables))

print("\n=== COLUMNS PER TABLE ===")
for t in tables:
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s
        ORDER BY ordinal_position;
    """, (t,))
    print(f"\n-- {t} --")
    for col, dtype, nullable, dflt in cur.fetchall():
        print(f"  {col}  {dtype}  null={nullable}  default={dflt}")

print("\n=== ROW COUNTS ===")
for t in tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM public.{t};")
        print(f"  {t}: {cur.fetchone()[0]}")
    except Exception as e:
        print(f"  {t}: ERR {e}")
        conn.rollback()

cur.close()
conn.close()
