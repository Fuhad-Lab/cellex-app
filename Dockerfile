# Cellex — Render / HF Space Deployment
# Multi-stage build: Node 20 alpine builder + slim runner.
# Uses npm ci for deterministic, cacheable installs.
# Serves Next.js standalone — PORT is set by Render automatically.

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lockfiles first so this layer is cached unless deps change.
COPY package.json package-lock.json ./

# Use npm ci for reproducible installs (requires package-lock.json).
# --legacy-peer-deps avoids peer-dep conflicts with Next 16.
RUN npm ci --no-audit --no-fund --legacy-peer-deps

# Now copy the rest of the source.
COPY . .

# Build the Next.js standalone output (also copies static + public into standalone)
RUN npm run build

# ---- Stage 2: Run ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# PORT is set by Render (defaults to 10000). Don't hardcode it here
# so the same Dockerfile works on both Render and HF Spaces.

# Copy standalone build + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Run the standalone Next.js server (reads PORT from env)
CMD ["node", "server.js"]
