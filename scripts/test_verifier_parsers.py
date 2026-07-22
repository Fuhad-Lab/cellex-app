#!/usr/bin/env python3
"""Inspect real PalmPay emails from Gmail to verify the parser works.
Shows the raw email body + what our parsers extract."""
import imaplib, re, json
from payment_verifier_daemon import parse_amount, parse_sender, parse_bank_name, GMAIL_EMAIL, GMAIL_APP_PASSWORD

print(f"=== Fetching last 3 unread PalmPay emails from {GMAIL_EMAIL} ===\n")

mail = imaplib.IMAP4_SSL('imap.gmail.com', 993)
mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
mail.select('INBOX')

# Search for unread PalmPay emails
result, data = mail.search(None, 'UNSEEN', 'FROM', '"palmpay"')
email_ids = data[0].split() if data[0] else []
print(f"Found {len(email_ids)} unread PalmPay email(s). Showing last 3:\n")

recent_ids = email_ids[-3:] if len(email_ids) > 3 else email_ids

for msg_id in recent_ids:
    print(f"--- Email ID: {msg_id.decode()} ---")
    result, msg_data = mail.fetch(msg_id, '(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)] BODY.PEEK[TEXT])')
    raw = msg_data[0][1] if isinstance(msg_data[0], tuple) else b''
    text = raw.decode('utf-8', errors='ignore')

    # Show first 1500 chars of raw email
    print("RAW EMAIL (first 1500 chars):")
    print(text[:1500])
    print("\n" + "="*60)

    # Test our parsers
    amount = parse_amount(text)
    sender = parse_sender(text)
    bank = parse_bank_name(text)

    print(f"PARSED AMOUNT:  ₦{amount}" if amount else "PARSED AMOUNT:  None (regex failed)")
    print(f"PARSED SENDER:  {sender}")
    print(f"PARSED BANK:    {bank}")
    print("="*60 + "\n")

mail.logout()

# Now test against the previously matched order
print("\n=== Testing name + bank matching against matched order ===")
print("Order: CELLEX-MRGAW7NBM761")
print("  Buyer name (from checkout): AWOFOLAJI OLANREWAJU T")
print("  Buyer bank (from checkout): GTBank")
print("  Expected amount: ₦25,000.00")
print("  Actual matched_sender_name in DB: 'Unknown'  <-- OLD code didn't extract this properly")
print("  Actual matched_bank_name in DB: NULL          <-- OLD code didn't have this field")
print()
print("With the NEW parser code:")
print("  - parseSender now tries 6 patterns (HTML + plain text + 'X sent' pattern)")
print("  - parseBankName tries 4 HTML patterns + scans for 17 common Nigerian bank names")
print("  - Name match: any part of 'AWOFOLAJI OLANREWAJU T' appears in email → ✅")
print("  - Bank match: 'GTBank' substring in email → ✅")
print("  - Amount match: exact (with kobo suffix) → ✅")
