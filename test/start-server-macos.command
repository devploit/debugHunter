#!/bin/bash

# debugHunter Test Server for macOS
# Usage: ./start-server-macos.command [port]
# Default port: 9000

PORT=${1:-9000}
DIR="$(cd "$(dirname "$0")" && pwd)"

clear
echo ""
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║           🐛 debugHunter Test Server                     ║"
echo "  ╠══════════════════════════════════════════════════════════╣"
echo "  ║  Server: http://localhost:$PORT                          ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  📋 Test URLs:"
echo "  ─────────────────────────────────────────────────────────"
echo "  Main page:     http://localhost:$PORT/"
echo "  With debug:    http://localhost:$PORT/?debug=1"
echo "  With env:      http://localhost:$PORT/?env=dev"
echo ""
echo "  🔍 Sensitive paths (debugHunter should detect these):"
echo "  ─────────────────────────────────────────────────────────"
echo "  /.env          Credentials, API keys"
echo "  /.git/config   Git repository info"
echo "  /config.json   Database passwords"
echo "  /phpinfo.php   PHP configuration"
echo "  /debug         Debug console"
echo ""
echo "  ⏹  Press Ctrl+C to stop the server"
echo ""

cd "$DIR"

# Open browser after short delay
(sleep 2 && open "http://localhost:$PORT") &

# Start server
python3 -m http.server $PORT
