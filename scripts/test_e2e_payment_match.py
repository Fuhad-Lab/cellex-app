#!/usr/bin/env python3
"""End-to-end payment verification test:
1. Create a test payment_order with a buyer name + bank that matches a REAL PalmPay email
2. Run the verifier daemon once
3. Confirm the order got matched with correct sender_name + bank_name + amount
4. Cleanup
"""
import json, time, urllib.request, urllib.error, sys

# Reuse helpers from the daemon
sys.path.insert(0, '/home/z/my-project/scripts')
from payment_verifier_daemon import (
    sql, escape_sql, fetch_recent_palmpay_emails, parse_amount, parse_sender, parse_bank_name,
    name_matches, bank_matches, run_cycle,
)
SUPABASE_URL = "https://tcwdbokruvlizkxcpkzj.supabase.co"

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDEwOTI2NCwiZXhwIjoyMDc1Njg1MjY0fQ.t_TcbBV5k5WWk_bBMoKV-lkAIr9EI-zcREahQqVc39M"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjd2Rib2tydXVsaXpreGNwa3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMDkyNjQsImV4cCI6MjA3NTY4NTI2NH0.p871FXUakrWQ7PhhZr8Ly2BxLOhwQjRJiDGd59wAhyg"
PAYMENT_EDGE = f"{SUPABASE_URL}/functions/v1/payment"

print("=== Step 1: Fetch recent PalmPay emails and pick one to match ===")
emails = fetch_recent_palmpay_emails()
print(f"Got {len(emails)} emails")

# Find a received-transfer email (has "Sender:" pattern) with a clear amount
target_email = None
for e in emails:
    text = e['text']
    amount = parse_amount(text)
    sender = parse_sender(text)
    bank = parse_bank_name(text)
    if amount and sender != 'Unknown' and bank:
        target_email = {
            'msgId': e['msgId'],
            'text': text,
            'amount': amount,
            'sender': sender,
            'bank': bank,
        }
        break

if not target_email:
    print("✗ No suitable email found for matching test")
    sys.exit(1)

print(f"\n✓ Selected target email (msgId: {target_email['msgId']}):")
print(f"  Amount: ₦{target_email['amount']:.2f}")
print(f"  Sender: {target_email['sender']}")
print(f"  Bank:   {target_email['bank']}")

# Get first 2 words of sender as buyer name (to test partial name matching)
sender_parts = target_email['sender'].split()
buyer_name = ' '.join(sender_parts[:2]) if len(sender_parts) >= 2 else target_email['sender']
buyer_bank = target_email['bank']

print(f"\n=== Step 2: Create test order matching this email ===")
print(f"  Buyer name (partial): {buyer_name}")
print(f"  Buyer bank: {buyer_bank}")
print(f"  Expected amount: ₦{target_email['amount']:.2f}  (exact, no kobo suffix)")

order_id = f"CELLEX-E2E-TEST-{int(time.time())}"
print(f"  Order ID: {order_id}")

# Insert the order directly via SQL API
result = sql(f"""
    INSERT INTO payment_orders
        (order_id, buyer_email, buyer_name, buyer_phone, buyer_bank_name,
         expected_amount, currency, items_summary, item_count, status,
         verification_started_at, expires_at, created_at, updated_at)
    VALUES
        ({escape_sql(order_id)}, 'e2e@test.com', {escape_sql(buyer_name)}, '08012345678',
         {escape_sql(buyer_bank)}, {target_email['amount']}, 'NGN', 'E2E test', 1,
         'awaiting_verification', now(), now() + interval '30 minutes', now(), now())
    RETURNING order_id, status;
""")
print(f"\n✓ Order created: {result}")

print(f"\n=== Step 3: Run one verification cycle ===")
# Mark the target email as UNREAD so the daemon will fetch it
# (it might already be read from our previous test, but we use UNSEEN search)
import imaplib
mail = imaplib.IMAP4_SSL('imap.gmail.com', 993)
mail.login("fuhaddesmond7@gmail.com", "mcvkgxktbfqzojlu")
mail.select('INBOX')
# Mark our target email as unread
mail.store(target_email['msgId'].encode(), '-FLAGS', '\\Seen')
print(f"✓ Marked email {target_email['msgId']} as unread for the verifier to find")
mail.logout()

# Run one cycle
print(f"\n--- Verifier cycle output ---")
matched = run_cycle(verbose=True)

print(f"\n=== Step 4: Verify the order was matched ===")
result = sql(f"""
    SELECT order_id, status, expected_amount, buyer_name, buyer_bank_name,
           matched_sender_name, matched_bank_name, matched_amount, matched_email_id
    FROM payment_orders
    WHERE order_id = {escape_sql(order_id)};
""")
print(json.dumps(result, indent=2))

if result and result[0].get('status') == 'matched':
    print("\n✅✅✅ E2E MATCH SUCCESSFUL! ✅✅✅")
    print(f"   Order {order_id} was matched:")
    print(f"   - Expected ₦{target_email['amount']:.2f} from '{buyer_name}' (bank: {buyer_bank})")
    print(f"   - Matched: ₦{result[0]['matched_amount']} from '{result[0]['matched_sender_name']}' (bank: {result[0]['matched_bank_name']})")
    print(f"   - Email ID: {result[0]['matched_email_id']}")
else:
    print(f"\n⚠ Order did NOT match. Status: {result[0].get('status') if result else 'unknown'}")
    print(f"   (Likely because the email was already used by a previous matched order)")

print(f"\n=== Step 5: Cleanup — cancel the test order ===")
sql(f"UPDATE payment_orders SET status='cancelled', updated_at=now() WHERE order_id={escape_sql(order_id)};")
print(f"✓ Test order cancelled")
