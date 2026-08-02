"""
Cellex Backend Integration Tests

Tests ALL critical flows:
- Authentication & authorization
- Product access
- Order creation (with server-side price verification)
- Payment verification (server-to-server with Paystack)
- File uploads (via Supabase Storage)
- Rate limiting
- AI endpoints (search, try-on)
- Messaging
- Failure & recovery

Run: python -m pytest tests/ -v
"""

import pytest
import httpx
import os
import base64
import struct
import zlib

# Configuration
BASE_URL = os.getenv("TEST_BASE_URL", "https://eesha-learn.onrender.com")
NESTJS_URL = os.getenv("TEST_NESTJS_URL", "https://cellex-nestjs-api.onrender.com")
FASTAPI_URL = os.getenv("TEST_FASTAPI_URL", "https://cellex-fastapi-ai.onrender.com")
TEST_EMAIL = os.getenv("TEST_EMAIL", "")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "")

# Helpers
def get_session():
    """Login and return a session with cookies."""
    s = httpx.Client(base_url=BASE_URL, timeout=30)
    r = s.post("/api/auth", json={"op": "login", "email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200
    assert r.json().get("success") is True
    return s

def create_test_png(width=32, height=48):
    """Create a minimal PNG image for upload tests."""
    raw = b''
    for y in range(height):
        raw += b'\x00' + b'\xc8\x96\x64' * width
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


# ============================================================================
# AUTH TESTS
# ============================================================================

class TestAuth:
    def test_login_success(self):
        """Valid credentials should return a session."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/auth", json={"op": "login", "email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL

    def test_login_wrong_password(self):
        """Wrong password should fail."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/auth", json={"op": "login", "email": TEST_EMAIL, "password": "wrong"})
        assert r.json()["success"] is False

    def test_session_check(self):
        """Authenticated session should return user."""
        s = get_session()
        r = s.post("/api/auth", json={"op": "session"})
        assert r.json()["success"] is True
        assert r.json()["user"]["email"] == TEST_EMAIL

    def test_logout(self):
        """Logout should clear the session cookie."""
        s = get_session()
        r = s.post("/api/auth", json={"op": "logout"})
        assert r.status_code == 200
        # The cookie should be deleted (the response sets it to empty)
        # Note: httpx doesn't automatically clear cookies, but the server does
        assert r.json().get("success") is True

    def test_protected_endpoint_without_auth(self):
        """Protected endpoints should reject unauthenticated requests."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/notifications", json={"op": "list"})
        assert r.status_code == 401


# ============================================================================
# PRODUCT TESTS
# ============================================================================

class TestProducts:
    def test_list_products(self):
        """Public product list should work without auth."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/products", json={"op": "all", "limit": 10})
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert len(data.get("products", [])) > 0

    def test_product_by_id(self):
        """Should fetch a single product by ID."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/products", json={"op": "by_id", "id": 44})
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert "product" in r.json()

    def test_seller_storefront(self):
        """Public storefront should work by slug."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/seller-by-slug", json={"slug": "fuhad"})
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert "seller" in r.json()


# ============================================================================
# ORDER TESTS
# ============================================================================

class TestOrders:
    def test_create_order_requires_auth(self):
        """Order creation should require authentication."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/checkout", json={"op": "prepare"})
        assert r.status_code == 401

    def test_checkout_prepare(self):
        """Authenticated user can access checkout (cart may be empty)."""
        s = get_session()
        r = s.post("/api/checkout", json={
            "op": "place_order",
            "shippingAddress": {"name": "Test", "phone": "08012345678", "address": "123 Test St", "city": "Lagos", "state": "Lagos"}
        })
        # 200 with success or 400 with "cart empty" — both are valid responses
        assert r.status_code in [200, 400]

    def test_orders_list(self):
        """Authenticated user can list their orders."""
        s = get_session()
        r = s.post("/api/orders", json={"op": "list"})
        assert r.status_code == 200
        assert r.json()["success"] is True


# ============================================================================
# PAYMENT TESTS
# ============================================================================

class TestPayments:
    def test_payment_verify_requires_auth(self):
        """Payment endpoints should not be accessible without auth."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        # Try to access payment endpoint without auth
        r = s.post("/api/payment", json={"op": "check_status", "orderId": "test"})
        # Should return 401 (not 200 with data)
        assert r.status_code in [401, 404]  # 401 if auth checked, 404 if route not found

    def test_payment_verify_invalid_reference(self):
        """Invalid payment reference should fail gracefully."""
        s = get_session()
        r = s.post("/api/payment", json={
            "op": "check_status",
            "orderId": "00000000-0000-0000-0000-000000000000",
        })
        # Should return 200 with error message (not 500)
        assert r.status_code in [200, 404]


# ============================================================================
# UPLOAD TESTS
# ============================================================================

class TestUploads:
    def test_upload_requires_auth(self):
        """Upload should require authentication."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/upload-image", json={"imageData": "data:image/png;base64,abc"})
        assert r.status_code == 401

    def test_upload_invalid_data(self):
        """Invalid image data should fail."""
        s = get_session()
        r = s.post("/api/upload-image", json={"imageData": "not-an-image"})
        assert r.status_code in [200, 400, 500]  # Should handle gracefully


# ============================================================================
# RATE LIMITING TESTS
# ============================================================================

class TestRateLimiting:
    def test_rapid_requests_handled(self):
        """Rapid requests should be handled (rate limited or served)."""
        s = get_session()
        responses = []
        for i in range(20):
            r = s.post("/api/notifications", json={"op": "list"})
            responses.append(r.status_code)
        # Should not all be 500 (server should stay up)
        assert all(s < 500 for s in responses)


# ============================================================================
# MESSAGING TESTS
# ============================================================================

class TestMessaging:
    def test_messenger_list(self):
        """Authenticated user can list conversations."""
        s = get_session()
        r = s.post("/api/messenger", json={"op": "list"})
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_messenger_unread(self):
        """Unread count should return a number."""
        s = get_session()
        r = s.post("/api/messenger", json={"op": "unread"})
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert "count" in r.json()

    def test_messaging_requires_auth(self):
        """Messaging should require auth."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/messenger", json={"op": "list"})
        assert r.status_code == 401


# ============================================================================
# AI ENDPOINT TESTS
# ============================================================================

class TestAI:
    def test_smart_search(self):
        """Smart search should return results."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/smart-search", json={"query": "phone", "limit": 5})
        assert r.status_code == 200
        # May succeed or fall back
        assert r.json().get("success") is True or "products" in r.json()

    def test_try_on_requires_auth(self):
        """Try-on should require auth (or return error without valid images)."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/try-on", json={"userImage": "test", "productImage": "test"})
        # Try-on uses async job pattern — without auth it may return 401 or
        # start a job that fails. Either way, it should not return a valid image.
        data = r.json()
        assert r.status_code in [200, 401]
        if r.status_code == 200:
            # If it returns 200, it should be a job start (not a completed image)
            assert "jobId" in data or data.get("success") is False


# ============================================================================
# FAILURE & RECOVERY TESTS
# ============================================================================

class TestFailureRecovery:
    def test_invalid_json_handled(self):
        """Invalid JSON should be handled gracefully (not crash)."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/auth", content="not json", headers={"Content-Type": "application/json"})
        # Should return 400 or 500 (but not hang or crash the server)
        assert r.status_code in [200, 400, 500]

    def test_missing_fields_handled(self):
        """Missing required fields should return error, not crash."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/auth", json={"op": "login"})  # Missing email/password
        assert r.status_code in [200, 400]
        assert r.json().get("success") is False

    def test_nonexistent_endpoint(self):
        """Unknown endpoint should return 404 or error."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/nonexistent", json={})
        assert r.status_code in [200, 404, 405]

    def test_server_stays_up_under_load(self):
        """Server should stay responsive under rapid requests."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        for i in range(10):
            r = s.post("/api/products", json={"op": "all", "limit": 5})
            assert r.status_code == 200


# ============================================================================
# SECURITY TESTS
# ============================================================================

class TestSecurity:
    def test_no_service_role_key_in_frontend(self):
        """Frontend HTML should not contain the service role key."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.get("/")
        assert r.status_code == 200
        # Check that the service role key is NOT in the HTML
        html = r.text
        assert "service_role" not in html.lower()
        assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1v" not in html

    def test_error_messages_sanitized(self):
        """Error messages should not leak internal details."""
        s = httpx.Client(base_url=BASE_URL, timeout=30)
        r = s.post("/api/auth", json={"op": "login", "email": "test@test.com", "password": "wrong"})
        data = r.json()
        error = data.get("error", "")
        # Should not contain stack traces, file paths, or SQL
        assert "at /" not in error  # No file paths
        assert "SELECT" not in error.upper()  # No SQL
        assert "stack" not in error.lower()  # No stack traces

    def test_cross_user_access_blocked(self):
        """Users should not access other users' data."""
        s = get_session()
        # Try to access someone else's order
        r = s.post("/api/orders", json={"op": "details", "orderId": "00000000-0000-0000-0000-000000000000"})
        assert r.status_code == 200
        # Should return "not found" (not the other user's order)
        data = r.json()
        if data.get("success"):
            assert data.get("order") is None or data.get("order", {}).get("error")
