#!/usr/bin/env python3
"""
debugHunter Test Server - Dynamic version
Serves different content based on debug params/headers
"""

import http.server
import socketserver
import os
from urllib.parse import urlparse, parse_qs

PORT = 9000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Debug params that trigger debug mode
DEBUG_PARAMS = [
    '_debug', 'debug', 'debug_mode', 'XDEBUG_SESSION_START', 'XDEBUG_SESSION',
    'debugbar', 'profiler', 'trace', 'verbose', 'show_errors', 'display_errors',
    'dev_mode', 'phpinfo', 'error_reporting', 'env', 'environment', 'staging',
    'beta', 'internal', 'test', 'admin'
]

# Debug headers that trigger debug mode
DEBUG_HEADERS = [
    'x-debug', 'x-forwarded-host', 'x-forwarded-for', 'x-original-url',
    'x-env', 'env', 'x-real-ip'
]

class DebugHunterHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        query_params = parse_qs(parsed.query)

        # Check for debug params
        detected_params = []
        for param in DEBUG_PARAMS:
            if param in query_params:
                detected_params.append(f"{param}={query_params[param][0]}")

        # Check for debug headers
        detected_headers = []
        for header in DEBUG_HEADERS:
            value = self.headers.get(header)
            if value:
                detected_headers.append(f"{header}: {value}")

        is_debug_mode = len(detected_params) > 0 or len(detected_headers) > 0

        # Serve dynamic index for root path
        if parsed.path == '/' or parsed.path == '/index.html':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()

            html = self.generate_html(is_debug_mode, detected_params, detected_headers)
            self.wfile.write(html.encode())
            return

        # Serve static files for other paths
        super().do_GET()

    def do_HEAD(self):
        parsed = urlparse(self.path)

        if parsed.path == '/' or parsed.path == '/index.html':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            return

        super().do_HEAD()

    def generate_html(self, is_debug_mode, detected_params, detected_headers):
        if is_debug_mode:
            return self.generate_debug_html(detected_params, detected_headers)
        else:
            return self.generate_normal_html()

    def generate_normal_html(self):
        return '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Production App</title>
  <style>
    body { font-family: sans-serif; background: #0d1117; color: #f0f6fc; padding: 40px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { color: #58a6ff; }
    .status { background: #238636; padding: 15px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to Our App</h1>
    <div class="status">Production Mode - Everything is secure</div>
    <p>This is a normal production page with no sensitive information.</p>
  </div>
</body>
</html>'''

    def generate_debug_html(self, detected_params, detected_headers):
        params_str = ', '.join(detected_params) if detected_params else 'none'
        headers_str = ', '.join(detected_headers) if detected_headers else 'none'

        return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DEBUG MODE ACTIVE</title>
  <style>
    body {{ font-family: monospace; background: #1a0000; color: #ff6b6b; padding: 40px; }}
    .container {{ max-width: 800px; margin: 0 auto; }}
    h1 {{ color: #ff0000; }}
    .warning {{ background: #ff0000; color: white; padding: 15px; border-radius: 8px; font-weight: bold; }}
    pre {{ background: #000; padding: 20px; border-radius: 8px; overflow-x: auto; }}
    .section {{ margin: 20px 0; }}
    .section-title {{ color: #ffaa00; font-weight: bold; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>DEBUG MODE ACTIVE</h1>
    <div class="warning">WARNING: Sensitive information exposed!</div>

    <div class="section">
      <div class="section-title">[Detected Debug Params]</div>
      <pre>{params_str}</pre>
    </div>

    <div class="section">
      <div class="section-title">[Detected Debug Headers]</div>
      <pre>{headers_str}</pre>
    </div>

    <div class="section">
      <div class="section-title">[Environment Variables]</div>
      <pre>
DB_HOST=localhost
DB_NAME=production_db
DB_PASSWORD=super_secret_password_123!
API_KEY=sk-1234567890abcdef1234567890abcdef
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
SECRET_KEY=my-super-secret-application-key
      </pre>
    </div>

    <div class="section">
      <div class="section-title">[Server Configuration]</div>
      <pre>
PHP Version: PHP/8.2.0
Server: Apache/2.4.52
Document Root: /var/www/html
Server User: www-data
Debug Mode: true
      </pre>
    </div>

    <div class="section">
      <div class="section-title">[Stack Trace]</div>
      <pre>
Fatal error: Uncaught Exception in /var/www/html/app/core.php:142
Stack trace:
#0 /var/www/html/app/core.php(142): Database->connect()
#1 /var/www/html/app/bootstrap.php(28): Application->init()
#2 /var/www/html/index.php(5): require_once('/var/www/html/...')
#3 {{main}}
      </pre>
    </div>
  </div>
</body>
</html>'''

def run_server():
    print("")
    print("  " + "=" * 60)
    print("       debugHunter Test Server (Dynamic)")
    print("  " + "=" * 60)
    print(f"  Server: http://localhost:{PORT}")
    print("")
    print("  Test URLs:")
    print(f"    Main page:       http://localhost:{PORT}/")
    print(f"    With debug:      http://localhost:{PORT}/?debug=1")
    print(f"    With env:        http://localhost:{PORT}/?env=dev")
    print("")
    print("  Sensitive paths (debugHunter should detect these):")
    print(f"    /.env            Credentials, API keys")
    print(f"    /.git/config     Git repository info")
    print(f"    /config.json     Database passwords")
    print(f"    /phpinfo.php     PHP configuration")
    print(f"    /debug           Debug console")
    print("")
    print("  Press Ctrl+C to stop the server")
    print("")

    with socketserver.TCPServer(("", PORT), DebugHunterHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run_server()
