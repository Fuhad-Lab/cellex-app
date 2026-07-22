#!/usr/bin/env python3
"""Payment Verifier — polls Gmail for PalmPay emails and matches against pending orders.
Runs as a background process (can be deployed as a Render cron job or HF Space background task)."""
import imaplib, re, json, urllib.request, time, sys

GMAIL_EMAIL = "fuhaddesmond7@gmail.com"
GMAIL_APP_PASSWORD = "mcvkgxktbfqzojlu"
SUPABASE_TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"
SUPABASE_URL = "https://tcwdbokruvlizkxcpkzj.supabase.co"

def sql(query):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, method='POST',
        headers={"Authorization": f"Bearer {SUPABASE_TOKEN}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Chrome/126.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def parse_amount(text):
    for pattern in [r'NGN\s*([\d,]+\.?\d*)', r'₦\s*([\d,]+\.?\d*)', r'received.*?₦?\s*([\d,]+\.?\d*)']:
        m = re.search(pattern, text, re.I)
        if m:
            try:
                return round(float(m.group(1).replace(',', '')), 2)
            except: pass
    return None

def parse_sender(text):
    m = re.search(r'Sender[:\s]*</strong>\s*([^<\n]+)', text, re.I)
    if m: return m.group(1).strip()
    m = re.search(r'From[:\s]*(.+)', text, re.I)
    if m: return m.group(1).strip()
    return 'Unknown'

def check_gmail():
    """Check Gmail for unread PalmPay emails and match against pending orders."""
    # Get all awaiting_verification orders
    orders = sql("SELECT order_id, expected_amount, buyer_name, buyer_bank_name FROM payment_orders WHERE status = 'awaiting_verification';")
    if not orders:
        print("No orders awaiting verification")
        return

    print(f"Found {len(orders)} orders awaiting verification")

    # Connect to Gmail
    mail = imaplib.IMAP4_SSL('imap.gmail.com', 993)
    mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
    mail.select('INBOX')

    # Search for unread PalmPay emails
    result, data = mail.search(None, 'UNSEEN', 'FROM', '"palmpay"')
    email_ids = data[0].split()
    print(f"Found {len(email_ids)} unread PalmPay emails")

    # Get the last 10 (most recent)
    recent_ids = email_ids[-10:] if len(email_ids) > 10 else email_ids

    for msg_id in recent_ids:
        result, msg_data = mail.fetch(msg_id, '(BODY.PEEK[TEXT])')
        raw = msg_data[0][1] if isinstance(msg_data[0], tuple) else b''
        text = raw.decode('utf-8', errors='ignore')

        amount = parse_amount(text)
        sender = parse_sender(text)
        print(f"  Email {msg_id.decode()}: amount=₦{amount}, sender={sender}")

        if amount is None:
            continue

        # Match against pending orders
        for order in orders:
            expected = float(order['expected_amount'])
            if abs(amount - expected) < 0.01:
                # Check if email already used
                email_uid = f"INBOX:{msg_id.decode()}"
                used = sql(f"SELECT id FROM payment_orders WHERE matched_email_id = '{email_uid}';")
                if used:
                    print(f"    Email already used — skipping")
                    continue

                # MATCH! Update the order
                print(f"    ✅ MATCH! Order {order['order_id']} — ₦{amount} from {sender}")
                sql(f"UPDATE payment_orders SET status = 'matched', matched_at = now(), matched_email_id = '{email_uid}', matched_sender_name = '{sender}', matched_amount = {amount}, updated_at = now() WHERE order_id = '{order['order_id']}';")

                # Mark email as read
                mail.store(msg_id, '+FLAGS', '\\Seen')
                print(f"    Email marked as read")

    mail.logout()

if __name__ == '__main__':
    print("=== Payment Verifier ===")
    check_gmail()
    print("=== Done ===")
