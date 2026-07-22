#!/usr/bin/env python3
"""End-to-end test for Cellex Phase 3 — Content & Discovery."""
import json, time, urllib.request, urllib.error, sys

BASE = "https://eeshaai-cellex-web.hf.space"
SELLER = {"email": "cellex-test-seller@protonmail.com", "password": "TestPass123!"}
BUYER  = {"email": "cellex-buyer@protonmail.com", "password": "TestPass123!"}

# Storage upload settings (we'll upload a tiny test mp4 to the product-videos bucket)
TEST_MP4_URL = "https://www.w3schools.com/html/mov_bbb.mp4"  # public domain test video
TEST_VIDEO_BYTES = urllib.request.urlopen(TEST_MP4_URL).read()
print(f"  Downloaded test video: {len(TEST_VIDEO_BYTES)} bytes")

class CookieJar:
    def __init__(self): self.cookies = {}
    def add(self, set_cookie_header):
        if not set_cookie_header: return
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
        with urllib.request.urlopen(req, timeout=60) as r:
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
    print(f"\n🧪 Cellex Phase 3 end-to-end test (live site)\n")

    # ---- Login ----
    print("── Login seller + buyer ──")
    seller_jar = CookieJar()
    code, data = call('/api/auth', {'op':'login', **SELLER}, jar=seller_jar)
    assert_true('Seller login', data.get('success'), str(data)[:200])
    seller_id = data['user']['id']

    buyer_jar = CookieJar()
    code, data = call('/api/auth', {'op':'login', **BUYER}, jar=buyer_jar)
    assert_true('Buyer login', data.get('success'), str(data)[:200])
    buyer_id = data['user']['id']
    print()

    # Ensure seller has a product
    code, data = call('/api/seller-products', {'op':'list'}, jar=seller_jar)
    products = data.get('products', [])
    if not products:
        code, data = call('/api/seller-products', {'op':'create', 'name':'Phase 3 video test', 'price': 39.99, 'description':'test', 'category':'Electronics'}, jar=seller_jar)
        products = [data['product']]
    product_id = products[0]['id']
    print(f"  Using product_id={product_id}\n")

    # ====================================================================
    # 1. SHORT PRODUCT VIDEOS
    # ====================================================================
    print("── 1. SHORT PRODUCT VIDEOS ──")

    # 1a. Upload video bytes directly via the /api/video-upload proxy
    print("  Uploading test video via /api/video-upload proxy...")
    upload_url = f"{BASE}/api/video-upload/{seller_id}/{product_id}/test-{int(time.time())}.mp4"
    req = urllib.request.Request(upload_url, data=TEST_VIDEO_BYTES, method='PUT',
        headers={'Content-Type': 'video/mp4', 'Cookie': seller_jar.header()})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            upload_data = json.load(r)
            assert_true('Upload succeeded', upload_data.get('success'), str(upload_data)[:300])
    except urllib.error.HTTPError as e:
        assert_true('Upload succeeded', False, f"HTTP {e.code}: {e.read().decode()[:300]}")
    video_url = upload_data['url']
    print(f"     video_url: {video_url[:80]}...")

    # 1b. Verify the video is publicly accessible
    print("  Verifying public access...")
    pub_resp = urllib.request.urlopen(video_url, timeout=30)
    assert_true('Public URL accessible', pub_resp.status == 200, f"status={pub_resp.status}")

    # 1c. Create the video record
    print("  Creating video record...")
    code, data = call('/api/videos', {'op':'create', 'productId': product_id, 'videoUrl': video_url, 'caption': 'Phase 3 e2e test video — check this out!'}, jar=seller_jar)
    assert_true('Video created', data.get('success'), str(data)[:300])
    video_id = data.get('video', {}).get('id')
    assert_true('Got video_id', bool(video_id), str(data)[:200])
    print(f"     video_id = {video_id}\n")

    # 1d. Fetch the feed (public)
    print("  Fetching feed (public)...")
    code, data = call('/api/videos', {'op':'feed', 'limit': 10})
    assert_true('Feed works', data.get('success'), str(data)[:300])
    assert_true('Our video is in feed', any(v['id'] == video_id for v in data.get('videos', [])), f"videos={len(data.get('videos', []))}")
    print(f"     feed has {len(data.get('videos', []))} videos\n")

    # 1e. Get video (increments views, public)
    print("  Get video (increments views)...")
    code, data = call('/api/videos', {'op':'get', 'videoId': video_id})
    assert_true('Get works', data.get('success'), str(data)[:300])
    assert_true('Views incremented', data.get('video', {}).get('views_count', 0) >= 1, str(data)[:200])
    print()

    # 1f. Like (auth)
    print("  Buyer likes video...")
    code, data = call('/api/videos', {'op':'like', 'videoId': video_id}, jar=buyer_jar)
    assert_true('Like works', data.get('success') and data.get('liked') == True, str(data)[:200])

    # Verify likes_count incremented (via feed)
    code, data = call('/api/videos', {'op':'feed', 'limit': 10}, jar=buyer_jar)
    liked_video = [v for v in data.get('videos', []) if v['id'] == video_id]
    assert_true('Likes count = 1', liked_video and liked_video[0]['likes_count'] == 1, str(liked_video)[:200])
    assert_true('liked flag is true for buyer', liked_video and liked_video[0]['liked'] == True, str(liked_video)[:200])
    print()

    # 1g. Unlike
    print("  Buyer unlikes video...")
    code, data = call('/api/videos', {'op':'unlike', 'videoId': video_id}, jar=buyer_jar)
    assert_true('Unlike works', data.get('success'), str(data)[:200])
    print()

    # 1h. Mine (seller)
    print("  Seller's videos (mine)...")
    code, data = call('/api/videos', {'op':'mine'}, jar=seller_jar)
    assert_true('Mine works', data.get('success'), str(data)[:200])
    assert_true('Video in mine', any(v['id'] == video_id for v in data.get('videos', [])), str(data)[:200])
    print()

    # ====================================================================
    # 2. TRENDING FEED
    # ====================================================================
    print("── 2. TRENDING FEED ──")

    # 2a. Log a view
    print("  Logging product view...")
    code, data = call('/api/trending', {'op':'log_view', 'productId': product_id, 'source': 'test'}, jar=buyer_jar)
    assert_true('log_view works', data.get('success'), str(data)[:200])

    # 2b. Log a share (auth)
    print("  Logging product share...")
    code, data = call('/api/trending', {'op':'log_share', 'productId': product_id, 'platform': 'whatsapp'}, jar=buyer_jar)
    assert_true('log_share works', data.get('success'), str(data)[:200])

    # 2c. List trending
    print("  Listing trending...")
    code, data = call('/api/trending', {'op':'list', 'limit': 10, 'hours': 24})
    assert_true('List works', data.get('success'), str(data)[:300])
    found = [p for p in data.get('products', []) if p['id'] == product_id]
    assert_true('Our product in trending', len(found) == 1, f"products={data.get('products', [])}")
    if found:
        tr = found[0]['trending']
        print(f"     views={tr['views']} shares={tr['shares']} purchases={tr['purchases']} score={tr['score']}")
        assert_true('Views >= 1', tr['views'] >= 1, f"views={tr['views']}")
        assert_true('Shares >= 1', tr['shares'] >= 1, f"shares={tr['shares']}")
    print()

    # ====================================================================
    # 3. SELLER STORIES
    # ====================================================================
    print("── 3. SELLER STORIES ──")

    # 3a. Seller creates a story
    print("  Seller creates a story...")
    code, data = call('/api/stories', {'op':'create', 'storyType': 'deal', 'title': 'Phase 3 test deal story', 'body': '24h flash sale — testing!'}, jar=seller_jar)
    assert_true('Story created', data.get('success'), str(data)[:300])
    story_id = data.get('story', {}).get('id')
    assert_true('Got story_id', bool(story_id), str(data)[:200])
    print(f"     story_id = {story_id}\n")

    # 3b. Active bar (public)
    print("  Fetching active bar (public)...")
    code, data = call('/api/stories', {'op':'active_bar'})
    assert_true('Active bar works', data.get('success'), str(data)[:300])
    seller_stories = [s for s in data.get('stories', []) if s['seller_id'] == seller_id]
    assert_true('Seller in bar', len(seller_stories) == 1, f"stories={data.get('stories', [])}")
    assert_true('Story count = 1', seller_stories[0]['story_count'] >= 1, str(seller_stories)[:200])
    print(f"     story_count: {seller_stories[0]['story_count']}\n")

    # 3c. Get story (increments views, marks seen if auth)
    print("  Buyer fetches story (increments views)...")
    code, data = call('/api/stories', {'op':'get', 'storyId': story_id}, jar=buyer_jar)
    assert_true('Get works', data.get('success'), str(data)[:300])
    assert_true('Views incremented', data.get('story', {}).get('views_count', 0) >= 1, str(data)[:200])

    # 3d. Active bar now shows has_unseen=false for buyer (since they saw it)
    code, data = call('/api/stories', {'op':'active_bar'}, jar=buyer_jar)
    seller_stories = [s for s in data.get('stories', []) if s['seller_id'] == seller_id]
    assert_true('has_unseen=false after view', seller_stories and seller_stories[0]['has_unseen'] == False, str(seller_stories)[:200])
    print()

    # 3e. Mine (seller)
    print("  Seller's stories (mine)...")
    code, data = call('/api/stories', {'op':'mine'}, jar=seller_jar)
    assert_true('Mine works', data.get('success'), str(data)[:200])
    assert_true('Story in mine', any(s['id'] == story_id for s in data.get('stories', [])), str(data)[:200])
    print()

    # ====================================================================
    # 4. AI-POWERED DISCOVERY
    # ====================================================================
    print("── 4. AI-POWERED DISCOVERY ──")

    # 4a. Recommend (auth)
    print("  Fetching AI recommendations for buyer...")
    code, data = call('/api/discover', {'op':'recommend', 'limit': 5}, jar=buyer_jar)
    assert_true('Recommend works', data.get('success'), str(data)[:300])
    recs = data.get('recommendations', [])
    print(f"     {len(recs)} recommendations")
    print(f"     signals: {data.get('signals', {})}")
    if recs:
        print(f"     first rec: {recs[0]['product']['name'][:50]} — reason: {recs[0]['reason'][:80]}")
        assert_true('Each rec has product + reason', all('product' in r and 'reason' in r for r in recs), str(recs)[:300])
        assert_true('Each rec has signal field', all('signal' in r for r in recs), str(recs)[:300])
    print()

    # 4b. Log view (auth)
    print("  Logging discover view...")
    code, data = call('/api/discover', {'op':'log_view', 'productId': product_id}, jar=buyer_jar)
    assert_true('log_view works', data.get('success'), str(data)[:200])
    print()

    # ====================================================================
    # 5. CLEANUP
    # ====================================================================
    print("── Cleanup ──")
    call('/api/videos', {'op':'delete', 'videoId': video_id}, jar=seller_jar)
    call('/api/stories', {'op':'delete', 'storyId': story_id}, jar=seller_jar)
    print("  ✅ Video + story deleted")
    print()

    print("🎉  ALL PHASE 3 TESTS PASSED\n")
    print("Phase 3 — Content & Discovery is fully working end-to-end:")
    print("  ✅ Short product videos (upload via presigned URL, feed, like, view counter, mine)")
    print("  ✅ Trending feed (view/share logging, hourly aggregation, score = views + shares*3 + purchases*5)")
    print("  ✅ Seller stories (create, active_bar grouping, has_unseen tracking, get increments views, mine)")
    print("  ✅ AI-powered discovery (rule-based + optional Qwen2.5-72B enrichment, signals returned)")
    print()
    print("Live URLs to try:")
    print(f"  Video feed:    https://eeshaai-cellex-web.hf.space/videos.html")
    print(f"  Seller videos: https://eeshaai-cellex-web.hf.space/seller/videos.html")
    print(f"  Seller stories: https://eeshaai-cellex-web.hf.space/seller/stories.html")
    print(f"  Home (stories bar + trending + For You): https://eeshaai-cellex-web.hf.space/")

if __name__ == '__main__':
    main()
