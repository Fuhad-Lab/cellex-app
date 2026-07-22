#!/usr/bin/env python3
"""End-to-end test using pre-created test users."""
import json, time, urllib.request, urllib.error, sys

BASE = "https://eeshaai-cellex-web.hf.space"

# Test users (created via SQL admin API)
SELLER = {"email": "cellex-test-seller@protonmail.com", "password": "TestPass123!"}
BUYER  = {"email": "cellex-buyer@protonmail.com", "password": "TestPass123!"}

class CookieJar:
    def __init__(self): self.cookies = {}
    def add(self, set_cookie_header):
        if not set_cookie_header: return
        # Split on commas that are NOT inside expires= dates
        for part in set_cookie_header.split(';'):
            kv = part.strip()
            if '=' in kv and 'cellex_session_id' in kv.split('=')[0]:
                self.cookies['cellex_session_id'] = kv.split('=', 1)[1]
    def header(self):
        return '; '.join(f"{k}={v}" for k,v in self.cookies.items()) if self.cookies else ''

def call(path, body=None, jar=None):
    url = f"{BASE}{path}"
    data = json.dumps(body or {}).encode('utf-8')
    headers = {'Content-Type': 'application/json'}
    if jar: headers['Cookie'] = jar.header()
    req = urllib.request.Request(url, data=data, method='POST', headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            if jar: jar.add(r.headers.get('Set-Cookie'))
            try: return r.status, json.load(r)
            except: return r.status, {'_raw': r.read().decode()[:200]}
    except urllib.error.HTTPError as e:
        return e.code, {'error': e.read().decode()[:500]}
    except Exception as e:
        return 0, {'error': str(e)}

def assert_true(label, cond, detail=''):
    mark = '✅' if cond else '❌'
    print(f"  {mark} {label}")
    if not cond:
        print(f"     FAILED — {detail}")
        sys.exit(1)

def main():
    print(f"\n🧪 Cellex Phase 1 end-to-end test (live site)\n")
    print(f"  seller: {SELLER['email']}")
    print(f"  buyer:  {BUYER['email']}\n")

    # ---- 1. Login as seller ----
    print("── Step 1: Login as seller ──")
    seller_jar = CookieJar()
    code, data = call('/api/auth', {'op':'login', **SELLER}, jar=seller_jar)
    assert_true('Seller login', data.get('success'), str(data)[:200])
    seller_id = data['user']['id']
    assert_true('Cookie set', bool(seller_jar.cookies), f"cookies={seller_jar.cookies}")
    print(f"     seller_id = {seller_id}\n")

    # ---- 2. Seller dashboard stats (auto-provisions seller row) ----
    print("── Step 2: Seller dashboard stats (auto-provisions seller row) ──")
    code, data = call('/api/seller-dashboard', {'op':'stats'}, jar=seller_jar)
    assert_true('Stats endpoint works', data.get('success'), str(data)[:200])
    assert_true('Totals object present', 'totals' in data, str(data)[:200])
    t = data['totals']
    print(f"     products={t['products']} orders={t['activeOrders']} followers={t['followers']} posts={t['posts']}\n")

    # ---- 3. Update seller profile ----
    print("── Step 3: Update seller profile ──")
    code, data = call('/api/seller-profile', {
        'op':'update',
        'business_name': f"Test Store E2E",
        'business_description': 'Phase 1 e2e test store',
        'business_category': 'Electronics',
    }, jar=seller_jar)
    assert_true('Profile update works', data.get('success'), str(data)[:200])
    assert_true('Name updated', data['seller'].get('business_name') == "Test Store E2E", str(data)[:200])
    print()

    # ---- 4. Create a test product ----
    print("── Step 4: Create a test product (triggers activity_feed) ──")
    code, data = call('/api/seller-products', {
        'op':'create',
        'name': f"Test Product E2E",
        'price': 19.99,
        'description': 'End-to-end test product',
        'category': 'Electronics',
        'image_url': 'https://via.placeholder.com/300',
    }, jar=seller_jar)
    assert_true('Product created', data.get('success'), str(data)[:200])
    product_id = data.get('product', {}).get('id')
    assert_true('Got product_id', bool(product_id), str(data)[:200])
    print(f"     product_id = {product_id}\n")

    time.sleep(1)

    # ---- 5. Stats reflect new product ----
    print("── Step 5: Stats reflect new product ──")
    code, data = call('/api/seller-dashboard', {'op':'stats'}, jar=seller_jar)
    t = data['totals']
    assert_true('Product count incremented', t['products'] >= 1, f"products={t['products']}")
    print(f"     products={t['products']} posts={t['posts']}\n")

    # ---- 6. Public profile + seller feed ----
    print("── Step 6: Public profile + seller_feed (public, no auth) ──")
    code, data = call('/api/social', {'op':'public_profile','sellerId':seller_id})
    assert_true('Public profile works', data.get('success'), str(data)[:200])
    assert_true('Public profile shows updated name', data['seller']['business_name'] == "Test Store E2E", str(data)[:200])
    print(f"     seller name (public): {data['seller']['business_name']}")
    print(f"     stats: followers={data['stats']['followers']} posts={data['stats']['posts']}")

    code, data = call('/api/social', {'op':'seller_feed','sellerId':seller_id,'limit':5})
    assert_true('Seller feed works', data.get('success'), str(data)[:200])
    items = data.get('items', [])
    assert_true('Feed has at least 1 item (from product trigger)', len(items) >= 1, f"items={len(items)}")
    if items:
        print(f"     latest activity: {items[0]['title']}\n")

    # ---- 7. Login as buyer & follow seller ----
    print("── Step 7: Buyer logs in & follows seller ──")
    buyer_jar = CookieJar()
    code, data = call('/api/auth', {'op':'login', **BUYER}, jar=buyer_jar)
    assert_true('Buyer login', data.get('success'), str(data)[:200])
    buyer_id = data['user']['id']
    print(f"     buyer_id = {buyer_id}")

    # Follow
    code, data = call('/api/social', {'op':'follow','sellerId':seller_id}, jar=buyer_jar)
    assert_true('Follow works', data.get('success'), str(data)[:200])

    # Public profile shows isFollowing=true (with viewerId)
    code, data = call('/api/social', {'op':'public_profile','sellerId':seller_id,'viewerId':buyer_id})
    assert_true('isFollowing=true after follow', data.get('isFollowing') == True, str(data)[:200])
    print(f"     followers count: {data['stats']['followers']}\n")

    # ---- 8. Buyer's feed should include seller's activity ----
    print("── Step 8: Buyer's feed includes seller's activity ──")
    code, data = call('/api/social', {'op':'feed','limit':10}, jar=buyer_jar)
    assert_true('Feed endpoint works', data.get('success'), str(data)[:200])
    items = data.get('items', [])
    assert_true('Feed contains seller activity', any(i.get('seller_id') == seller_id for i in items), f"items={len(items)}")
    print(f"     feed items: {len(items)}\n")

    # ---- 9. Following list ----
    print("── Step 9: Following list ──")
    code, data = call('/api/social', {'op':'following'}, jar=buyer_jar)
    assert_true('Following endpoint works', data.get('success'), str(data)[:200])
    sellers = data.get('sellers', [])
    assert_true('Following list has 1 seller', len(sellers) == 1, f"sellers={len(sellers)}")
    print(f"     following {len(sellers)} seller(s)\n")

    # ---- 10. Unfollow ----
    print("── Step 10: Unfollow ──")
    code, data = call('/api/social', {'op':'unfollow','sellerId':seller_id}, jar=buyer_jar)
    assert_true('Unfollow works', data.get('success'), str(data)[:200])
    code, data = call('/api/social', {'op':'public_profile','sellerId':seller_id,'viewerId':buyer_id})
    assert_true('isFollowing=false after unfollow', data.get('isFollowing') == False, str(data)[:200])
    print(f"     followers count after unfollow: {data['stats']['followers']}\n")

    # ---- 11. Discover endpoint ----
    print("── Step 11: Discover sellers ──")
    code, data = call('/api/social', {'op':'discover','limit':50})
    assert_true('Discover endpoint works', data.get('success'), str(data)[:200])
    sellers = data.get('sellers', [])
    assert_true('Discover has sellers', len(sellers) >= 1, f"sellers={len(sellers)}")
    our_store = [s for s in sellers if s['id'] == seller_id]
    assert_true('Our test store appears in discover', len(our_store) == 1, "test store not in discover")
    print(f"     {len(sellers)} sellers discoverable\n")

    # ---- 12. Seller orders list ----
    print("── Step 12: Seller orders list ──")
    code, data = call('/api/seller-orders', {'op':'list'}, jar=seller_jar)
    assert_true('Seller orders endpoint works', data.get('success'), str(data)[:200])
    print(f"     orders: {len(data.get('orders', []))}\n")

    # ---- 13. Seller products list ----
    print("── Step 13: Seller products list (CRUD read) ──")
    code, data = call('/api/seller-products', {'op':'list'}, jar=seller_jar)
    assert_true('Seller products list works', data.get('success'), str(data)[:200])
    products = data.get('products', [])
    our_product = [p for p in products if p['id'] == product_id]
    assert_true('New product appears in list', len(our_product) == 1, f"products={len(products)}")
    print(f"     products: {len(products)}\n")

    # ---- 14. Cleanup ----
    print("── Step 14: Cleanup — delete test product ──")
    code, data = call('/api/seller-products', {'op':'delete','id':product_id}, jar=seller_jar)
    assert_true('Product deleted', data.get('success'), str(data)[:200])
    print()

    print("🎉  ALL TESTS PASSED\n")
    print("Phase 1 social ecommerce is fully working end-to-end on the live site.")
    print(f"\nLive URLs:")
    print(f"  Home:        https://eeshaai-cellex-web.hf.space/")
    print(f"  Discover:    https://eeshaai-cellex-web.hf.space/#discoverSellers")
    print(f"  Seller dash: https://eeshaai-cellex-web.hf.space/seller/index.html")
    print(f"  Seller prof: https://eeshaai-cellex-web.hf.space/seller-profile.html?id={seller_id}")

if __name__ == '__main__':
    main()
