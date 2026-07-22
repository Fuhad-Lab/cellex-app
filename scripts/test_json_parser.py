"""Unit test for parse_ai_response + helpers (v2 - more cases)."""
import sys, json, re
from typing import Optional, Dict

# Inline the parser functions to avoid importing app.py (which pulls in torch)
def _find_balanced_json_end(s: str, start: int) -> int:
    if start >= len(s) or s[start] != '{':
        return -1
    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(s)):
        c = s[i]
        if escape:
            escape = False
            continue
        if c == '\\':
            escape = True
            continue
        if c == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if c in '{[':
            depth += 1
        elif c in '}]':
            depth -= 1
            if depth == 0:
                return i + 1
    return -1


def _repair_json(s: str) -> str:
    s = re.sub(r'"(\w+):\s', r'"\1": ', s)
    if "'" in s and not re.search(r'"[^"]*\'[^"]*"', s):
        s = s.replace("'", '"')
    s = re.sub(r',\s*([}\]])', r'\1', s)
    s = re.sub(r'(?<=[{,])\s*(\w+)\s*:', r' "\1":', s)
    return s


def _try_parse(json_str: str, raw_response: str, repair_log: bool = False) -> Optional[Dict]:
    try:
        result = json.loads(json_str)
        if not isinstance(result, dict):
            return None
        if "reply" not in result:
            result["reply"] = raw_response
        if "calls" not in result:
            result["calls"] = []
        return result
    except (json.JSONDecodeError, ValueError):
        return None


def parse_ai_response(response: str) -> Optional[Dict]:
    if not response:
        return None
    json_start = response.find('{')
    if json_start == -1:
        return None

    balanced_end = _find_balanced_json_end(response, json_start)
    if balanced_end > json_start:
        json_str = response[json_start:balanced_end]
        result = _try_parse(json_str, response)
        if result is not None:
            return result
        repaired = _repair_json(json_str)
        if repaired != json_str:
            result = _try_parse(repaired, response, repair_log=True)
            if result is not None:
                return result

    json_end = response.rfind('}') + 1
    if json_end > json_start:
        json_str = response[json_start:json_end]
        result = _try_parse(json_str, response)
        if result is not None:
            return result
        repaired = _repair_json(json_str)
        if repaired != json_str:
            result = _try_parse(repaired, response, repair_log=True)
            if result is not None:
                return result
    return None


# === TEST CASES ===
cases = [
    # (name, raw_model_output, expected_action_call_count)
    ("valid JSON - chat only",
     '{"reply": "Hello there!"}',
     0),

    ("valid JSON - with calls",
     '{"reply": "Adding it now", "calls": [{"function": "add_to_cart", "args": {"product_number": 1}}]}',
     1),

    ("BUG 1: missing closing quote on key",
     '{"reply": "Sure, I\'ve added the iPhone 12 to your cart.", "calls": [{"function": "add_to_cart", "args": {"product_number: 1}}]}',
     1),

    ("BUG 2: trailing garbage after JSON closes (1.5B model issue)",
     '{"reply":"Sure, I will search for drones now.","calls":[{"function":"search_products","args":{"query":"drones","max_price":999999999}}]}"}',
     1),

    ("trailing comma",
     '{"reply": "ok", "calls": [{"function": "clear_cart", "args": {},},],}',
     1),

    ("single quotes",
     "{'reply': 'hi', 'calls': []}",
     0),

    ("unquoted keys",
     '{reply: "hi", calls: []}',
     0),

    ("no JSON at all (pure prose)",
     "I'm not sure what you mean.",
     0),

    ("update_cart",
     '{"calls": [{"function": "update_cart", "args": {"cart_item_number": 1, "new_quantity": 3}}]}',
     1),

    ("JSON with prose before",
     'Sure! Let me search for that. {"reply": "Searching now", "calls": [{"function": "search_products", "args": {"query": "phones"}}]}',
     1),

    ("JSON with prose after (no trailing garbage)",
     '{"reply": "ok"} here is some explanation',
     0),
]

print(f"{'TEST':<60} {'RESULT':<8} {'CALLS':<6}")
print("-" * 80)
all_pass = True
for name, raw, expected_calls in cases:
    result = parse_ai_response(raw)
    if result is None:
        ok = expected_calls == 0
        calls = 0
    else:
        calls = len(result.get("calls", []))
        ok = calls == expected_calls
    status = "PASS" if ok else "FAIL"
    if not ok:
        all_pass = False
    print(f"{name:<60} {status:<8} {calls}")

print()
print("=" * 80)
print("ALL PASSED" if all_pass else "SOME FAILED")
sys.exit(0 if all_pass else 1)
