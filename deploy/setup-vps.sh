#!/bin/bash
# Run this ONCE on the VPS to set up the deployment target
set -e

APP_NAME="snipe-n-vibe"
APP_DIR="/root/apps/$APP_NAME"

# Create app directory
mkdir -p "$APP_DIR"
mkdir -p /root/bin

# Copy deploy script to VPS bin
cat > /root/bin/deploy-snipe-n-vibe.sh << 'SCRIPT'
#!/bin/bash
set -e

APP_NAME="snipe-n-vibe"
APP_DIR="/root/apps/$APP_NAME"
REPO="https://github.com/TeemuSo/Snipe-n-Vibe.git"
PORT=8080

echo "Deploying $APP_NAME..."

export PATH="/root/.local/share/fnm/node-versions/v22.22.0/installation/bin:$PATH"

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/main
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

npm install

pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start "npx tsx packages/server/src/main.ts" --name "$APP_NAME" --cwd "$APP_DIR"
pm2 save

echo "Server running on port $PORT"
SCRIPT

chmod +x /root/bin/deploy-snipe-n-vibe.sh

echo "VPS setup complete. Deploy script at /root/bin/deploy-snipe-n-vibe.sh"
