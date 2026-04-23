FROM node:22-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Enable pnpm / yarn via corepack (downloaded on first use)
RUN corepack enable

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /astrocms

# Install astrocms package. The package lives in a workspace monorepo, so
# there is no standalone lockfile to copy; npm install regenerates one.
COPY packages/astrocms/package.json ./
RUN npm install

COPY packages/astrocms ./

# Build CMS frontend
RUN npx vite build --config frontend/vite.config.ts

# /app and /root/.claude are symlinked into /data by the entrypoint at
# runtime, so mark both the symlink and the real path as safe for git.
RUN git config --global --add safe.directory /app \
 && git config --global --add safe.directory /data/app

EXPOSE 4001

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
