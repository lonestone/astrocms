#!/bin/sh
set -e

# A single persistent volume mounted at /data holds both the cloned project
# (/data/app) and the Claude Code auth (/data/claude). Symlink each into the
# path the rest of the system expects, so neither the app nor Claude needs to
# know about /data.
mkdir -p /data/app /data/claude
rm -rf /app /root/.claude
ln -s /data/app /app
ln -s /data/claude /root/.claude

BRANCH="${GIT_BRANCH:-main}"
WORK_DIR="/app"

# Resolve the remote URL, injecting the PAT when provided
if [ -n "$GIT_REPO_URL" ] && [ -n "$GIT_PAT" ]; then
  REMOTE_URL=$(echo "$GIT_REPO_URL" | sed "s|https://|https://x-access-token:${GIT_PAT}@|")
else
  REMOTE_URL="$GIT_REPO_URL"
fi

# If the existing clone's origin points to a different remote, wipe it so
# we can re-clone. Normalization strips embedded creds (x-access-token:PAT),
# any trailing ".git", and trailing slashes, so a PAT rotation or a cosmetic
# URL difference on the same repo doesn't trigger a wipe.
normalize_url() {
  echo "$1" | sed -e 's|://[^/]*@|://|' -e 's|\.git$||' -e 's|/*$||'
}
if [ -n "$GIT_REPO_URL" ] && [ -d "$WORK_DIR/.git" ]; then
  CURRENT_ORIGIN=$(git -C "$WORK_DIR" remote get-url origin 2>/dev/null || echo "")
  CURRENT_CLEAN=$(normalize_url "$CURRENT_ORIGIN")
  REQUESTED_CLEAN=$(normalize_url "$GIT_REPO_URL")
  echo "Existing clone detected at $WORK_DIR"
  echo "  origin:    $CURRENT_CLEAN"
  echo "  requested: $REQUESTED_CLEAN"
  if [ "$CURRENT_CLEAN" != "$REQUESTED_CLEAN" ]; then
    echo "  → origin differs; resetting $WORK_DIR"
    # Make sure hidden entries (.git, .env…) are included.
    find "$WORK_DIR" -mindepth 1 -maxdepth 1 -print0 2>/dev/null \
      | xargs -0 rm -rf
    if [ -d "$WORK_DIR/.git" ]; then
      echo "  ! failed to fully clear $WORK_DIR (permissions?); aborting" >&2
      exit 1
    fi
  fi
fi

# Clone if GIT_REPO_URL is set and /app is not already a git repo
JUST_CLONED=0
if [ -n "$GIT_REPO_URL" ] && [ ! -d "$WORK_DIR/.git" ]; then
  echo "Cloning $GIT_REPO_URL (branch: $BRANCH)..."
  git clone --branch "$BRANCH" "$REMOTE_URL" /tmp/repo
  cp -a /tmp/repo/.git "$WORK_DIR/.git"
  rm -rf /tmp/repo
  cd "$WORK_DIR"
  git checkout "$BRANCH" -- .
  JUST_CLONED=1
fi

cd "$WORK_DIR"

# If the repo already existed at startup, fetch and fast-forward to pick up
# upstream changes. Use --ff-only so divergence or uncommitted changes keep
# the current state instead of being overwritten.
if [ -n "$GIT_REPO_URL" ] && [ -d "$WORK_DIR/.git" ] && [ "$JUST_CLONED" = "0" ]; then
  git remote set-url origin "$REMOTE_URL"
  echo "Updating repository (branch: $BRANCH)..."
  if git fetch origin "$BRANCH" && git merge --ff-only "origin/$BRANCH"; then
    echo "Repository updated"
  else
    echo "Could not fast-forward to origin/$BRANCH; keeping current state"
  fi
fi

# Install project dependencies. Detect the package manager from the lockfile
# (pnpm / yarn / bun / npm). Use ASTROCMS_INSTALL_CMD to override.
if [ -f "package.json" ]; then
  if [ -n "$ASTROCMS_INSTALL_CMD" ]; then
    echo "Installing project dependencies with: $ASTROCMS_INSTALL_CMD"
    sh -c "$ASTROCMS_INSTALL_CMD"
  elif [ -f "pnpm-lock.yaml" ]; then
    echo "Detected pnpm-lock.yaml → pnpm install"
    pnpm install --frozen-lockfile || pnpm install
  elif [ -f "yarn.lock" ]; then
    echo "Detected yarn.lock → yarn install"
    yarn install --frozen-lockfile || yarn install
  elif [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
    echo "Detected bun lockfile → bun install"
    bun install
  else
    echo "Using npm"
    npm ci || npm install
  fi
fi

# Configure git identity for commits
git config user.email "${GIT_USER_EMAIL:-cms@astrocms.dev}"
git config user.name "${GIT_USER_NAME:-AstroCMS}"

# Optionally start the website dev server in the background.
# When ASTROCMS_DEV_CMD is set, astrocms proxies its root to the dev server
# listening on ASTROCMS_DEV_PORT (default 4321).
if [ -n "$ASTROCMS_DEV_CMD" ]; then
  export ASTROCMS_DEV_PORT="${ASTROCMS_DEV_PORT:-4321}"
  echo "Starting website dev server on port $ASTROCMS_DEV_PORT: $ASTROCMS_DEV_CMD"
  (cd "$WORK_DIR" && sh -c "$ASTROCMS_DEV_CMD") &
fi

# Start AstroCMS. Run from /astrocms so `--import tsx` resolves against the
# CMS's own node_modules (the user project in /app may not depend on tsx).
export ASTROCMS_ROOT="$WORK_DIR"
cd /astrocms
exec node --import tsx /astrocms/backend/server.ts
