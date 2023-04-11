// List of query parameters to append
const queryParams = [
  { key: "_debug", value: "1" },
  { key: "admin", value: "1" },
  { key: "analysis", value: "1" },
  { key: "beta", value: "1" },
  { key: "console", value: "1" },
  { key: "debug", value: "1" },
  { key: "debug_flag", value: "1" },
  { key: "debug_mode", value: "1" },
  { key: "debug_output", value: "1" },
  { key: "debug_status", value: "1" },
  { key: "debuginfo", value: "1" },
  { key: "debuglevel", value: "1" },
  { key: "dev", value: "1" },
  { key: "dev_mode", value: "1" },
  { key: "development", value: "1" },
  { key: "diagnostic", value: "1" },
  { key: "env", value: "pre" },
  { key: "error_reporting", value: "1" },
  { key: "experiment", value: "1" },
  { key: "internal", value: "1" },
  { key: "log", value: "1" },
  { key: "mode", value: "debug" },
  { key: "monitoring", value: "1" },
  { key: "performance", value: "1" },
  { key: "profiler", value: "1" },
  { key: "qa", value: "1" },
  { key: "sandbox", value: "1" },
  { key: "show_errors", value: "1" },
  { key: "staging", value: "1" },
  { key: "test", value: "1" },
  { key: "test_mode", value: "1" },
  { key: "testing", value: "1" },
  { key: "trace", value: "1" },
  { key: "validate", value: "1" },
  { key: "verbose", value: "1" },
];

// Counter for the number of modified URLs
let count = 0;

// Function to increment the counter and update the badge text
function incrementCount() {
  count += 1;
  chrome.browserAction.setBadgeText({ text: count.toString() });
  chrome.browserAction.setBadgeBackgroundColor({ color: 'red' });
}

// Function to append a specific query parameter to a URL
function appendQueryParam(url, param) {
  const urlObj = new URL(url);
  urlObj.searchParams.set(param.key, param.value);
  return urlObj.href;
}

// Store modified URLs
const modifiedUrls = new Set();

// Count how many queryParams are in the modifiedUrl
function countModifiedParams(modifiedUrl) {
  const urlObj = new URL(modifiedUrl);
  let count = 0;
  for (const param of queryParams) {
    if (urlObj.searchParams.has(param.key) && urlObj.searchParams.get(param.key) === param.value) {
      count++;
    }
  }
  return count;
}

// Function to add a modified URL
function addModifiedUrl(url) {
  if (!modifiedUrls.has(url) && countModifiedParams(url) == 1) {
    modifiedUrls.add(url);
    chrome.browserAction.setBadgeText({text: modifiedUrls.size.toString()});
  }
}

// Function to get modified URLs
function getModifiedUrls() {
  return Array.from(modifiedUrls);
}

// Function to clear modified URLs
function clearModifiedUrls() {
  modifiedUrls.clear();
  count = 0; // Reset the counter when the modified URLs are cleared
  chrome.browserAction.setBadgeText({ text: '' }); // Clear the badge text
}

// Expose getModifiedUrls and clearModifiedUrls functions to popup
window.getModifiedUrls = getModifiedUrls;
window.clearModifiedUrls = clearModifiedUrls;

// Preprocess Text from responses
function preprocessText(text) {
  return text.replace(/\s+/g, '');
}

// Function to check if two responses are meaningfully different
function isDifferentResponse(originalText, modifiedText, similarityThreshold) {
  // Preprocess the texts before comparison
  const preprocessedOriginalText = preprocessText(originalText);
  const preprocessedModifiedText = preprocessText(modifiedText);

  // Calculate the similarity between the two preprocessed responses
  const similarity = stringSimilarity.compareTwoStrings(
    preprocessedOriginalText,
    preprocessedModifiedText
  );

  // Return true if the similarity is below the threshold
  return similarity < similarityThreshold;
}

// Perform the binary search
async function binarySearch(url, includedParams, searchParams, originalText) {
  if (searchParams.length === 0) {
    return;
  }

  if (searchParams.length === 1) {
    const modifiedUrl = appendQueryParam(url, searchParams[0]);
    const modifiedResponse = await fetch(modifiedUrl);
    const modifiedText = await modifiedResponse.text();

    // Load similarityThreshold from storage
    const storedSettings = await new Promise(resolve => {
      chrome.storage.sync.get('similarityThreshold', resolve);
    });

    const similarityThreshold = storedSettings.similarityThreshold || 0.97;
    
    if (isDifferentResponse(originalText, modifiedText, similarityThreshold)) {
      addModifiedUrl(modifiedUrl);
    }
    return;
  }

  // Calculate the middle index
  const middleIndex = Math.floor(searchParams.length / 2);

  // Construct the modified URL using the includedParams and up to the middle index of searchParams
  const modifiedUrl = includedParams.concat(searchParams.slice(0, middleIndex)).reduce((currentUrl, param) => {
    return appendQueryParam(currentUrl, param);
  }, url);

  // Fetch the modified response and compare it to the original response
  const modifiedResponse = await fetch(modifiedUrl);
  const modifiedText = await modifiedResponse.text();

  // Load similarityThreshold from storage
  const storedSettings = await new Promise(resolve => {
    chrome.storage.sync.get('similarityThreshold', resolve);
  });

  const similarityThreshold = storedSettings.similarityThreshold || 0.97;

  if (isDifferentResponse(originalText, modifiedText, similarityThreshold)) {
    // If the response is different, add the modified URL and search for more modifications
    addModifiedUrl(modifiedUrl);
    await binarySearch(url, includedParams, searchParams.slice(0, middleIndex), originalText);
  } else {
    // If the response is the same, continue searching in the upper half of the list
    await binarySearch(url, includedParams.concat(searchParams.slice(0, middleIndex)), searchParams.slice(middleIndex), originalText);
  }
}

// Function to check URL with parameters
async function checkUrlWithParameters(url, parameters) {
  // Fetch the original response only once
  const originalResponse = await fetch(url);
  const originalText = await originalResponse.text();

  // Perform the binary search with the full list of parameters and the original response text
  await binarySearch(url, [], parameters, originalText);
}

// Listen for tab updates to perform background checks
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    checkUrlWithParameters(tab.url, queryParams);
  }
});

// Expose getModifiedUrls and clearModifiedUrls functions to popup
window.getModifiedUrls = getModifiedUrls;
window.clearModifiedUrls = clearModifiedUrls;