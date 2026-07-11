# Cellex — Hugging Face Space Deployment
# Multi-stage build: Node 20 alpine builder + slim runner.
# Uses npm ci for deterministic, cacheable installs.
# Serves Next.js standalone on port 7860 (HF Spaces default).

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lockfiles first so this layer is cached unless deps change.
# HF Spaces' Docker builder caches layers — only package.json/lockfile changes
# will invalidate the npm install step, not source code changes.
COPY package.json package-lock.json ./

# Use npm ci for reproducible installs (requires package-lock.json).
# --no-audit and --no-fund keep the log output clean.
# --legacy-peer-deps avoids peer-dep conflicts with Next 16.
RUN npm ci --no-audit --no-fund --legacy-peer-deps

# Now copy the rest of the source (this layer invalidates on every code change
# but the previous install layer stays cached).
COPY . .

# Build the Next.js standalone output (also copies static + public into standalone)
RUN npm run build

# ---- Stage 2: Run ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME=0.0.0.0

# Copy standalone build + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# HF Spaces expects the app to listen on port 7860
EXPOSE 7860

# Run the standalone Next.js server (no npm overhead)
CMD ["node", "server.js"]
