"""Unit test for _message_requests_cart_operation heuristic."""
import sys, re

# Inline the function (don't import app.py - it pulls in torch)
def _message_requests_cart_operation(message: str) -> bool:
    msg = message.lower().strip()
    cart_view_patterns = [
        r"\b(view|show|see|check|what'?s in|look at)\b.*\bcart\b",
        r"\bcart\b.*\b(view|show|see|check|contents?|items?)\b",
        r"\bmy cart\b",
    ]
    cart_modify_patterns = [
        r"\b(add|put|include)\b.*\bcart\b",
        r"\badd to cart\b",
        r"\b(remove|delete|take out|take off)\b.*\bcart\b",
        r"\b(clear|empty|wipe)\b.*\bcart\b",
        r"\bcheckout\b",
        r"\b(update|change)\b.*\b(quantity|cart|item)\b",
        r"\b(update|change)\b.*\bto\b.*\d",
        r"\bbuy (now|this|the|it)\b",
        r"\border (this|the|it|now)\b",
    ]
    for pattern in cart_view_patterns + cart_modify_patterns:
        if re.search(pattern, msg):
            return True
    return False


cases = [
    # (message, expected_result, description)
    ("show me my cart", True, "view cart - direct"),
    ("view my cart", True, "view cart - simple"),
    ("what's in my cart?", True, "view cart - question"),
    ("check my cart", True, "view cart - check"),
    ("my cart", True, "view cart - bare"),
    ("show cart contents", True, "view cart - contents"),
    ("see what's in my cart", True, "view cart - long"),
    ("add the first one to my cart", True, "add to cart - explicit"),
    ("add to cart", True, "add to cart - bare"),
    ("put this in my cart", True, "add to cart - put"),
    ("remove the second item from my cart", True, "remove from cart"),
    ("take out the first item from cart", True, "remove - take out"),
    ("clear my cart", True, "clear cart"),
    ("empty my cart", True, "empty cart"),
    ("checkout now", True, "checkout"),
    ("checkout", True, "checkout - bare"),
    ("change the quantity to 3", True, "update cart - quantity"),
    ("update the first item to 5", True, "update cart - explicit"),
    ("buy now", True, "buy now"),
    ("buy this", True, "buy this"),
    ("order this", True, "order this"),

    # Should NOT match (non-cart queries)
    ("show me drones", False, "search products"),
    ("do you have any books?", False, "search products - books"),
    ("hi", False, "greeting"),
    ("hello there", False, "greeting"),
    ("what products do you have?", False, "general product question"),
    ("I want something to read on a flight", False, "indirect book search"),
    ("record video while running", False, "indirect drone search"),
    ("how much does the drone cost?", False, "product question"),
    ("where do you deliver?", False, "general question"),
    ("tell me about EeshaMart", False, "general question"),
    ("what's your return policy?", False, "general question"),
    ("thanks!", False, "thanks"),
]

print(f"{'MESSAGE':<50} {'EXPECTED':<10} {'GOT':<6} {'RESULT':<8}")
print("-" * 80)
all_pass = True
for msg, expected, desc in cases:
    got = _message_requests_cart_operation(msg)
    ok = got == expected
    status = "PASS" if ok else "FAIL"
    if not ok:
        all_pass = False
    print(f"{msg[:50]:<50} {str(expected):<10} {str(got):<6} {status:<8} {desc if not ok else ''}")

print()
print("=" * 80)
print("ALL PASSED" if all_pass else "SOME FAILED")
sys.exit(0 if all_pass else 1)
