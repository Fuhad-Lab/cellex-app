# Cellex — Hugging Face Space Deployment
# Docker space that builds the Next.js standalone output and serves it on port 7860

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (use npm install — repo uses bun.lock, not package-lock.json)
COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy source
COPY . .

# Build the Next.js standalone output
RUN npm run build

# ---- Stage 2: Run ----
FROM node:20-alpine AS runner

WORKDIR /app

# Set production env
ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME=0.0.0.0

# Copy standalone build + public assets + static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# HF Spaces runs on port 7860 by default
EXPOSE 7860

# Run the standalone Next.js server
CMD ["node", "server.js"]
