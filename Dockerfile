FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

# libstdc++ is required for better-sqlite3 binary
RUN apk add --no-cache python3 make g++ libstdc++

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

COPY --from=builder /app/dist ./dist

# Directory for SQLite database persistence
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
