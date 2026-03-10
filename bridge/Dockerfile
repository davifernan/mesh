FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies (separate layer for cache)
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source
COPY src/ ./src/

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
