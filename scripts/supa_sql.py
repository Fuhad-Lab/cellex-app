#!/usr/bin/env python3
"""Run a SQL query against Supabase via the management API."""
import os, sys, json, urllib.request, urllib.error

TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

def run_sql(query: str):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}", "body": e.read().decode()}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Read SQL from a file or arg
    if len(sys.argv) > 1 and sys.argv[1] == "-f":
        with open(sys.argv[2]) as f:
            sql = f.read()
    else:
        sql = sys.argv[1] if len(sys.argv) > 1 else "SELECT 1 as ok;"
    # Replace single quotes with PostgreSQL dollar-quote to avoid shell/API quote escaping issues
    sql = sql.replace("'", "$$")
    res = run_sql(sql)
    print(json.dumps(res, indent=2, default=str)[:8000])
