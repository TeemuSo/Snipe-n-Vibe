#!/bin/bash
set -e

APP_NAME="snipe-n-vibe"
APP_DIR="/root/apps/$APP_NAME"
REPO="https://github.com/TeemuSo/Snipe-n-Vibe.git"
BRANCH="${1:-main}"
PORT=8080

echo "Deploying $APP_NAME from branch $BRANCH..."

# Clone or pull
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
else
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# Install dependencies
export PATH="/root/.local/share/fnm/node-versions/v22.22.0/installation/bin:$PATH"
npm install

# Restart with pm2
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start "npx tsx packages/server/src/main.ts" --name "$APP_NAME" --cwd "$APP_DIR"
pm2 save

echo "Server deployed on port $PORT"
