#!/bin/bash
# 打包 VideoCut 为 macOS .app 应用
set -e

cd "$(dirname "$0")/.."

APP_NAME="VideoCut"
APP_DIR="dist-app/${APP_NAME}.app"
CONTENTS="${APP_DIR}/Contents"
MACOS="${CONTENTS}/MacOS"
RESOURCES="${CONTENTS}/Resources"

echo "▶ 构建前端..."
pnpm build

echo "▶ 清理旧的打包产物..."
rm -rf dist-app

echo "▶ 创建 .app 目录结构..."
mkdir -p "${MACOS}"
mkdir -p "${RESOURCES}"

echo "▶ 复制构建产物..."
cp -R dist/* "${RESOURCES}/"

echo "▶ 复制服务器脚本..."
cp scripts/server.cjs "${RESOURCES}/"

echo "▶ 写入 Info.plist..."
cat > "${CONTENTS}/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>VideoCut</string>
    <key>CFBundleDisplayName</key>
    <string>VideoCut</string>
    <key>CFBundleIdentifier</key>
    <string>com.videocut.app</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleExecutable</key>
    <string>VideoCut</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>LSUIElement</key>
    <false/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

echo "▶ 写入启动脚本..."
cat > "${MACOS}/${APP_NAME}" << 'SCRIPT'
#!/bin/bash
# VideoCut 启动脚本：启动本地服务器并打开浏览器

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES="${APP_DIR}/Resources"
PORT=8899

# 查找 node 可执行文件
NODE_BIN=""
for candidate in node /usr/local/bin/node /opt/homebrew/bin/node /usr/bin/node "$HOME/.nvm/versions/node"/*/bin/node "$HOME/.fnm/aliases/default/bin/node" "$HOME/.volta/bin/node"; do
  if command -v "$candidate" >/dev/null 2>&1; then
    NODE_BIN="$(command -v "$candidate")"
    break
  fi
done

if [ -z "$NODE_BIN" ]; then
  osascript -e 'display dialog "未检测到 Node.js，请先安装 Node.js 后再运行 VideoCut。" buttons {"确定"} default button 1 with icon stop' 2>/dev/null
  exit 1
fi

# 查找可用端口
while lsof -nP -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

# 启动服务器
"$NODE_BIN" "${RESOURCES}/server.cjs" "$PORT" "${RESOURCES}" &
SERVER_PID=$!

# 等待服务器就绪（最多 10 秒）
READY_URL=""
for i in $(seq 1 50); do
  READY_URL=$(lsof -nP -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1 && echo "http://127.0.0.1:${PORT}" || echo "")
  if [ -n "$READY_URL" ]; then
    break
  fi
  sleep 0.2
done

if [ -z "$READY_URL" ]; then
  kill "$SERVER_PID" 2>/dev/null
  osascript -e 'display dialog "服务器启动失败，请重试。" buttons {"确定"} default button 1 with icon stop' 2>/dev/null
  exit 1
fi

# 打开默认浏览器
open "$READY_URL"

# 保持运行，直到进程被终止
wait "$SERVER_PID" 2>/dev/null
exit 0
SCRIPT

chmod +x "${MACOS}/${APP_NAME}"

echo "✅ 打包完成：${APP_DIR}"
echo "   双击 VideoCut.app 即可一键运行"
