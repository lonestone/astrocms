#!/bin/sh
set -e

BRANCH="${GIT_BRANCH:-main}"
WORK_DIR="/app"

# Resolve the remote URL, injecting the PAT when provided
if [ -n "$GIT_REPO_URL" ] && [ -n "$GIT_PAT" ]; then
  REMOTE_URL=$(echo "$GIT_REPO_URL" | sed "s|https://|https://x-access-token:${GIT_PAT}@|")
else
  REMOTE_URL="$GIT_REPO_URL"
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

# Install project dependencies if package.json exists
if [ -f "package.json" ]; then
  echo "Installing project dependencies..."
  npm ci || npm install
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

# Start AstroCMS
export ASTROCMS_ROOT="$WORK_DIR"
exec node --import tsx /astrocms/backend/server.ts
