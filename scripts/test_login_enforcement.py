"""Unit test for the new login enforcement logic."""
import sys

# Simulate the relevant part of the chat endpoint
CART_FUNCTIONS = {"add_to_cart", "remove_from_cart", "clear_cart",
                  "view_cart", "checkout", "update_cart"}


def simulate_login_check(func_name, exec_success, is_logged_in, ai_reply):
    """Returns (action, response) like the chat endpoint would after the login check."""
    result = {"action": None, "response": ai_reply}

    if func_name == "search_products" and exec_success:
        # search doesn't require login
        result["action"] = None  # search doesn't set an action
        return result

    if func_name in CART_FUNCTIONS and exec_success:
        if not is_logged_in:
            result["action"] = {"type": "login_required"}
            reply_lower = ai_reply.lower()
            if not any(k in reply_lower for k in ("login", "log in", "sign in", "account")):
                result["response"] = ""
        else:
            result["action"] = {"type": func_name}  # would be the real action_data
        return result

    return result


# === TEST CASES ===
cases = [
    # (name, func_name, exec_success, is_logged_in, ai_reply, expected_action_type, expected_response_kept)
    ("view_cart when logged out, AI says 'cart is empty' (the bug we're fixing)",
     "view_cart", True, False, "Your cart is currently empty.",
     "login_required", False),  # response should be CLEARED because it leaks cart state

    ("view_cart when logged out, AI asks to login",
     "view_cart", True, False, "Please login to view your cart.",
     "login_required", True),  # response should be KEPT (helpful)

    ("view_cart when logged in",
     "view_cart", True, True, "Here are your cart items.",
     "view_cart", True),

    ("add_to_cart when logged out, AI says 'Added!'",
     "add_to_cart", True, False, "Added to your cart!",
     "login_required", False),  # override because user is logged out

    ("add_to_cart when logged in",
     "add_to_cart", True, True, "Added the iPhone 12 to your cart.",
     "add_to_cart", True),

    ("checkout when logged out",
     "checkout", True, False, "Let's start checkout!",
     "login_required", False),

    ("search_products when logged out (no auth needed)",
     "search_products", True, False, "Here are the drones I found.",
     None, True),  # search doesn't require login

    ("clear_cart when logged out, AI says 'cart cleared'",
     "clear_cart", True, False, "Your cart has been cleared.",
     "login_required", False),

    ("update_cart when logged out",
     "update_cart", True, False, "Updated the quantity to 3.",
     "login_required", False),
]

print(f"{'TEST':<75} {'RESULT':<8}")
print("-" * 95)
all_pass = True
for name, func, success, logged_in, reply, expected_action, expected_keep_reply in cases:
    result = simulate_login_check(func, success, logged_in, reply)
    actual_action = result["action"]["type"] if result["action"] else None
    actual_kept = bool(result["response"])

    action_ok = actual_action == expected_action
    reply_ok = actual_kept == expected_keep_reply
    ok = action_ok and reply_ok

    status = "PASS" if ok else "FAIL"
    if not ok:
        all_pass = False
    detail = ""
    if not action_ok:
        detail += f" (action: expected {expected_action}, got {actual_action})"
    if not reply_ok:
        detail += f" (reply kept: expected {expected_keep_reply}, got {actual_kept})"
    print(f"{name:<75} {status:<8}{detail}")

print()
print("=" * 95)
print("ALL PASSED" if all_pass else "SOME FAILED")
sys.exit(0 if all_pass else 1)
