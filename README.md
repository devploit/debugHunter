# debugHunter

<p align="center">
  <img src="images/icon128.png" alt="debugHunter" width="128" height="128">
</p>

<h3 align="center">Discover Hidden Debug Endpoints & Development Environments</h3>

<p align="center">
  <a href="https://github.com/devploit/debugHunter/releases"><img src="https://img.shields.io/github/v/release/devploit/debugHunter?style=flat-square&color=a371f7" alt="Release"></a>
  <a href="https://github.com/devploit/debugHunter/blob/main/LICENSE"><img src="https://img.shields.io/github/license/devploit/debugHunter?style=flat-square&color=a371f7" alt="License"></a>
  <a href="https://github.com/devploit/debugHunter/issues"><img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat-square" alt="Contributions Welcome"></a>
</p>

<p align="center">
  <b>The essential Chrome extension for bug bounty hunters and penetration testers</b><br>
  Passively detect debug parameters, sensitive headers, and exposed paths while you browse.
</p>

---

## Why debugHunter?

Finding debug endpoints and exposed configuration files is a common technique in bug bounty hunting. **debugHunter** automates this process by passively scanning every website you visit, alerting you when it discovers:

- 🔧 **Debug Parameters** — `?debug=1`, `?env=dev`, `?XDEBUG_SESSION_START=phpstorm`
- 📨 **Sensitive Headers** — `X-Forwarded-Host: localhost`, `X-Original-URL: /admin`
- 📁 **Exposed Paths** — `/.env`, `/.git/config`, `/actuator/env`, `/phpinfo.php`

All findings are classified by severity so you can focus on critical issues first.

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Factor Detection** | Combines status codes, content analysis, headers, and debug indicators |
| **Severity Classification** | Critical, High, Medium, Low — prioritize what matters |
| **Smart Rate Limiting** | Exponential backoff prevents WAF blocks |
| **Response Diff Viewer** | Compare original vs modified responses side-by-side |
| **Search & Filter** | Find specific domains or keywords across all findings |
| **Configurable Modes** | Smart, Aggressive, Conservative, Keywords-only |
| **Low False Positives** | Dynamic content filtering removes timestamps, tokens, sessions |

## Detection Coverage

<details>
<summary><b>Debug Parameters (25+)</b></summary>

```
?debug=1              ?_debug=true           ?debug_mode=1
?XDEBUG_SESSION_START ?XDEBUG_SESSION=1      ?debugbar=1
?profiler=1           ?trace=1               ?verbose=1
?show_errors=1        ?display_errors=1      ?dev_mode=1
?phpinfo=1            ?error_reporting=E_ALL ?env=dev
?env=staging          ?env=pre               ?env=sandbox
?environment=dev      ?staging=1             ?beta=1
?internal=1           ?test=1                ?admin=1
```
</details>

<details>
<summary><b>Sensitive Headers (7)</b></summary>

```
X-Debug: 1
X-Forwarded-Host: localhost
X-Forwarded-For: 127.0.0.1
X-Original-URL: /admin
X-Env: dev
Env: pre
Env: dev
```
</details>

<details>
<summary><b>Sensitive Paths (46)</b></summary>

**Critical**
```
/.env                 /.git/config          /config.json
/.env.local           /.env.production      /credentials.json
/auth.json            /secrets.json         /database.yml
/wp-config.php.bak    /.aws/credentials     /backup.sql
/dump.sql             /.htpasswd            /actuator/env
/actuator/heapdump
```

**High**
```
/.git/HEAD            /.git/logs/HEAD       /.svn/entries
/phpinfo.php          /info.php             /graphiql
/__debug__            /debug                /server-status
/elmah.axd            /trace.axd            /rails/info/properties
/package.json         /composer.json
```

**Medium**
```
/swagger-ui.html      /swagger.json         /api-docs
/openapi.json         /robots.txt           /.well-known/security.txt
/web.config           /.htaccess            /Dockerfile
/docker-compose.yml
```
</details>

## Installation

### Option 1: Clone Repository

```bash
git clone https://github.com/devploit/debugHunter.git
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `debugHunter` folder
5. Pin the extension to your toolbar

### Option 2: Download Release

1. Download the latest `.zip` from [Releases](https://github.com/devploit/debugHunter/releases)
2. Extract and load via `chrome://extensions/` → **Load unpacked**

## Usage

1. **Browse normally** — debugHunter scans passively in the background
2. **Check the badge** — Number indicates findings count (color = severity)
3. **Click the icon** — View findings by category: Paths, Headers, Parameters
4. **Review & verify** — Click any finding to open in new tab

## Configuration

Access settings via the **gear icon** in the popup:

| Setting | Default | Description |
|---------|---------|-------------|
| Detection Mode | Smart | Smart / Aggressive / Conservative / Keywords-only |
| Similarity Threshold | 0.90 | How similar responses must be to ignore |
| Min Length Diff | 200 | Minimum bytes difference to flag |
| Check Interval | 8 hours | Re-check interval for same URL |
| Base Delay | 300ms | Delay between requests (auto-adjusts) |
| Whitelist | Empty | Domains to skip |

## Testing

A test environment is included to verify the extension works correctly:

```bash
cd test/
./start-server-macos.command    # macOS (opens browser automatically)
./start-server.sh               # Linux/other
```

This starts a local server on port 9000 with fake sensitive files and debug endpoints.

## Technical Details

- **Manifest V3** — Chrome MV3 compliant
- **Permissions** — `storage`, `tabs`, `<all_urls>`
- **Background** — Service Worker (event-driven)
- **Privacy** — All analysis happens locally, no external requests

## Changelog

### v2.0.0
- Complete rewrite with Manifest V3
- Multi-factor detection engine
- Severity classification system
- Response diff viewer
- Search and filter functionality
- Smart rate limiting with exponential backoff
- Dynamic content filtering
- 4 configurable detection modes
- New dark UI
- 46 sensitive paths (up from 17)
- Optimized requests with HEAD checks and caching

### v1.x
- Initial release with basic parameter detection

## Contributing

- **Report bugs** — Open an issue with reproduction steps
- **Add patterns** — Submit PRs with new parameters, headers, or paths
- **Improve docs** — Help make the README clearer

## License

MIT License. See [LICENSE](LICENSE) for details.

## Disclaimer

This tool is for authorized security testing only. Always obtain proper authorization before testing web applications you do not own.

---

<p align="center">
  <b>debugHunter</b> — Exposing what should stay hidden<br>
  <sub>Made with ♥ for the bug bounty community</sub>
</p>
