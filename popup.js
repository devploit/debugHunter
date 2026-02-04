/**
 * debugHunter v2.0.1 - Popup Script
 * Features: Diff viewer, Severity stats, Scan status
 */

// ============================================================================
// MESSAGING
// ============================================================================

async function sendMessage(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      resolve(response || { params: [], headers: [], paths: [] });
    });
  });
}

async function getFindings() {
  return await sendMessage('getFindings');
}

async function removeFinding(type, identifier) {
  return await sendMessage('removeFinding', { type, identifier });
}

async function clearFindings(type = null) {
  return await sendMessage(type ? 'clearFindings' : 'clearAll', { type });
}

async function getScanStatus() {
  return await sendMessage('getScanStatus');
}

async function getEnabled() {
  return await sendMessage('getEnabled');
}

async function setEnabled(enabled) {
  return await sendMessage('setEnabled', { enabled });
}

// ============================================================================
// SEVERITY STATS
// ============================================================================

function updateSeverityStats(findings) {
  const allFindings = [
    ...(findings.params || []),
    ...(findings.headers || []),
    ...(findings.paths || [])
  ];

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };

  allFindings.forEach(f => {
    if (f.severity && counts.hasOwnProperty(f.severity)) {
      counts[f.severity]++;
    }
  });

  document.getElementById('stat-critical').textContent = counts.critical;
  document.getElementById('stat-high').textContent = counts.high;
  document.getElementById('stat-medium').textContent = counts.medium;
  document.getElementById('stat-low').textContent = counts.low;
}

// ============================================================================
// SCAN STATUS
// ============================================================================

function updateScanStatusUI(status) {
  const statusBar = document.getElementById('status-bar');
  const statusDomain = document.getElementById('status-domain');

  if (status && status.active) {
    statusBar.classList.add('active');
    statusDomain.textContent = status.domain || 'unknown';
  } else {
    statusBar.classList.remove('active');
  }
}

// Listen for scan status updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'scanStatus') {
    updateScanStatusUI(message.status);
  }
});

// ============================================================================
// SEARCH / FILTER
// ============================================================================

let currentSearchTerm = '';

function filterFindings(searchTerm) {
  currentSearchTerm = searchTerm.toLowerCase().trim();
  const clearBtn = document.getElementById('search-clear');
  const resultsInfo = document.getElementById('search-results-info');
  const searchCount = document.getElementById('search-count');

  // Show/hide clear button
  clearBtn.classList.toggle('visible', currentSearchTerm.length > 0);

  // Get all finding items
  const allItems = document.querySelectorAll('.finding-item');
  let visibleCount = 0;

  allItems.forEach(item => {
    if (!currentSearchTerm) {
      item.classList.remove('hidden');
      visibleCount++;
    } else {
      // Search in URL, path, header, param, and other data attributes
      const url = item.querySelector('.finding-url');
      const meta = item.querySelector('.finding-meta');
      const searchText = [
        url?.textContent || '',
        url?.title || '',
        meta?.textContent || ''
      ].join(' ').toLowerCase();

      const matches = searchText.includes(currentSearchTerm);
      item.classList.toggle('hidden', !matches);
      if (matches) visibleCount++;
    }
  });

  // Show results info
  if (currentSearchTerm) {
    resultsInfo.classList.add('visible');
    searchCount.textContent = visibleCount;
  } else {
    resultsInfo.classList.remove('visible');
  }

  // Update category counts to show filtered counts
  ['paths', 'headers', 'params'].forEach(type => {
    const list = document.getElementById(`${type}-list`);
    if (list) {
      const visibleInCategory = list.querySelectorAll('.finding-item:not(.hidden)').length;
      const countEl = document.getElementById(`${type}-count`);
      if (countEl && currentSearchTerm) {
        countEl.textContent = visibleInCategory;
      }
    }
  });
}

function clearSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.value = '';
  filterFindings('');
  updateUI(); // Restore original counts
}

// ============================================================================
// DIFF VIEWER
// ============================================================================

let currentDiffData = null;

function showDiffModal(finding, type) {
  const modal = document.getElementById('diff-modal');
  const title = document.getElementById('modal-title');
  const originalContent = document.getElementById('diff-original');
  const modifiedContent = document.getElementById('diff-modified');

  currentDiffData = finding;

  // Set title based on type
  if (type === 'paths') {
    title.textContent = `Content: ${finding.path}`;
  } else if (type === 'headers') {
    title.textContent = `Diff: ${finding.header}`;
  } else {
    title.textContent = `Diff: ${finding.param}`;
  }

  // Set content (paths don't have originalResponse since they're different URLs)
  if (type === 'paths') {
    originalContent.textContent = '(Sensitive path found - no comparison needed)';
    modifiedContent.textContent = finding.modifiedResponse || 'No response stored';
  } else {
    originalContent.textContent = finding.originalResponse || 'No original response stored';
    modifiedContent.textContent = finding.modifiedResponse || 'No modified response stored';
  }

  modal.classList.add('active');
}

function hideDiffModal() {
  const modal = document.getElementById('diff-modal');
  modal.classList.remove('active');
  currentDiffData = null;
}

// ============================================================================
// UI RENDERING
// ============================================================================

function truncateUrl(url, maxLength = 55) {
  if (!url) return '';
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

function createFindingItem(data, type, identifier) {
  const item = document.createElement('div');
  item.className = 'finding-item';

  // Severity bar
  const severityBar = document.createElement('div');
  severityBar.className = `finding-severity ${data.severity || 'medium'}`;
  item.appendChild(severityBar);

  // Content
  const content = document.createElement('div');
  content.className = 'finding-content';

  // URL link
  const urlLink = document.createElement('a');
  urlLink.className = 'finding-url';
  urlLink.target = '_blank';

  if (type === 'paths') {
    urlLink.href = data.path;
    urlLink.textContent = truncateUrl(data.path);
    urlLink.title = data.path;
  } else if (type === 'headers') {
    urlLink.href = data.url;
    urlLink.textContent = truncateUrl(`${data.url}`);
    urlLink.title = `${data.url}\nHeader: ${data.header}`;
  } else {
    urlLink.href = data.url;
    urlLink.textContent = truncateUrl(data.url);
    urlLink.title = `${data.url}\nParam: ${data.param}`;
  }

  content.appendChild(urlLink);

  // Meta info
  const meta = document.createElement('div');
  meta.className = 'finding-meta';

  // Severity tag
  if (data.severity) {
    const severityTag = document.createElement('span');
    severityTag.className = `finding-tag ${data.severity}`;
    severityTag.textContent = data.severity.toUpperCase();
    meta.appendChild(severityTag);
  }

  // Additional info
  const info = document.createElement('span');
  info.className = 'finding-info';

  if (type === 'params' && data.param) {
    info.textContent = data.param;
  } else if (type === 'headers' && data.header) {
    info.textContent = data.header;
  } else if (type === 'paths' && data.contentLength) {
    info.textContent = `${data.contentLength} bytes`;
  }

  if (info.textContent) {
    meta.appendChild(info);
  }

  content.appendChild(meta);
  item.appendChild(content);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'finding-actions';

  // View button (diff for params/headers, content for paths)
  if (data.originalResponse || data.modifiedResponse) {
    const viewBtn = document.createElement('button');
    viewBtn.className = 'action-btn diff';
    viewBtn.title = type === 'paths' ? 'View Content' : 'View Diff';
    viewBtn.innerHTML = type === 'paths' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-columns"></i>';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      showDiffModal(data, type);
    };
    actions.appendChild(viewBtn);
  }

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'action-btn remove';
  removeBtn.title = 'Remove';
  removeBtn.innerHTML = '<i class="fas fa-times"></i>';
  removeBtn.onclick = async (e) => {
    e.stopPropagation();
    await removeFinding(type, identifier);
    updateUI();
  };
  actions.appendChild(removeBtn);

  item.appendChild(actions);

  return item;
}

function updateCount(type, count) {
  const countEl = document.getElementById(`${type}-count`);
  if (countEl) {
    countEl.textContent = count.toString();
    countEl.classList.toggle('has-items', count > 0);
  }
}

function renderList(type, items) {
  const list = document.getElementById(`${type}-list`);
  if (!list) return;

  list.innerHTML = '';

  if (!items || items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<i class="fas fa-check-circle"></i>No findings yet';
    list.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    let identifier;
    if (type === 'paths') {
      identifier = item.path;
    } else if (type === 'headers') {
      identifier = `${item.url}|${item.header}`;
    } else {
      identifier = item.url;
    }

    const itemEl = createFindingItem(item, type, identifier);
    list.appendChild(itemEl);
  });
}

async function updateUI() {
  const findings = await getFindings();

  renderList('paths', findings.paths || []);
  renderList('headers', findings.headers || []);
  renderList('params', findings.params || []);

  updateCount('paths', (findings.paths || []).length);
  updateCount('headers', (findings.headers || []).length);
  updateCount('params', (findings.params || []).length);

  updateSeverityStats(findings);

  // Update scan status
  const status = await getScanStatus();
  updateScanStatusUI(status);

  // Reapply search filter if active
  if (currentSearchTerm) {
    filterFindings(currentSearchTerm);
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  updateUI();

  // Initialize scan toggle state
  const scanToggle = document.getElementById('scan-toggle');
  const enabledState = await getEnabled();
  scanToggle.checked = enabledState.enabled;

  // Scan toggle handler
  scanToggle.addEventListener('change', async (e) => {
    await setEnabled(e.target.checked);
  });

  // Category collapse toggle
  document.querySelectorAll('.category-header').forEach((header) => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('collapsed');
    });
  });

  // Options link
  document.getElementById('options-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // GitHub info link
  document.getElementById('info-icon').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/devploit/debugHunter' });
  });

  // Clear all button
  document.getElementById('clear-all').addEventListener('click', async (e) => {
    e.preventDefault();
    await clearFindings();
    updateUI();
  });

  // Modal close button
  document.getElementById('modal-close').addEventListener('click', hideDiffModal);

  // Close modal on overlay click
  document.getElementById('diff-modal').addEventListener('click', (e) => {
    if (e.target.id === 'diff-modal') {
      hideDiffModal();
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDiffModal();
    }
  });

  // Search functionality
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', (e) => {
    filterFindings(e.target.value);
  });

  searchClear.addEventListener('click', () => {
    clearSearch();
  });

  // Clear search on Escape when focused
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSearch();
      searchInput.blur();
    }
  });
});

// Refresh UI periodically to catch new findings
setInterval(updateUI, 5000);
