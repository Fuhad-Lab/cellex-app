#!/bin/bash
# Push the Render verifier to a dedicated GitHub repo so Render can deploy from it.
# Run this once to set up the Render deployment source.

set -e

REPO_NAME="cellex-payment-verifier"
GITHUB_PAT="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"
GITHUB_USER="eeshaAI"

# Create the repo on GitHub
echo "=== Creating GitHub repo: $REPO_NAME ==="
curl -sS -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token $GITHUB_PAT" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"Cellex Payment Verifier — polls Gmail for PalmPay transfers and matches against Supabase orders\",\"private\":true}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Repo URL: {d.get(\"html_url\", d.get(\"message\",\"?\"))}')"

# Init the local render-verifier folder as a git repo and push
cd /home/z/my-project/render-verifier

if [ ! -d .git ]; then
  git init
  git config user.email "eeshaai@cellex.shop"
  git config user.name "eeshaAI"
fi

git add .
git commit -m "Cellex Payment Verifier — Render deployment" 2>&1 | tail -3

git remote remove origin 2>/dev/null || true
git remote add origin "https://$GITHUB_USER:$GITHUB_PAT@github.com/$GITHUB_USER/$REPO_NAME.git"
git branch -M main
git push -u origin main 2>&1 | tail -5

echo ""
echo "=== Done ==="
echo "GitHub repo: https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "Next steps:"
echo "1. Go to Render: https://dashboard.render.com/create"
echo "2. Create new Web Service"
echo "3. Connect the GitHub repo: $GITHUB_USER/$REPO_NAME"
echo "4. Configure:"
echo "   - Runtime: Python 3"
echo "   - Build Command: pip install -r requirements.txt"
echo "   - Start Command: python verifier_app.py"
echo "5. Add environment variables (see README.md)"
echo "6. Deploy"
