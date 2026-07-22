#!/usr/bin/env python3
"""Cellex Payment Verifier — daemon that polls Gmail for PalmPay emails
and matches them against awaiting_verification orders.

Architecture:
  - Reads awaiting_verification orders from Supabase via SQL API
  - Connects to Gmail via IMAP directly (no timeout limit)
  - Matches emails on: amount (exact, with kobo suffix) + buyer name (fuzzy) + bank name (fuzzy)
  - Falls back to AI matching via Qwen2.5-72B if regex parsing fails
  - Updates order status to 'matched' in Supabase via SQL API
  - Marks matched emails as read in Gmail

The edge function's check_status op just reads DB status — fast.
This daemon polls every 15-30s and does the heavy lifting.

Run as a background process:
    python3 payment_verifier_daemon.py [--once] [--interval 15]
"""
import argparse, json, time, sys, re, imaplib, email, urllib.request, urllib.error
from email.header import decode_header

# === Config ===
GMAIL_EMAIL = "fuhaddesmond7@gmail.com"
GMAIL_APP_PASSWORD = "mcvkgxktbfqzojlu"
SUPABASE_TOKEN = "sbp_a04450c740a3b13382cf1b042b226126baa5d2d7"
PROJECT = "tcwdbokruvlizkxcpkzj"

# AI fallback (Qwen2.5-72B via HF Inference Router)
HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"
HF_TOKEN = "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"
HF_MODEL = "Qwen/Qwen2.5-72B-Instruct"


# ============================================================
# Supabase SQL API helper
# ============================================================
def sql(query: str):
    url = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
    data = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method='POST',
        headers={
            "Authorization": f"Bearer {SUPABASE_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Chrome/126.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode(), "status": e.code}


def escape_sql(s: str) -> str:
    """Escape a string for safe SQL insertion."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


# ============================================================
# Email parsers
# ============================================================
def parse_amount(text: str) -> float | None:
    """Extract transfer amount from PalmPay email body."""
    patterns = [
        r'NGN\s*([\d,]+\.?\d*)',
        r'₦\s*([\d,]+\.?\d*)',
        r'Amount[:\s]*₦?\s*([\d,]+\.?\d*)',
        r'received.*?₦?\s*([\d,]+\.?\d*)',
        r'transfer.*?₦?\s*([\d,]+\.?\d*)',
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            try:
                a = float(m.group(1).replace(',', ''))
                if a > 0:
                    return round(a, 2)
            except (ValueError, TypeError):
                pass
    return None


def parse_sender(text: str) -> str:
    """Extract sender name from PalmPay email.

    PalmPay email formats seen in production:
      Received: "Sender:</strong> TESLIM FERNANDEZ ABDLRAZAQ"
      Sent (POS): "POS Transfer-ZAINAB HASSAN ADAMU"
      Sent (regular): "Receipt:\\n<name>\\n<bank> <account>"
    """
    patterns = [
        # Received: HTML table with "Sender:" label
        r'Sender[:\s]*</strong>\s*([^<\n]+)',
        r'Sender\s*Name[:\s]*</strong>\s*([^<\n]+)',
        r'Sender[:\s]*</span>\s*</td>\s*<td[^>]*>\s*<span[^>]*><strong>([^<\n]+)',
        # Received: simpler HTML variants
        r'Sender[:\s]*</strong>\s*([A-Z][A-Za-z\s]+)',
        # Received: plain text
        r'Sender[:\s]*([A-Z][A-Za-z\s]+)',
        # Sent: "POS Transfer-NAME" pattern
        r'POS\s+Transfer[-:]?\s*([A-Z][A-Z\s]+)',
        # Sent: "Transfer from NAME" (also in remark)
        r'Transfer\s+from\s+([A-Z][A-Z\s]+)',
        # Receipt block: "Receipt:" then next line is the sender name
        r'Receipt[:\s]*</p>\s*<p[^>]*>([^<\n]+)',
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m and m.group(1):
            name = m.group(1).strip()
            # Strip trailing punctuation/HTML
            name = re.sub(r'[\s,;]+$', '', name)
            # Filter out obvious non-names
            if name.lower() in ('balance', 'unknown', ''):
                continue
            if len(name) < 2:
                continue
            return name
    return 'Unknown'


def parse_bank_name(text: str) -> str | None:
    """Extract sender's bank name from PalmPay email.

    PalmPay email formats seen in production:
      Received: "OPay | 911****850"  (sender's bank + masked account)
      Sent (POS): "Moniepoint 5256858248"  (bank name + account, separate line)
    """
    # HTML pattern: bank name appears right after sender row, often with "|" separator
    patterns = [
        r'<strong>\s*([A-Z][A-Za-z]+(?:Bank|Pay|point)?)\s*\|\s*\d+\*+',
        r'<strong>\s*(OPay|Moniepoint|GTBank|Access\s*Bank|Zenith|UBA|First\s*Bank|Kuda|PalmPay|Stanbic|Wema|Fidelity|Union\s*Bank|Sterling|Polaris|EcoBank|FCMB)\s*\|',
        r'Bank[:\s]*</strong>\s*([^<\n]+)',
        r'Bank\s*Name[:\s]*</strong>\s*([^<\n]+)',
        r'Sending\s*Bank[:\s]*([^<\n]+)',
        r'Sender\s*Bank[:\s]*([^<\n]+)',
        # Sent: standalone line with bank + account number
        r'<p[^>]*>\s*(Moniepoint|OPay|GTBank|Access\s*Bank|Zenith|UBA|First\s*Bank|Kuda|PalmPay|Stanbic|Wema|Fidelity|Union\s*Bank|Sterling|Polaris|EcoBank|FCMB)\s+\d+\s*</p>',
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m and m.group(1):
            bank = m.group(1).strip()
            # Normalize common variants
            bank_lower = bank.lower()
            if 'opay' in bank_lower: return 'OPay'
            if 'moniepoint' in bank_lower: return 'Moniepoint'
            if 'gtbank' in bank_lower or 'gtb' == bank_lower: return 'GTBank'
            if 'access' in bank_lower: return 'Access Bank'
            if 'zenith' in bank_lower: return 'Zenith Bank'
            if 'uba' == bank_lower or 'uba ' in bank_lower: return 'UBA'
            if 'first' in bank_lower and 'bank' in bank_lower: return 'First Bank'
            if 'kuda' in bank_lower: return 'Kuda'
            if 'palmpay' in bank_lower: return 'PalmPay'
            if 'stanbic' in bank_lower: return 'Stanbic IBTC'
            if 'wema' in bank_lower: return 'Wema Bank'
            if 'fidelity' in bank_lower: return 'Fidelity Bank'
            if 'union' in bank_lower and 'bank' in bank_lower: return 'Union Bank'
            if 'sterling' in bank_lower: return 'Sterling Bank'
            if 'polaris' in bank_lower: return 'Polaris Bank'
            if 'eco' in bank_lower: return 'EcoBank'
            if 'fcmb' in bank_lower: return 'FCMB'
            return bank
    # Fallback: scan for known bank names anywhere in text
    banks = ['GTBank', 'GTB', 'Access Bank', 'Zenith', 'UBA', 'First Bank',
             'Kuda', 'OPay', 'Moniepoint', 'PalmPay', 'Stanbic', 'Wema', 'Fidelity',
             'Union Bank', 'Sterling', 'Polaris', 'EcoBank', 'FCMB', 'Stanbic IBTC']
    text_lower = text.lower()
    for b in banks:
        if b.lower() in text_lower:
            # Normalize
            if b.lower() in ('opay',): return 'OPay'
            if b.lower() in ('moniepoint',): return 'Moniepoint'
            if b.lower() in ('gtbank', 'gtb'): return 'GTBank'
            return b
    return None


# ============================================================
# Name + bank matching (fuzzy substring)
# ============================================================
def name_matches(email_text: str, buyer_name: str) -> bool:
    """Check if any significant part of buyer_name appears in email text."""
    if not buyer_name:
        return True  # no name to match, accept
    buyer_name_lower = buyer_name.lower().strip()
    parts = [p for p in re.split(r'\s+', buyer_name_lower) if len(p) > 1]
    if not parts:
        return True
    email_lower = email_text.lower()
    # At least one significant part must appear in email
    for part in parts:
        if part in email_lower:
            return True
    return False


def bank_matches(email_text: str, parsed_bank: str | None, buyer_bank: str) -> bool:
    """Check if buyer's bank name appears in email or parsed bank."""
    if not buyer_bank:
        return True  # no bank to match, accept
    buyer_bank_lower = buyer_bank.lower().strip()
    email_lower = email_text.lower()
    # Direct substring in email
    if buyer_bank_lower in email_lower:
        return True
    # Match against parsed bank
    if parsed_bank and buyer_bank_lower in parsed_bank.lower():
        return True
    # Common abbreviations
    bank_aliases = {
        'gtbank': ['gtb', 'gt bank', 'guaranty trust'],
        'access bank': ['access'],
        'first bank': ['firstbank', 'fbn'],
        'stanbic ibtc': ['stanbic'],
    }
    aliases = bank_aliases.get(buyer_bank_lower, [buyer_bank_lower])
    for alias in aliases:
        if alias in email_lower:
            return True
        if parsed_bank and alias in parsed_bank.lower():
            return True
    return False


# ============================================================
# AI fallback (Qwen2.5-72B)
# ============================================================
def ai_match(emails: list[dict], buyer_name: str, buyer_bank: str, expected_amount: float) -> dict | None:
    """Use AI to match emails when regex parsing fails."""
    prompt = f"""You are a payment verification assistant for a Nigerian marketplace. Match PalmPay transaction emails to an expected payment.

Expected payment:
- Buyer name (from checkout): "{buyer_name}"
- Buyer bank name (from checkout): "{buyer_bank or 'any'}"
- Expected amount: ₦{expected_amount:.2f} (must match exactly, including kobo)

For each email, extract:
1. The amount transferred (look for "₦", "NGN", or "Amount" patterns)
2. The sender's name (the person who sent money — look for "From", "Sender", "Sender Name")
3. The sender's bank name (look for "Bank", "Bank Name", "Sending Bank")

An email matches ONLY if ALL THREE are true:
- Amount equals ₦{expected_amount:.2f} exactly
- Sender's name contains a significant part of "{buyer_name}" (at least one word from the name)
- Sender's bank contains "{buyer_bank or 'any bank'}" (if a specific bank was provided)

Emails:
"""
    for i, e in enumerate(emails):
        prompt += f"---EMAIL {i+1} (ID:{e['msgId']})---\n{e['text'][:2000]}\n\n"
    prompt += '\nRespond ONLY with JSON. If a match is found: {"match": true, "email_index": <1-based>, "sender_name": "<name>", "bank_name": "<bank>", "amount": <number>}. If no match: {"match": false, "reason": "<brief>"}.'

    body = json.dumps({
        "model": HF_MODEL,
        "messages": [
            {"role": "system", "content": "Respond ONLY with valid JSON. No prose."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 300,
    }).encode("utf-8")

    req = urllib.request.Request(
        HF_ROUTER_URL, data=body, method='POST',
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        m = re.search(r'\{[\s\S]*\}', text)
        if m:
            result = json.loads(m.group(0))
            if result.get('match') and result.get('email_index'):
                idx = result['email_index'] - 1
                if 0 <= idx < len(emails):
                    return {
                        "msgId": emails[idx]['msgId'],
                        "sender_name": result.get('sender_name', 'Unknown'),
                        "bank_name": result.get('bank_name', ''),
                        "amount": result.get('amount', expected_amount),
                    }
    except Exception as e:
        print(f"  AI match error: {e}")
    return None


# ============================================================
# Gmail IMAP poll
# ============================================================
def fetch_recent_palmpay_emails() -> list[dict]:
    """Fetch recent unread PalmPay emails from Gmail."""
    emails = []
    try:
        mail = imaplib.IMAP4_SSL('imap.gmail.com', 993)
        mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
        mail.select('INBOX')

        # Search for unread PalmPay emails from last 24h
        result, data = mail.search(None, 'UNSEEN', 'FROM', '"palmpay"')
        email_ids = data[0].split() if data[0] else []
        print(f"  Found {len(email_ids)} unread PalmPay email(s)")

        # Get the last 5 (most recent)
        recent_ids = email_ids[-5:] if len(email_ids) > 5 else email_ids

        for msg_id in recent_ids:
            result, msg_data = mail.fetch(msg_id, '(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)] BODY.PEEK[TEXT])')
            raw = msg_data[0][1] if isinstance(msg_data[0], tuple) else b''
            text = raw.decode('utf-8', errors='ignore')
            emails.append({"msgId": msg_id.decode(), "text": text})

        mail.logout()
    except Exception as e:
        print(f"  Gmail IMAP error: {e}")
    return emails


def mark_email_read(msg_id: str):
    """Mark an email as read in Gmail."""
    try:
        mail = imaplib.IMAP4_SSL('imap.gmail.com', 993)
        mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
        mail.select('INBOX')
        mail.store(msg_id.encode(), '+FLAGS', '\\Seen')
        mail.logout()
    except Exception as e:
        print(f"  Mark read error: {e}")


# ============================================================
# Main verification cycle
# ============================================================
def run_cycle(verbose: bool = True) -> int:
    """Run one verification cycle. Returns number of matches."""
    # Expire old orders
    sql("""
        UPDATE payment_orders
        SET status = 'expired', updated_at = now()
        WHERE status = 'awaiting_verification'
          AND verification_started_at < now() - interval '10 minutes';
    """)

    # Get awaiting orders
    orders = sql("""
        SELECT order_id, expected_amount, buyer_name, buyer_bank_name
        FROM payment_orders
        WHERE status = 'awaiting_verification'
        ORDER BY verification_started_at ASC;
    """)
    if isinstance(orders, dict) and 'error' in orders:
        if verbose:
            print(f"  SQL error: {orders['error'][:200]}")
        return 0
    if not orders:
        if verbose:
            print(f"[{time.strftime('%H:%M:%S')}] No orders awaiting verification")
        return 0

    if verbose:
        print(f"[{time.strftime('%H:%M:%S')}] Found {len(orders)} order(s) awaiting verification")

    # Fetch Gmail emails once per cycle (more efficient than per-order)
    emails = fetch_recent_palmpay_emails()
    if not emails:
        if verbose:
            print(f"  No unread PalmPay emails to check")
        return 0

    matched_count = 0
    for order in orders:
        order_id = order['order_id']
        expected = float(order['expected_amount'])
        buyer_name = order['buyer_name'] or ''
        buyer_bank = order.get('buyer_bank_name') or ''

        if verbose:
            print(f"  → {order_id}: ₦{expected:.2f} from '{buyer_name}' (bank: {buyer_bank or 'any'})")

        # Stage 1: regex-based matching
        match_found = False
        for email_msg in emails:
            amount = parse_amount(email_msg['text'])
            if amount is None:
                continue
            # Exact amount match (with kobo suffix makes this unique)
            if abs(amount - expected) >= 0.01:
                continue

            # Amount matches — verify name + bank
            sender = parse_sender(email_msg['text'])
            bank = parse_bank_name(email_msg['text'])

            name_ok = name_matches(email_msg['text'], buyer_name)
            bank_ok = bank_matches(email_msg['text'], bank, buyer_bank)

            if name_ok and bank_ok:
                # Check email not already used
                email_uid = f"INBOX:{email_msg['msgId']}"
                used = sql(f"SELECT id FROM payment_orders WHERE matched_email_id = {escape_sql(email_uid)};")
                if used:
                    if verbose:
                        print(f"    ⚠ Email {email_msg['msgId']} already used — skipping")
                    continue

                # MATCH! Update the order
                if verbose:
                    print(f"    ✅ MATCHED! Amount: ₦{amount}, Sender: {sender}, Bank: {bank}")
                sql(f"""
                    UPDATE payment_orders
                    SET status = 'matched',
                        matched_at = now(),
                        matched_email_id = {escape_sql(email_uid)},
                        matched_sender_name = {escape_sql(sender)},
                        matched_amount = {amount},
                        matched_bank_name = {escape_sql(bank)},
                        updated_at = now()
                    WHERE order_id = {escape_sql(order_id)};
                """)
                mark_email_read(email_msg['msgId'])
                matched_count += 1
                match_found = True
                break
            else:
                if verbose:
                    reasons = []
                    if not name_ok: reasons.append(f"name '{buyer_name}' not in email")
                    if not bank_ok: reasons.append(f"bank '{buyer_bank}' not in email")
                    print(f"    ⚠ Amount ₦{amount} matched but {', '.join(reasons)} (sender: {sender}, bank: {bank})")

        if match_found:
            continue

        # Stage 2: AI fallback (only if regex didn't match)
        if HF_TOKEN:
            if verbose:
                print(f"    … Trying AI fallback (Qwen2.5-72B)")
            ai_result = ai_match(emails, buyer_name, buyer_bank, expected)
            if ai_result:
                email_uid = f"INBOX:{ai_result['msgId']}"
                used = sql(f"SELECT id FROM payment_orders WHERE matched_email_id = {escape_sql(email_uid)};")
                if not used:
                    if verbose:
                        print(f"    ✅ AI MATCHED! Sender: {ai_result['sender_name']}, Bank: {ai_result['bank_name']}, Amount: ₦{ai_result['amount']}")
                    sql(f"""
                        UPDATE payment_orders
                        SET status = 'matched',
                            matched_at = now(),
                            matched_email_id = {escape_sql(email_uid)},
                            matched_sender_name = {escape_sql(ai_result['sender_name'])},
                            matched_amount = {ai_result['amount']},
                            matched_bank_name = {escape_sql(ai_result['bank_name'])},
                            updated_at = now()
                        WHERE order_id = {escape_sql(order_id)};
                    """)
                    mark_email_read(ai_result['msgId'])
                    matched_count += 1
            else:
                if verbose:
                    print(f"    … No AI match either")

    if verbose:
        print(f"[{time.strftime('%H:%M:%S')}] Cycle done: {matched_count}/{len(orders)} matched")
    return matched_count


def main():
    parser = argparse.ArgumentParser(description="Cellex Payment Verifier Daemon")
    parser.add_argument("--once", action="store_true", help="Run a single check and exit")
    parser.add_argument("--interval", type=int, default=15, help="Polling interval (seconds)")
    parser.add_argument("--quiet", action="store_true", help="Suppress output")
    args = parser.parse_args()

    verbose = not args.quiet

    if args.once:
        run_cycle(verbose=verbose)
        return

    if verbose:
        print(f"=== Cellex Payment Verifier Daemon ===")
        print(f"Polling every {args.interval}s")
        print(f"Gmail: {GMAIL_EMAIL}")
        print(f"Press Ctrl+C to stop")
        print()

    try:
        while True:
            try:
                run_cycle(verbose=verbose)
            except Exception as e:
                if verbose:
                    print(f"[{time.strftime('%H:%M:%S')}] Cycle error: {e}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        if verbose:
            print("\nStopping.")


if __name__ == '__main__':
    main()
