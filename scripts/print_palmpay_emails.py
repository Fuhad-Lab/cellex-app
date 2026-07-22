#!/usr/bin/env python3
"""Print the full body of a specific PalmPay email for debugging."""
import imaplib, sys

GMAIL_EMAIL = "fuhaddesmond7@gmail.com"
GMAIL_APP_PASSWORD = "mcvkgxktbfqzojlu"

mail = imaplib.IMAP4_SSL('imap.gmail.com', 993)
mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
mail.select('INBOX')

result, data = mail.search(None, 'UNSEEN', 'FROM', '"palmpay"')
email_ids = data[0].split() if data[0] else []

# Show the last 3 emails in full
for msg_id in email_ids[-3:]:
    print(f"\n{'='*80}\n--- Email ID: {msg_id.decode()} ---\n{'='*80}")
    result, msg_data = mail.fetch(msg_id, '(BODY.PEEK[TEXT])')
    raw = msg_data[0][1] if isinstance(msg_data[0], tuple) else b''
    text = raw.decode('utf-8', errors='ignore')
    print(text[:5000])

mail.logout()
