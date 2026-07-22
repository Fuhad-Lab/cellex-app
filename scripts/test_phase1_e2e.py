#!/usr/bin/env python3
"""End-to-end test of Cellex Phase 1 social ecommerce features.

Flow:
1. Sign up a new test user (or login if exists)
2. With session cookie, call seller-dashboard /stats (should auto-create seller row)
3. Create a test product via seller-products/create (should trigger activity_feed entry)
4. Verify stats reflect the new product
5. Verify the activity_feed entry shows up via /api/social seller_feed
6. Test follow/unfollow: sign up a 2nd user, follow the seller
7. Test the public_profile endpoint with viewerId
8. Test the discover endpoint
9. Cleanup test data
"""
import json, time, urllib.request, urllib.error, uuid, sys

BASE = "https://eeshaai-cellex-web.hf.space"
TS = int(time.time())
TEST_USER_1 = {"email": f"cellex-test-seller-{TS}@example.com", "password": "TestPass123!"}
TEST_USER_2 = {"email": f"cellex-test-buyer-{TS}@example.com",  "password": "TestPass123!"}

class CookieJar:
    def __init__(self): self.cookies = {}
    def add(self, set_cookie_header):
        if not set_cookie_header: return
        for part in set_cookie_header.split(','):
            for kv in part.split(';'):
                kv = kv.strip()
                if '=' in kv and not kv.lower().startswith(('expires','max-age','path','domain','secure','httponly','samesite')):
                    k,_,v = kv.partition('=')
                    if 'cellex_session_id' in k:
                        self.cookies['cellex_session_id'] = v
    def header(self):
        if not self.cookies: return ''
        return '; '.join(f"{k}={v}" for k,v in self.cookies.items())

def call(path, body=None, method='POST', jar=None, extra_headers=None):
    url = f"{BASE}{path}"
    data = json.dumps(body or {}).encode('utf-8')
    headers = {'Content-Type': 'application/json'}
    if jar: headers['Cookie'] = jar.header()
    if extra_headers: headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            sc = r.status
            body = r.read().decode()
            if jar: jar.add(r.headers.get('Set-Cookie'))
            try: parsed = json.loads(body)
            except: parsed = {'_raw': body}
            return sc, parsed
    except urllib.error.HTTPError as e:
        return e.code, {'error': e.read().decode()[:500]}
    except Exception as e:
        return 0, {'error': str(e)}

def assert_true(label, cond, detail=''):
    mark = '✅' if cond else '❌'
    print(f"  {mark} {label}" + (f"  ({detail})" if detail and not cond else ''))
    if not cond:
        print(f"     FAILED — {detail}")
        sys.exit(1)

def main():
    print(f"\n🧪 Cellex Phase 1 end-to-end test\n")
    print(f"  Test users:")
    print(f"    seller: {TEST_USER_1['email']}")
    print(f"    buyer:  {TEST_USER_2['email']}\n")

    # ---------- 1. Sign up seller ----------
    print("── Step 1: Sign up seller ──")
    seller_jar = CookieJar()
    code, data = call('/api/auth', {'op':'signup', **TEST_USER_1}, jar=seller_jar)
    if code == 400 and 'already' in str(data).lower():
        # already exists — login instead
        code, data = call('/api/auth', {'op':'login', **TEST_USER_1}, jar=seller_jar)
    assert_true('Signup/login seller', data.get('success'), str(data)[:200])
    seller_user = data.get('user', {})
    seller_id = seller_user.get('id')
    assert_true('Got seller_id', bool(seller_id), f"user={seller_user}")
    print(f"     seller_id = {seller_id}")
    print(f"     cookie    = {seller_jar.header()[:50]}...\n")

    # ---------- 2. Seller dashboard stats (auto-provisions seller row) ----------
    print("── Step 2: Seller dashboard stats (auto-provisions seller row) ──")
    code, data = call('/api/seller-dashboard', {'op':'stats'}, jar=seller_jar)
    assert_true('Stats endpoint works', data.get('success'), str(data)[:200])
    assert_true('Totals object present', 'totals' in data, str(data)[:200])
    t = data['totals']
    print(f"     products={t['products']} orders={t['activeOrders']} followers={t['followers']} posts={t['posts']}\n")

    # ---------- 3. Seller profile get ----------
    print("── Step 3: Seller profile get ──")
    code, data = call('/api/seller-profile', {'op':'get'}, jar=seller_jar)
    assert_true('Profile get works', data.get('success'), str(data)[:200])
    assert_true('Seller row exists', data.get('seller') is not None, str(data)[:200])
    print(f"     business_name = {data['seller'].get('business_name')}\n")

    # ---------- 4. Update seller profile ----------
    print("── Step 4: Update seller profile ──")
    code, data = call('/api/seller-profile', {
        'op':'update',
        'business_name': f"Test Store {TS}",
        'business_description': 'Phase 1 test store — will be cleaned up',
        'business_category': 'Electronics',
    }, jar=seller_jar)
    assert_true('Profile update works', data.get('success'), str(data)[:200])
    assert_true('Name updated', data['seller'].get('business_name') == f"Test Store {TS}", str(data)[:200])
    print()

    # ---------- 5. Create a test product (should also post to activity_feed) ----------
    print("── Step 5: Create a test product (triggers activity_feed) ──")
    code, data = call('/api/seller-products', {
        'op':'create',
        'name': f"Test Product {TS}",
        'price': 19.99,
        'description': 'End-to-end test product — will be cleaned up',
        'category': 'Electronics',
        'image_url': 'https://via.placeholder.com/300',
    }, jar=seller_jar)
    assert_true('Product created', data.get('success'), str(data)[:200])
    product_id = data.get('product', {}).get('id')
    assert_true('Got product_id', bool(product_id), str(data)[:200])
    print(f"     product_id = {product_id}\n")

    # Wait a moment for the trigger to fire
    time.sleep(1)

    # ---------- 6. Re-check stats — should now show 1 product ----------
    print("── Step 6: Stats now reflect the new product ──")
    code, data = call('/api/seller-dashboard', {'op':'stats'}, jar=seller_jar)
    t = data['totals']
    assert_true('Product count incremented', t['products'] >= 1, f"products={t['products']}")
    print(f"     products={t['products']} posts={t['posts']}\n")

    # ---------- 7. Public profile + seller feed (public, no auth) ----------
    print("── Step 7: Public profile + seller_feed ──")
    code, data = call('/api/social', {'op':'public_profile','sellerId':seller_id})
    assert_true('Public profile works', data.get('success'), str(data)[:200])
    assert_true('Public profile shows updated name', data['seller']['business_name'] == f"Test Store {TS}", str(data)[:200])
    print(f"     seller name (public): {data['seller']['business_name']}")
    print(f"     stats: followers={data['stats']['followers']} posts={data['stats']['posts']}")

    code, data = call('/api/social', {'op':'seller_feed','sellerId':seller_id,'limit':5})
    assert_true('Seller feed works', data.get('success'), str(data)[:200])
    items = data.get('items', [])
    assert_true('Feed has at least 1 item (from product trigger)', len(items) >= 1, f"items={len(items)}")
    if items:
        print(f"     latest activity: {items[0]['title']}\n")

    # ---------- 8. Sign up buyer, follow seller ----------
    print("── Step 8: Buyer signs up & follows seller ──")
    buyer_jar = CookieJar()
    code, data = call('/api/auth', {'op':'signup', **TEST_USER_2}, jar=buyer_jar)
    if code == 400 and 'already' in str(data).lower():
        code, data = call('/api/auth', {'op':'login', **TEST_USER_2}, jar=buyer_jar)
    assert_true('Signup/login buyer', data.get('success'), str(data)[:200])
    buyer_id = data['user']['id']
    print(f"     buyer_id = {buyer_id}")

    # Follow
    code, data = call('/api/social', {'op':'follow','sellerId':seller_id}, jar=buyer_jar)
    assert_true('Follow works', data.get('success'), str(data)[:200])

    # Public profile now shows isFollowing=true (with viewerId)
    code, data = call('/api/social', {'op':'public_profile','sellerId':seller_id,'viewerId':buyer_id})
    assert_true('isFollowing=true after follow', data.get('isFollowing') == True, str(data)[:200])

    # Follower count incremented
    print(f"     followers count: {data['stats']['followers']}\n")

    # ---------- 9. Buyer's feed should include seller's activity ----------
    print("── Step 9: Buyer's feed includes seller's activity ──")
    code, data = call('/api/social', {'op':'feed','limit':10}, jar=buyer_jar)
    assert_true('Feed endpoint works', data.get('success'), str(data)[:200])
    items = data.get('items', [])
    assert_true('Feed contains seller activity', any(i.get('seller_id') == seller_id for i in items), f"items={len(items)}")
    print(f"     feed items: {len(items)}\n")

    # ---------- 10. Following list ----------
    print("── Step 10: Following list ──")
    code, data = call('/api/social', {'op':'following'}, jar=buyer_jar)
    assert_true('Following endpoint works', data.get('success'), str(data)[:200])
    sellers = data.get('sellers', [])
    assert_true('Following list has 1 seller', len(sellers) == 1, f"sellers={len(sellers)}")
    print(f"     following {len(sellers)} seller(s)\n")

    # ---------- 11. Unfollow ----------
    print("── Step 11: Unfollow ──")
    code, data = call('/api/social', {'op':'unfollow','sellerId':seller_id}, jar=buyer_jar)
    assert_true('Unfollow works', data.get('success'), str(data)[:200])
    code, data = call('/api/social', {'op':'public_profile','sellerId':seller_id,'viewerId':buyer_id})
    assert_true('isFollowing=false after unfollow', data.get('isFollowing') == False, str(data)[:200])
    print(f"     followers count after unfollow: {data['stats']['followers']}\n")

    # ---------- 12. Discover endpoint ----------
    print("── Step 12: Discover sellers ──")
    code, data = call('/api/social', {'op':'discover','limit':20})
    assert_true('Discover endpoint works', data.get('success'), str(data)[:200])
    sellers = data.get('sellers', [])
    assert_true('Discover has sellers', len(sellers) >= 1, f"sellers={len(sellers)}")
    our_store = [s for s in sellers if s['id'] == seller_id]
    assert_true('Our test store appears in discover', len(our_store) == 1, "test store not in discover")
    print(f"     {len(sellers)} sellers discoverable\n")

    # ---------- 13. Seller orders list ----------
    print("── Step 13: Seller orders list ──")
    code, data = call('/api/seller-orders', {'op':'list'}, jar=seller_jar)
    assert_true('Seller orders endpoint works', data.get('success'), str(data)[:200])
    print(f"     orders: {len(data.get('orders', []))}\n")

    # ---------- 14. Cleanup — delete test product ----------
    print("── Step 14: Cleanup — delete test product ──")
    code, data = call('/api/seller-products', {'op':'delete','id':product_id}, jar=seller_jar)
    assert_true('Product deleted', data.get('success'), str(data)[:200])
    print()

    print("🎉  ALL TESTS PASSED\n")
    print("Phase 1 social ecommerce is fully working end-to-end.")
    print(f"\nTest users (auto-generated, safe to ignore):")
    print(f"  seller: {TEST_USER_1['email']}")
    print(f"  buyer:  {TEST_USER_2['email']}")

if __name__ == '__main__':
    main()
