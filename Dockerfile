FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ----- Dépendances complètes (build) -----
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ----- Build Next.js -----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ----- Image finale -----
FROM base AS runner
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Réutilise les dépendances déjà téléchargées puis retire celles de dev
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force && npx prisma generate
COPY next.config.mjs ./
COPY public ./public
COPY --from=builder /app/.next ./.next
RUN mkdir -p /app/uploads

EXPOSE 3000
# Applique les migrations puis démarre le serveur
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
