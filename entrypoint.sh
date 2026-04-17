#!/bin/sh
set -e

BRANCH="${GIT_BRANCH:-main}"
WORK_DIR="/app"

# Clone if GIT_REPO_URL is set and /app is not already a git repo
if [ -n "$GIT_REPO_URL" ] && [ ! -d "$WORK_DIR/.git" ]; then
  if [ -n "$GIT_PAT" ]; then
    CLONE_URL=$(echo "$GIT_REPO_URL" | sed "s|https://|https://x-access-token:${GIT_PAT}@|")
  else
    CLONE_URL="$GIT_REPO_URL"
  fi

  echo "Cloning $GIT_REPO_URL (branch: $BRANCH)..."
  git clone --depth 1 --branch "$BRANCH" "$CLONE_URL" /tmp/repo
  cp -a /tmp/repo/.git "$WORK_DIR/.git"
  rm -rf /tmp/repo
  cd "$WORK_DIR"
  git checkout "$BRANCH" -- .
fi

cd "$WORK_DIR"

# Install project dependencies if package.json exists
if [ -f "package.json" ]; then
  echo "Installing project dependencies..."
  npm ci || npm install
fi

# Configure git identity for commits
git config user.email "${GIT_USER_EMAIL:-cms@astrocms.dev}"
git config user.name "${GIT_USER_NAME:-AstroCMS}"

# Start AstroCMS
export ASTROCMS_ROOT="$WORK_DIR"
exec node --import tsx /astrocms/backend/server.ts
