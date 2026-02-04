/**
 * debugHunter v2.0.6 - Background Service Worker
 * Multi-factor detection with configurable comparison strategies
 * - Added redirect detection to filter false positives on paths
 * - Added natural variance measurement to filter false positives on dynamic sites
 * - Require variance check for all detections without debug indicators
 */

import { stringSimilarity } from './similarity.js';

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

const debugParams = {
  high: [
    { key: "_debug", value: "1" },
    { key: "debug", value: "1" },
    { key: "debug", value: "true" },
    { key: "debug_mode", value: "1" },
    { key: "XDEBUG_SESSION_START", value: "phpstorm" },
    { key: "XDEBUG_SESSION", value: "1" },
    { key: "debugbar", value: "1" },
    { key: "profiler", value: "1" },
    { key: "trace", value: "1" },
    { key: "verbose", value: "1" },
    { key: "show_errors", value: "1" },
    { key: "display_errors", value: "1" },
    { key: "dev_mode", value: "1" },
    { key: "phpinfo", value: "1" },
    { key: "error_reporting", value: "E_ALL" },
  ],
  medium: [
    { key: "env", value: "dev" },
    { key: "env", value: "staging" },
    { key: "env", value: "pre" },
    { key: "env", value: "sandbox" },
    { key: "environment", value: "dev" },
    { key: "staging", value: "1" },
    { key: "beta", value: "1" },
    { key: "internal", value: "1" },
    { key: "test", value: "1" },
    { key: "admin", value: "1" },
  ]
};

const customHeaders = [
  { key: "X-Debug", value: "1" },
  { key: "X-Forwarded-Host", value: "localhost" },
  { key: "X-Forwarded-For", value: "127.0.0.1" },
  { key: "X-Original-URL", value: "/admin" },
  { key: "X-Env", value: "dev" },
  { key: "Env", value: "pre" },
  { key: "Env", value: "dev" },
];

// Sensitive paths organized by priority (critical first, checked with HEAD before GET)
const sensitivePaths = {
  // Critical - secrets, credentials (always check these)
  critical: [
    "/.env",
    "/.git/config",
    "/config.json",
    "/.env.local",
    "/.env.production",
    "/.env.development",
    "/credentials.json",
    "/auth.json",
    "/secrets.json",
    "/database.yml",
    "/wp-config.php.bak",
    "/wp-config.php.old",
    "/.aws/credentials",
    "/backup.sql",
    "/dump.sql",
    "/.htpasswd",
    "/actuator/env",
    "/actuator/heapdump",
  ],
  // High - debug endpoints, source code
  high: [
    "/.git/HEAD",
    "/.git/logs/HEAD",
    "/.svn/entries",
    "/phpinfo.php",
    "/info.php",
    "/graphiql",
    "/__debug__",
    "/debug",
    "/server-status",
    "/elmah.axd",
    "/trace.axd",
    "/rails/info/properties",
    "/package.json",
    "/composer.json",
  ],
  // Medium - documentation, configs
  medium: [
    "/swagger-ui.html",
    "/swagger.json",
    "/api-docs",
    "/openapi.json",
    "/web.config",
    "/.htaccess",
    "/Dockerfile",
    "/docker-compose.yml",
  ],
};

// Default patterns to filter dynamic content
const DEFAULT_DYNAMIC_PATTERNS = [
  /\b\d{10,13}\b/g,                           // Unix timestamps
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g,    // ISO dates
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, // UUIDs
  /csrf[_-]?token["']?\s*[:=]\s*["']?[^"'\s]+/gi,
  /nonce["']?\s*[:=]\s*["']?[^"'\s]+/gi,
  /_token["']?\s*[:=]\s*["']?[^"'\s]+/gi,
  /session[_-]?id["']?\s*[:=]\s*["']?[^"'\s]+/gi,
  /PHPSESSID=[^;\s]+/gi,
  /JSESSIONID=[^;\s]+/gi,
  /\?v=\d+/g,
  /\?_=\d+/g,
  /data-request-id="[^"]+"/g,
  /data-nonce="[^"]+"/g,
];

// Soft 404 indicators
const soft404Indicators = [
  "404", "not found", "page not found", "no encontrado",
  "doesn't exist", "does not exist", "cannot be found",
  "error 404", "oops", "sorry, we couldn't find"
];

// Debug indicators for content validation
const debugIndicators = {
  critical: [
    /DB_PASSWORD\s*[=:]\s*['"]?[^'"}\s]+/i,
    /API_KEY\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}/i,
    /SECRET_KEY\s*[=:]\s*['"]?[^'"}\s]+/i,
    /AWS_SECRET_ACCESS_KEY/i,
    /-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----/,
    /password\s*[=:]\s*['"]?[^'"}\s]{4,}/i,
    /mysql:\/\/[^:]+:[^@]+@/i,
    /postgres:\/\/[^:]+:[^@]+@/i,
    /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/i,
  ],
  high: [
    /stack\s*trace/i,
    /Traceback \(most recent call last\)/,
    /at [A-Za-z0-9_$]+\.[A-Za-z0-9_$]+\([^)]*:\d+\)/,
    /Fatal error:/i,
    /Parse error:/i,
    /java\.lang\.\w+Exception/,
    /xdebug/i,
    /debugbar/i,
    /\[core\]\s*\n\s*repositoryformatversion/i,
  ],
  medium: [
    /PHP\/\d+\.\d+/,
    /Apache\/\d+\.\d+/,
    /nginx\/\d+\.\d+/,
    /\/home\/[a-z]+\//i,
    /\/var\/www\//i,
    /debug\s*[=:]\s*true/i,
  ],
  low: [
    /Warning:/i,
    /Notice:/i,
    /Deprecated:/i,
  ]
};

// Response headers that indicate debug mode
const debugHeaders = [
  'x-debug', 'x-debug-token', 'x-debug-link',
  'x-debugbar', 'x-powered-by', 'server',
  'x-aspnet-version', 'x-aspnetmvc-version'
];

// ============================================================================
// SETTINGS
// ============================================================================

async function getSettings() {
  const result = await chrome.storage.sync.get([
    'enabled',
    'detectionMode',
    'requireDebugIndicators',
    'detectStatusChanges',
    'detectHeaderChanges',
    'filterDynamicContent',
    'similarityThreshold',
    'minLengthDiff',
    'checkInterval',
    'dynamicPatterns',
    'baseDelay',
    'maxConcurrent',
    'whitelist'
  ]);

  return {
    enabled: result.enabled !== false, // Enabled by default
    detectionMode: result.detectionMode || 'smart',
    requireDebugIndicators: result.requireDebugIndicators !== false,
    detectStatusChanges: result.detectStatusChanges !== false,
    detectHeaderChanges: result.detectHeaderChanges !== false,
    filterDynamicContent: result.filterDynamicContent !== false,
    similarityThreshold: result.similarityThreshold || 0.90,
    minLengthDiff: result.minLengthDiff || 200,
    checkInterval: (result.checkInterval || 480) * 60 * 1000,
    dynamicPatterns: result.dynamicPatterns || [],
    baseDelay: result.baseDelay || 300,
    maxConcurrent: parseInt(result.maxConcurrent) || 3,
    whitelist: result.whitelist || []
  };
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const rateLimitState = new Map();

async function rateLimitedFetch(url, options = {}) {
  const settings = await getSettings();
  const domain = new URL(url).hostname;

  if (!rateLimitState.has(domain)) {
    rateLimitState.set(domain, { delay: settings.baseDelay, lastRequest: 0 });
  }

  const state = rateLimitState.get(domain);
  const now = Date.now();
  const timeSince = now - state.lastRequest;

  if (timeSince < state.delay) {
    await new Promise(r => setTimeout(r, state.delay - timeSince));
  }

  state.lastRequest = Date.now();

  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });

    if ([429, 503, 502].includes(response.status)) {
      state.delay = Math.min(state.delay * 2, 10000);
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
      }
      throw new Error(`Rate limited: ${response.status}`);
    }

    // Recover delay on success
    state.delay = Math.max(state.delay * 0.9, settings.baseDelay);
    return response;
  } catch (error) {
    if (error.name === 'TimeoutError') {
      state.delay = Math.min(state.delay * 1.5, 10000);
    }
    throw error;
  }
}

// ============================================================================
// CONTENT FILTERING & COMPARISON
// ============================================================================

function filterDynamicContent(text, customPatterns = []) {
  let filtered = text;

  // Apply default patterns
  for (const pattern of DEFAULT_DYNAMIC_PATTERNS) {
    filtered = filtered.replace(pattern, '[DYNAMIC]');
  }

  // Apply custom patterns
  for (const patternStr of customPatterns) {
    try {
      const pattern = new RegExp(patternStr, 'gi');
      filtered = filtered.replace(pattern, '[CUSTOM_DYNAMIC]');
    } catch (e) {
      // Invalid regex, skip
    }
  }

  return filtered;
}

function containsDebugIndicators(text) {
  for (const level of ['critical', 'high', 'medium', 'low']) {
    for (const pattern of debugIndicators[level]) {
      if (pattern.test(text)) {
        return { found: true, level };
      }
    }
  }
  return { found: false, level: null };
}

function getLevelPriority(level) {
  const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
  return priorities[level] || 0;
}

function extractInterestingHeaders(response) {
  const found = {};
  for (const header of debugHeaders) {
    const value = response.headers.get(header);
    if (value) {
      found[header] = value;
    }
  }
  return found;
}

function compareHeaders(original, modified) {
  const changes = [];

  // Check for new headers in modified response
  for (const [key, value] of Object.entries(modified)) {
    if (!original[key]) {
      changes.push({ type: 'added', header: key, value });
    } else if (original[key] !== value) {
      changes.push({ type: 'changed', header: key, from: original[key], to: value });
    }
  }

  return changes;
}

// ============================================================================
// MULTI-FACTOR COMPARISON
// ============================================================================

async function analyzeResponseDifference(originalResponse, modifiedResponse, originalText, modifiedText, settings, naturalVariance = null) {
  const result = {
    isDifferent: false,
    confidence: 0,
    reasons: [],
    severity: 'low',
    debugIndicators: null,
    headerChanges: [],
    requiresVarianceCheck: false, // Flag to trigger control request verification
  };

  // 1. Status code change detection
  if (settings.detectStatusChanges && originalResponse.status !== modifiedResponse.status) {
    result.reasons.push(`Status changed: ${originalResponse.status} → ${modifiedResponse.status}`);
    result.confidence += 30;

    // Special cases
    if (originalResponse.status === 403 && modifiedResponse.status === 200) {
      result.confidence += 40; // Bypass!
      result.severity = 'critical';
    } else if (modifiedResponse.status >= 500) {
      result.confidence += 20; // Server error triggered
      result.severity = 'high';
    }
  }

  // 2. Header changes
  if (settings.detectHeaderChanges) {
    const originalHeaders = extractInterestingHeaders(originalResponse);
    const modifiedHeaders = extractInterestingHeaders(modifiedResponse);
    result.headerChanges = compareHeaders(originalHeaders, modifiedHeaders);

    if (result.headerChanges.length > 0) {
      result.reasons.push(`Header changes detected: ${result.headerChanges.length}`);
      result.confidence += 15 * result.headerChanges.length;
    }
  }

  // 3. Content length difference (variance-aware)
  const lengthDiff = Math.abs(modifiedText.length - originalText.length);
  // If we know the site's natural variance, only count if difference EXCEEDS natural variance
  const isLengthWithinVariance = naturalVariance && lengthDiff <= naturalVariance.lengthDiff * 1.2;

  if (!isLengthWithinVariance && lengthDiff >= settings.minLengthDiff) {
    result.reasons.push(`Content length diff: ${lengthDiff} bytes`);
    result.confidence += Math.min(lengthDiff / 100, 25);
  }

  // 4. Debug indicator detection - only count if NEW (not present in original)
  const debugCheckModified = containsDebugIndicators(modifiedText);
  const debugCheckOriginal = containsDebugIndicators(originalText);

  // Only consider debug indicators that are NEW (caused by the param/header)
  // If the same level of indicator exists in original, it's not caused by our test
  const debugCheck = {
    found: debugCheckModified.found && (!debugCheckOriginal.found ||
           getLevelPriority(debugCheckModified.level) > getLevelPriority(debugCheckOriginal.level)),
    level: debugCheckModified.level,
  };

  if (debugCheck.found) {
    result.debugIndicators = debugCheck;
    result.reasons.push(`Debug indicators found: ${debugCheck.level}`);
    result.confidence += debugCheck.level === 'critical' ? 50 : debugCheck.level === 'high' ? 35 : 20;

    if (debugCheck.level === 'critical') result.severity = 'critical';
    else if (debugCheck.level === 'high' && result.severity !== 'critical') result.severity = 'high';
    else if (debugCheck.level === 'medium' && !['critical', 'high'].includes(result.severity)) result.severity = 'medium';
  }

  // 5. Similarity check (after filtering dynamic content, variance-aware)
  let originalFiltered = originalText;
  let modifiedFiltered = modifiedText;

  if (settings.filterDynamicContent) {
    originalFiltered = filterDynamicContent(originalText, settings.dynamicPatterns);
    modifiedFiltered = filterDynamicContent(modifiedText, settings.dynamicPatterns);
  }

  const similarity = stringSimilarity.compareTwoStrings(originalFiltered, modifiedFiltered);

  // If we know the site's natural variance, only count if similarity is WORSE than natural variance
  // E.g., if site naturally has 92% similarity between requests, only flag if this request is < 90%
  const isSimilarityWithinVariance = naturalVariance && similarity >= naturalVariance.similarity - 0.02;

  if (!isSimilarityWithinVariance && similarity < settings.similarityThreshold) {
    result.reasons.push(`Similarity: ${(similarity * 100).toFixed(1)}%`);
    result.confidence += (1 - similarity) * 30;
  }

  // If we have confidence but NO debug indicators, always verify with variance check
  // This prevents false positives on dynamic sites (login pages, news sites, etc.)
  if (!naturalVariance && !debugCheck.found && result.confidence > 0) {
    result.requiresVarianceCheck = true;
  }

  // Only critical/high/medium indicators count as significant (low like "Warning:" can appear in normal pages)
  const hasSignificantDebugIndicators = debugCheck.found && ['critical', 'high', 'medium'].includes(debugCheck.level);

  // Determine if response is different based on mode
  switch (settings.detectionMode) {
    case 'aggressive':
      // Any signal counts
      result.isDifferent = result.confidence >= 15;
      break;

    case 'conservative':
      // Needs debug indicators AND other signals
      result.isDifferent = result.confidence >= 50 && debugCheck.found;
      break;

    case 'keywords-only':
      // Only debug indicators matter
      result.isDifferent = debugCheck.found;
      break;

    case 'smart':
    default:
      // Smart mode: require clear evidence to avoid false positives on dynamic sites
      const hasStatusBypass = originalResponse.status === 403 && modifiedResponse.status === 200;
      const hasServerError = modifiedResponse.status >= 500;
      // Check if content is significantly different (not just dynamic variation)
      const isSignificantlyDifferent = similarity < 0.70;
      // Debug indicators in modified response (even if also in original)
      const hasAnyDebugIndicators = debugCheckModified.found && ['critical', 'high', 'medium'].includes(debugCheckModified.level);

      if (hasStatusBypass || hasServerError) {
        // Clear signal - status change is strong evidence
        result.isDifferent = true;
      } else if (hasSignificantDebugIndicators) {
        // NEW debug indicators found - report
        result.isDifferent = result.confidence >= 40;
      } else if (hasAnyDebugIndicators && isSignificantlyDifferent) {
        // Debug indicators exist AND content is very different - likely more debug info triggered
        result.isDifferent = true;
      } else {
        // No clear evidence - don't report to avoid FPs on dynamic sites
        result.isDifferent = false;
      }
      break;
  }

  return result;
}

// ============================================================================
// STORAGE
// ============================================================================

async function getFindings() {
  const result = await chrome.storage.local.get(['findings']);
  return result.findings || { params: [], headers: [], paths: [] };
}

async function saveFindings(findings) {
  await chrome.storage.local.set({ findings });
  updateBadge(findings);
}

async function addFinding(type, data) {
  const findings = await getFindings();

  const exists = findings[type].some(f => {
    if (type === 'params') return f.url === data.url;
    if (type === 'headers') return f.url === data.url && f.header === data.header;
    return f.path === data.path;
  });

  if (!exists) {
    findings[type].push({ ...data, timestamp: Date.now() });
    findings[type].sort((a, b) => {
      const scores = { critical: 4, high: 3, medium: 2, low: 1 };
      return (scores[b.severity] || 0) - (scores[a.severity] || 0);
    });
    await saveFindings(findings);

    const colors = { critical: '#e74c3c', high: '#e67e22', medium: '#f1c40f', low: '#3498db' };
    console.log(`%c[debugHunter] [${data.severity?.toUpperCase()}] ${type}: ${data.url || data.path}`,
      `background: ${colors[data.severity] || '#27ae60'}; color: white; padding: 2px 6px; border-radius: 3px`);
  }
}

async function removeFinding(type, identifier) {
  const findings = await getFindings();
  findings[type] = findings[type].filter(f => {
    if (type === 'params') return f.url !== identifier;
    if (type === 'headers') return `${f.url}|${f.header}` !== identifier;
    return f.path !== identifier;
  });
  await saveFindings(findings);
}

async function clearFindings(type = null) {
  if (type) {
    const findings = await getFindings();
    findings[type] = [];
    await saveFindings(findings);
  } else {
    await saveFindings({ params: [], headers: [], paths: [] });
  }
}

function updateBadge(findings) {
  const total = findings.params.length + findings.headers.length + findings.paths.length;
  const all = [...findings.params, ...findings.headers, ...findings.paths];
  const hasCritical = all.some(f => f.severity === 'critical');
  const hasHigh = all.some(f => f.severity === 'high');

  let color = '#3498db';
  if (hasCritical) color = '#e74c3c';
  else if (hasHigh) color = '#e67e22';

  chrome.action.setBadgeText({ text: total > 0 ? total.toString() : '' });
  chrome.action.setBadgeBackgroundColor({ color });
}

// ============================================================================
// SCAN STATUS
// ============================================================================

let scanStatus = { active: false, domain: '' };

function updateScanStatus(status) {
  scanStatus = { ...scanStatus, ...status };
  try { chrome.runtime.sendMessage({ action: 'scanStatus', status: scanStatus }); } catch (e) {}
}

// ============================================================================
// URL VALIDATION
// ============================================================================

async function shouldScanUrl(url) {
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
      url.startsWith('about:') || url.startsWith('file://')) {
    return false;
  }

  const settings = await getSettings();
  const { hostname } = new URL(url);

  // Check whitelist
  for (const pattern of settings.whitelist) {
    const parts = pattern.split('.').reverse();
    const hostParts = hostname.split('.').reverse();
    let match = true;
    for (let i = 0; i < parts.length && match; i++) {
      if (parts[i] !== '*' && parts[i] !== hostParts[i]) match = false;
    }
    if (match) return false;
  }

  // Check interval
  const result = await chrome.storage.local.get(['checkedUrls']);
  const checked = result.checkedUrls || {};
  const lastChecked = checked[url];

  if (lastChecked && (Date.now() - lastChecked < settings.checkInterval)) {
    return false;
  }

  checked[url] = Date.now();
  await chrome.storage.local.set({ checkedUrls: checked });
  return true;
}

function isSoft404(text) {
  const lower = text.toLowerCase();
  return soft404Indicators.some(i => lower.includes(i.toLowerCase()));
}

function truncateForStorage(text, max = 5000) {
  return text.length <= max ? text : text.substring(0, max) + '\n... [truncated]';
}

// ============================================================================
// BASELINE CACHE FOR PARAMS/HEADERS (avoid duplicate requests)
// ============================================================================

const urlBaselineCache = new Map();

async function getUrlBaseline(url) {
  if (urlBaselineCache.has(url)) {
    const cached = urlBaselineCache.get(url);
    if (Date.now() - cached.timestamp < 60000) { // 1 min cache
      return cached;
    }
  }

  try {
    const response = await rateLimitedFetch(url);
    const text = await response.text();

    const cached = {
      response: {
        status: response.status,
        headers: Object.fromEntries([...response.headers.entries()]),
      },
      text,
      timestamp: Date.now(),
    };

    // Mock response object for analysis
    cached.mockResponse = {
      status: cached.response.status,
      headers: { get: (key) => cached.response.headers[key.toLowerCase()] },
    };

    urlBaselineCache.set(url, cached);
    return cached;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// NATURAL VARIANCE MEASUREMENT (for dynamic sites)
// ============================================================================

const varianceCache = new Map();

async function measureNaturalVariance(url, baselineText, settings, useRandomParam = false) {
  // Cache key includes whether we're measuring with params
  const cacheKey = useRandomParam ? `${url}#withParam` : url;

  // Check cache first (valid for 2 minutes)
  if (varianceCache.has(cacheKey)) {
    const cached = varianceCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 120000) {
      return cached.variance;
    }
  }

  try {
    // For params, measure variance by adding a random param to see how the site responds
    // This catches sites that return different content when ANY query param is present
    let controlUrl = url;
    if (useRandomParam) {
      const randomParam = `_rnd${Math.random().toString(36).substring(7)}`;
      const urlObj = new URL(url);
      urlObj.searchParams.set(randomParam, '1');
      controlUrl = urlObj.href;
    }

    const controlResponse = await rateLimitedFetch(controlUrl);
    const controlText = await controlResponse.text();

    // Filter dynamic content before comparison
    let baselineFiltered = baselineText;
    let controlFiltered = controlText;

    if (settings.filterDynamicContent) {
      baselineFiltered = filterDynamicContent(baselineText, settings.dynamicPatterns);
      controlFiltered = filterDynamicContent(controlText, settings.dynamicPatterns);
    }

    // Calculate natural variance between baseline and control
    const naturalSimilarity = stringSimilarity.compareTwoStrings(baselineFiltered, controlFiltered);
    const naturalLengthDiff = Math.abs(controlText.length - baselineText.length);

    const variance = {
      similarity: naturalSimilarity,
      lengthDiff: naturalLengthDiff,
      // Site is "highly dynamic" if requests differ significantly
      isHighlyDynamic: naturalSimilarity < 0.95,
    };

    varianceCache.set(cacheKey, { variance, timestamp: Date.now() });
    return variance;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// PARAMETER CHECKING (uses cached baseline)
// ============================================================================

function appendParam(url, param) {
  const u = new URL(url);
  u.searchParams.set(param.key, param.value);
  return u.href;
}

async function checkParams(url, baseline = null) {
  const settings = await getSettings();

  try {
    // Use provided baseline or fetch new one
    if (!baseline) {
      baseline = await getUrlBaseline(url);
    }
    if (!baseline) return;

    // Check high-confidence params first
    const sortedParams = [
      ...debugParams.high.map(p => ({ ...p, confidence: 'high' })),
      ...debugParams.medium.map(p => ({ ...p, confidence: 'medium' })),
    ];

    // Track if we've measured variance for this URL (lazy - only when needed)
    let measuredVariance = null;

    for (const param of sortedParams) {
      const modifiedUrl = appendParam(url, param);

      try {
        const modifiedResponse = await rateLimitedFetch(modifiedUrl);
        const modifiedText = await modifiedResponse.text();

        // First analysis without variance
        let analysis = await analyzeResponseDifference(
          baseline.mockResponse, modifiedResponse,
          baseline.text, modifiedText,
          settings,
          measuredVariance
        );

        // If flagged but needs variance verification (no debug indicators found)
        if (analysis.isDifferent && analysis.requiresVarianceCheck && !measuredVariance) {
          // Measure variance with a random param to see how site responds to ANY query param
          // This catches sites that return different content when params are present (vs absent)
          measuredVariance = await measureNaturalVariance(url, baseline.text, settings, true);

          if (measuredVariance) {
            // Re-analyze with variance knowledge - always re-check, not just for highly dynamic sites
            analysis = await analyzeResponseDifference(
              baseline.mockResponse, modifiedResponse,
              baseline.text, modifiedText,
              settings,
              measuredVariance
            );
          }
        }

        if (analysis.isDifferent) {
          await addFinding('params', {
            url: modifiedUrl,
            baseUrl: url,
            param: `${param.key}=${param.value}`,
            confidence: param.confidence,
            severity: analysis.severity,
            reasons: analysis.reasons,
            originalResponse: truncateForStorage(baseline.text),
            modifiedResponse: truncateForStorage(modifiedText),
          });
        }
      } catch (e) {
        // Skip this param on error
      }
    }
  } catch (error) {
    console.error(`[debugHunter] Params check failed: ${error.message}`);
  }
}

// ============================================================================
// HEADER CHECKING (uses cached baseline)
// ============================================================================

async function checkHeaders(url, baseline = null) {
  const settings = await getSettings();

  try {
    // Use provided baseline or fetch new one
    if (!baseline) {
      baseline = await getUrlBaseline(url);
    }
    if (!baseline) return;

    // Track if we've measured variance for this URL (lazy - only when needed)
    let measuredVariance = null;

    for (const header of customHeaders) {
      try {
        const headers = new Headers();
        headers.set(header.key, header.value);

        const modifiedResponse = await rateLimitedFetch(url, { headers });
        const modifiedText = await modifiedResponse.text();

        // First analysis without variance
        let analysis = await analyzeResponseDifference(
          baseline.mockResponse, modifiedResponse,
          baseline.text, modifiedText,
          settings,
          measuredVariance
        );

        // If flagged but needs variance verification (no debug indicators found)
        if (analysis.isDifferent && analysis.requiresVarianceCheck && !measuredVariance) {
          // Measure natural variance with a control request
          measuredVariance = await measureNaturalVariance(url, baseline.text, settings);

          if (measuredVariance) {
            // Re-analyze with variance knowledge - always re-check, not just for highly dynamic sites
            analysis = await analyzeResponseDifference(
              baseline.mockResponse, modifiedResponse,
              baseline.text, modifiedText,
              settings,
              measuredVariance
            );
          }
        }

        if (analysis.isDifferent) {
          await addFinding('headers', {
            url,
            header: `${header.key}: ${header.value}`,
            severity: analysis.severity,
            reasons: analysis.reasons,
            originalResponse: truncateForStorage(baseline.text),
            modifiedResponse: truncateForStorage(modifiedText),
          });
        }
      } catch (e) {
        // Skip this header on error
      }
    }
  } catch (error) {
    console.error(`[debugHunter] Headers check failed: ${error.message}`);
  }
}

// ============================================================================
// PATH CHECKING (Optimized with HEAD requests + domain caching)
// ============================================================================

// Cache for domain baselines and soft-404 fingerprints
const domainCache = new Map();

// Normalize redirect URL for comparison (resolves relative URLs, removes trailing slashes)
function normalizeRedirectUrl(location, baseUrl) {
  try {
    const resolved = new URL(location, baseUrl);
    // Return pathname without trailing slash for consistent comparison
    return resolved.pathname.replace(/\/$/, '') || '/';
  } catch (e) {
    return location;
  }
}

// Check if a redirect is just URL normalization (trailing slash, case change)
function isNormalizationRedirect(originalPath, redirectPath) {
  const normalizedOriginal = originalPath.replace(/\/$/, '').toLowerCase();
  const normalizedRedirect = redirectPath.replace(/\/$/, '').toLowerCase();
  return normalizedOriginal === normalizedRedirect;
}

async function getDomainBaseline(baseUrl) {
  if (domainCache.has(baseUrl)) {
    const cached = domainCache.get(baseUrl);
    if (Date.now() - cached.timestamp < 300000) { // 5 min cache
      return cached;
    }
  }

  try {
    // Get baseline response
    const baseResponse = await rateLimitedFetch(baseUrl);
    const baseText = await baseResponse.text();

    // Get soft-404 fingerprint and catch-all redirect (request a random non-existent path)
    const randomPath = `/${Math.random().toString(36).substring(7)}-${Date.now()}`;
    let soft404Fingerprint = null;
    let soft404Length = 0;
    let catchAllRedirect = null;

    try {
      // Use redirect: 'manual' to detect catch-all redirects
      const soft404Response = await rateLimitedFetch(baseUrl + randomPath, { redirect: 'manual' });

      // Check if the random path redirects somewhere (catch-all redirect pattern)
      if (soft404Response.status >= 300 && soft404Response.status < 400) {
        const location = soft404Response.headers.get('location');
        if (location) {
          // Normalize the redirect URL for comparison
          catchAllRedirect = normalizeRedirectUrl(location, baseUrl);
        }
      }

      // For fingerprinting, follow the redirect to get actual content
      const finalResponse = await rateLimitedFetch(baseUrl + randomPath);
      const soft404Text = await finalResponse.text();
      soft404Length = soft404Text.length;
      // Create a fingerprint based on content structure, not exact content
      soft404Fingerprint = {
        status: finalResponse.status,
        length: soft404Text.length,
        hasTitle: /<title>/i.test(soft404Text),
        isSoft404: isSoft404(soft404Text),
      };
    } catch (e) {
      // Couldn't get soft-404, that's fine
    }

    const cached = {
      baseText,
      baseLength: baseText.length,
      soft404Fingerprint,
      soft404Length,
      catchAllRedirect,
      timestamp: Date.now(),
    };

    domainCache.set(baseUrl, cached);
    return cached;
  } catch (e) {
    return null;
  }
}

function matchesSoft404(response, text, fingerprint) {
  if (!fingerprint) return false;

  // If it returned the same status as our random 404 probe (non-200)
  if (fingerprint.status === response.status && fingerprint.status !== 200) {
    return true;
  }

  const lengthDiff = Math.abs(text.length - fingerprint.length);
  const lengthRatio = lengthDiff / fingerprint.length;

  // If content length is nearly identical (within 3%), very likely the same page
  // This catches soft-404s that return 200 without "404" text
  if (lengthRatio < 0.03) {
    return true;
  }

  // If content length is similar (within 10%) AND has soft-404 indicators
  if (lengthRatio < 0.1 && fingerprint.isSoft404) {
    return true;
  }

  return false;
}

async function checkPathWithHead(baseUrl, path, settings, catchAllRedirect = null) {
  const testUrl = baseUrl + path;

  try {
    // First, try HEAD request with redirect: manual to detect catch-all redirects
    const headResponse = await rateLimitedFetch(testUrl, { method: 'HEAD', redirect: 'manual' });

    // Check for redirects (3xx status codes)
    if (headResponse.status >= 300 && headResponse.status < 400) {
      const location = headResponse.headers.get('location');
      if (location && catchAllRedirect) {
        const redirectPath = normalizeRedirectUrl(location, baseUrl);
        // Only skip if it redirects to the SAME place as the random path probe
        if (redirectPath === catchAllRedirect && !isNormalizationRedirect(path, redirectPath)) {
          return null; // Catch-all redirect - false positive
        }
      }
      // For other redirects, continue and follow them (could be legit /admin -> /admin/login)
    }

    // Only proceed if status indicates potential content (or redirect that we'll follow)
    if (headResponse.status === 200 || headResponse.status === 403 ||
        (headResponse.status >= 300 && headResponse.status < 400)) {
      const contentLength = parseInt(headResponse.headers.get('content-length') || '0');

      // Skip if too small (likely empty or error) - but only for 200 responses
      if (headResponse.status === 200 && contentLength > 0 && contentLength < 30) return null;

      // Now do full GET to analyze content (this will follow redirects)
      const response = await rateLimitedFetch(testUrl);
      if (response.status === 200) {
        return { response, url: testUrl };
      }
    }
  } catch (e) {
    // Try direct GET if HEAD fails (some servers don't support HEAD)
    try {
      // Check for catch-all redirect first
      const getResponse = await rateLimitedFetch(testUrl, { redirect: 'manual' });

      if (getResponse.status >= 300 && getResponse.status < 400 && catchAllRedirect) {
        const location = getResponse.headers.get('location');
        if (location) {
          const redirectPath = normalizeRedirectUrl(location, baseUrl);
          if (redirectPath === catchAllRedirect && !isNormalizationRedirect(path, redirectPath)) {
            return null; // Catch-all redirect - false positive
          }
        }
      }

      // Follow the redirect and get final content
      const response = await rateLimitedFetch(testUrl);
      if (response.status === 200) {
        return { response, url: testUrl };
      }
    } catch (e2) {
      // Skip this path
    }
  }

  return null;
}

async function checkPaths(url) {
  const settings = await getSettings();

  try {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`; // Use .host to include port

    // Get cached domain baseline
    const baseline = await getDomainBaseline(baseUrl);
    if (!baseline) return;

    // Flatten paths with severity, checking critical first
    const allPaths = [
      ...sensitivePaths.critical.map(p => ({ path: p, severity: 'critical' })),
      ...sensitivePaths.high.map(p => ({ path: p, severity: 'high' })),
      ...sensitivePaths.medium.map(p => ({ path: p, severity: 'medium' })),
    ];

    // Check paths in batches to reduce concurrent requests
    const batchSize = 3;
    for (let i = 0; i < allPaths.length; i += batchSize) {
      const batch = allPaths.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(({ path, severity }) =>
          checkPathWithHead(baseUrl, path, settings, baseline.catchAllRedirect).then(result =>
            result ? { ...result, severity, path } : null
          )
        )
      );

      for (const result of results.filter(Boolean)) {
        try {
          const pathText = await result.response.text();

          // Skip if matches soft-404 fingerprint
          if (matchesSoft404(result.response, pathText, baseline.soft404Fingerprint)) {
            continue;
          }

          // Skip common soft-404 indicators
          if (isSoft404(pathText)) continue;
          if (pathText.length < 50) continue;

          // Check for debug indicators (upgrades severity if found)
          const debugCheck = containsDebugIndicators(pathText);
          const severity = debugCheck.found ? debugCheck.level : result.severity;

          // Path exists and is not soft-404 - report it!
          // No diff comparison needed since these are different paths
          await addFinding('paths', {
            path: result.url,
            severity,
            contentLength: pathText.length,
            hasDebugInfo: debugCheck.found,
            modifiedResponse: truncateForStorage(pathText),
          });
        } catch (e) {
          // Skip on error
        }
      }
    }
  } catch (error) {
    console.error(`[debugHunter] Paths check failed: ${error.message}`);
  }
}

// ============================================================================
// MAIN SCANNER
// ============================================================================

async function scanUrl(url) {
  const settings = await getSettings();

  // Check if scanning is enabled globally
  if (!settings.enabled) return;

  if (!await shouldScanUrl(url)) return;

  const domain = new URL(url).hostname;
  updateScanStatus({ active: true, domain });

  console.log(`%c[debugHunter] Scanning: ${url}`, 'background: #9b59b6; color: white; padding: 2px 6px; border-radius: 3px');

  // Get baseline once for params and headers (saves 1 request)
  const baseline = await getUrlBaseline(url);

  // Run checks based on maxConcurrent setting
  if (settings.maxConcurrent >= 3) {
    await Promise.all([
      checkParams(url, baseline),
      checkHeaders(url, baseline),
      checkPaths(url)  // Paths uses domain baseline, not URL baseline
    ]);
  } else {
    await checkParams(url, baseline);
    await checkHeaders(url, baseline);
    await checkPaths(url);
  }

  updateScanStatus({ active: false, domain: '' });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const url = new URL(tab.url);
      url.hash = '';
      await scanUrl(url.toString());
    } catch (e) {}
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'getFindings':
        sendResponse(await getFindings());
        break;
      case 'removeFinding':
        await removeFinding(message.type, message.identifier);
        sendResponse(await getFindings());
        break;
      case 'clearFindings':
        await clearFindings(message.type);
        sendResponse(await getFindings());
        break;
      case 'clearAll':
        await clearFindings();
        sendResponse(await getFindings());
        break;
      case 'getScanStatus':
        sendResponse(scanStatus);
        break;
      case 'getEnabled': {
        const enabledSettings = await getSettings();
        sendResponse({ enabled: enabledSettings.enabled });
        break;
      }
      case 'setEnabled': {
        await chrome.storage.sync.set({ enabled: message.enabled });
        // Update badge to reflect state
        if (!message.enabled) {
          chrome.action.setBadgeText({ text: 'OFF' });
          chrome.action.setBadgeBackgroundColor({ color: '#6e7681' });
        } else {
          const currentFindings = await getFindings();
          updateBadge(currentFindings);
        }
        sendResponse({ enabled: message.enabled });
        break;
      }
      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  if (!settings.enabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6e7681' });
  } else {
    const findings = await getFindings();
    updateBadge(findings);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (!settings.enabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6e7681' });
  } else {
    const findings = await getFindings();
    updateBadge(findings);
  }
});

console.log('[debugHunter] Service worker v2.0.1 - Multi-factor detection');
