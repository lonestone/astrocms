FROM node:22-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /astrocms

# Install astrocms package
COPY packages/astrocms/package.json packages/astrocms/package-lock.json* ./
RUN npm ci || npm install

COPY packages/astrocms ./

# Build CMS frontend
RUN npx vite build --config frontend/vite.config.ts

# Configure git for commits inside the container
RUN git config --global --add safe.directory /app

WORKDIR /app

EXPOSE 4001

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
