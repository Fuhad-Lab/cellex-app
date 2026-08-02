# Cellex Core API — Simplified for Docker deployment
# Uses Express with the same security patterns as NestJS:
# - Internal token verification
# - Error sanitization
# - Audit logging
# - Rate limiting

FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "src/server.js"]
