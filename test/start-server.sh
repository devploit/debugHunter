#!/bin/bash

# debugHunter Test Server
# Usage: ./start-server.sh [port]
# Default port: 9000

PORT=${1:-9000}
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║           debugHunter Test Server                        ║"
echo "  ╠══════════════════════════════════════════════════════════╣"
echo "  ║  Starting server on http://localhost:$PORT               ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Test URLs:"
echo "  ─────────────────────────────────────────────────────────"
echo "  Main page:     http://localhost:$PORT/"
echo "  With debug:    http://localhost:$PORT/?debug=1"
echo "  With env:      http://localhost:$PORT/?env=dev"
echo ""
echo "  Sensitive paths (should be detected):"
echo "  ─────────────────────────────────────────────────────────"
echo "  /.env          http://localhost:$PORT/.env"
echo "  /.git/config   http://localhost:$PORT/.git/config"
echo "  /config.json   http://localhost:$PORT/config.json"
echo "  /phpinfo.php   http://localhost:$PORT/phpinfo.php"
echo "  /debug         http://localhost:$PORT/debug"
echo ""
echo "  Press Ctrl+C to stop the server"
echo ""

cd "$DIR"
python3 -m http.server $PORT
