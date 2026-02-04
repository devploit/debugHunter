/**
 * debugHunter v2.0.0 - Options Script
 * Advanced settings management
 */

// Default dynamic content patterns to filter before comparison
const DEFAULT_DYNAMIC_PATTERNS = [
  '\\b\\d{10,13}\\b',                          // Unix timestamps
  '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}', // ISO dates
  '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', // UUIDs
  'csrf[_-]?token["\']?\\s*[:=]\\s*["\']?[^"\'\\s]+', // CSRF tokens
  'nonce["\']?\\s*[:=]\\s*["\']?[^"\'\\s]+',   // Nonces
  '_token["\']?\\s*[:=]\\s*["\']?[^"\'\\s]+',  // Laravel tokens
  'session[_-]?id["\']?\\s*[:=]\\s*["\']?[^"\'\\s]+', // Session IDs
  'PHPSESSID=[^;\\s]+',                         // PHP session
  'JSESSIONID=[^;\\s]+',                        // Java session
  'ASP\\.NET_SessionId=[^;\\s]+',               // .NET session
  '\\?v=\\d+',                                  // Cache busters
  '\\?_=\\d+',                                  // jQuery cache buster
  'data-request-id="[^"]+"',                   // Request IDs
  'data-nonce="[^"]+"',                        // Data nonces
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showSaved(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }
}

function saveOption(key, value, savedIndicatorId = null) {
  chrome.storage.sync.set({ [key]: value }, () => {
    console.log(`[debugHunter] Saved ${key}:`, value);
    if (savedIndicatorId) {
      showSaved(savedIndicatorId);
    }
  });
}

function loadOptions(callback) {
  chrome.storage.sync.get([
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
  ], callback);
}

// ============================================================================
// RANGE INPUTS
// ============================================================================

function setupRangeInput(inputId, valueId, savedId, storageKey, defaultValue, transform = (v) => v) {
  const input = document.getElementById(inputId);
  const value = document.getElementById(valueId);

  if (!input || !value) return;

  // Load saved value
  chrome.storage.sync.get(storageKey, (data) => {
    const val = data[storageKey] !== undefined ? data[storageKey] : defaultValue;
    input.value = val;
    value.textContent = val;
  });

  // Save on change
  input.addEventListener('input', (e) => {
    const val = transform(e.target.value);
    value.textContent = e.target.value;
    saveOption(storageKey, val, savedId);
  });
}

// ============================================================================
// CHECKBOXES
// ============================================================================

function setupCheckbox(inputId, storageKey, defaultValue = true) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Load saved value
  chrome.storage.sync.get(storageKey, (data) => {
    input.checked = data[storageKey] !== undefined ? data[storageKey] : defaultValue;
  });

  // Save on change
  input.addEventListener('change', (e) => {
    saveOption(storageKey, e.target.checked);
  });
}

// ============================================================================
// SELECT INPUTS
// ============================================================================

function setupSelect(inputId, storageKey, defaultValue) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Load saved value
  chrome.storage.sync.get(storageKey, (data) => {
    input.value = data[storageKey] !== undefined ? data[storageKey] : defaultValue;
  });

  // Save on change
  input.addEventListener('change', (e) => {
    saveOption(storageKey, e.target.value);
  });
}

// ============================================================================
// TEXTAREA (Dynamic Patterns)
// ============================================================================

function setupDynamicPatterns() {
  const textarea = document.getElementById('dynamicPatterns');
  if (!textarea) return;

  // Load saved patterns
  chrome.storage.sync.get('dynamicPatterns', (data) => {
    if (data.dynamicPatterns && data.dynamicPatterns.length > 0) {
      textarea.value = data.dynamicPatterns.join('\n');
    } else {
      textarea.placeholder = DEFAULT_DYNAMIC_PATTERNS.slice(0, 5).join('\n') + '\n...';
    }
  });

  // Save on change (debounced)
  let timeout;
  textarea.addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const patterns = e.target.value
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      saveOption('dynamicPatterns', patterns);
    }, 500);
  });
}

// ============================================================================
// WHITELIST
// ============================================================================

function renderWhitelist(whitelist) {
  const container = document.getElementById('whitelistItems');
  if (!container) return;

  container.innerHTML = '';

  if (!whitelist || whitelist.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">No whitelisted domains</div>';
    return;
  }

  whitelist.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'whitelist-item';
    item.innerHTML = `
      <span>${domain}</span>
      <button data-domain="${domain}" title="Remove"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(item);
  });

  // Add remove handlers
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = btn.dataset.domain;
      removeFromWhitelist(domain);
    });
  });
}

function removeFromWhitelist(domain) {
  chrome.storage.sync.get('whitelist', (data) => {
    let whitelist = data.whitelist || [];
    whitelist = whitelist.filter(d => d !== domain);
    chrome.storage.sync.set({ whitelist }, () => {
      console.log('[debugHunter] Removed from whitelist:', domain);
      renderWhitelist(whitelist);
    });
  });
}

function addToWhitelist(domain) {
  if (!domain) return;

  chrome.storage.sync.get('whitelist', (data) => {
    let whitelist = data.whitelist || [];
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      chrome.storage.sync.set({ whitelist }, () => {
        console.log('[debugHunter] Added to whitelist:', domain);
        renderWhitelist(whitelist);
      });
    }
  });
}

function setupWhitelist() {
  // Load initial whitelist
  chrome.storage.sync.get('whitelist', (data) => {
    renderWhitelist(data.whitelist || []);
  });

  // Handle add form
  const form = document.getElementById('addWhitelistForm');
  const input = document.getElementById('newWhitelistDomain');

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const domain = input.value.trim().toLowerCase();
      if (domain) {
        addToWhitelist(domain);
        input.value = '';
      }
    });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Detection mode
  setupSelect('detectionMode', 'detectionMode', 'smart');

  // Checkboxes
  setupCheckbox('requireDebugIndicators', 'requireDebugIndicators', true);
  setupCheckbox('detectStatusChanges', 'detectStatusChanges', true);
  setupCheckbox('detectHeaderChanges', 'detectHeaderChanges', true);
  setupCheckbox('filterDynamicContent', 'filterDynamicContent', true);

  // Range inputs
  setupRangeInput('similarityThreshold', 'similarityValue', 'similaritySaved', 'similarityThreshold', 0.90, parseFloat);
  setupRangeInput('minLengthDiff', 'lengthValue', 'lengthSaved', 'minLengthDiff', 200, parseInt);
  setupRangeInput('checkInterval', 'intervalValue', 'intervalSaved', 'checkInterval', 480, parseInt);
  setupRangeInput('baseDelay', 'delayValue', 'delaySaved', 'baseDelay', 300, parseInt);

  // Select inputs
  setupSelect('maxConcurrent', 'maxConcurrent', '3');

  // Dynamic patterns textarea
  setupDynamicPatterns();

  // Whitelist
  setupWhitelist();

  console.log('[debugHunter] Options page loaded');
});
