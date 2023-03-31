// List of query parameters to append
const queryParams = [
  { key: "_debug", value: "1" },
  { key: "test", value: "1" },
  { key: "admin", value: "1" },
  { key: "debug", value: "1" },
  { key: "env", value: "pre" },   
  { key: "dev", value: "1" },
  { key: "staging", value: "1" },
  { key: "console", value: "1" },
  { key: "trace", value: "1" },
  { key: "log", value: "1" },
  { key: "verbose", value: "1" },
  { key: "diagnostic", value: "1" },
  { key: "mode", value: "debug" },
  { key: "profiler", value: "1" },
  { key: "debug_mode", value: "1" },
  { key: "debuglevel", value: "1" },
  { key: "error_reporting", value: "1" },
  { key: "show_errors", value: "1" },
  { key: "performance", value: "1" },
  { key: "sandbox", value: "1" },
  { key: "beta", value: "1" },
  { key: "qa", value: "1" },
  { key: "dev_mode", value: "1" },
  { key: "validate", value: "1" },
  { key: "analysis", value: "1" },
  { key: "experiment", value: "1" },
  { key: "test_mode", value: "1" },
  { key: "debug_flag", value: "1" },
  { key: "development", value: "1" },
  { key: "debuginfo", value: "1" },
  { key: "monitoring", value: "1" },
  { key: "internal", value: "1" },
  { key: "debug_status", value: "1" },
  { key: "debug_output", value: "1" },
  { key: "testing", value: "1" },
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

// Function to check if two responses are meaningfully different
function isDifferentResponse(originalText, modifiedText) {
  // Calculate the similarity between the two responses
  const similarity = stringSimilarity.compareTwoStrings(originalText, modifiedText);

  // Set a threshold for similarity; responses with similarity below this threshold are considered different
  const similarityThreshold = 0.90;

  // Return true if the similarity is below the threshold
  return similarity < similarityThreshold;
}

// Function to fetch URL and compare responses with and without each parameter
async function checkUrlWithParameters(url, parameters) {
  const originalResponse = await fetch(url);
  const originalText = await originalResponse.text();

  // Check the response with all parameters combined
  const combinedUrl = parameters.reduce((currentUrl, param) => {
    return appendQueryParam(currentUrl, param);
  }, url);
  const combinedResponse = await fetch(combinedUrl);
  const combinedText = await combinedResponse.text();

  if (!isDifferentResponse(originalText, combinedText)) {
    // If the response is the same, there is no need to perform the binary search
    return;
  }

  // Define the start and end indices for the binary search
  let startIndex = 0;
  let endIndex = parameters.length - 1;

  // Perform the binary search
  while (startIndex <= endIndex) {
    // Calculate the middle index
    const middleIndex = Math.floor((startIndex + endIndex) / 2);

    // Construct the modified URL using the parameters up to the middle index
    const modifiedUrl = parameters.slice(0, middleIndex + 1).reduce((currentUrl, param) => {
      return appendQueryParam(currentUrl, param);
    }, url);

    // Fetch the modified response and compare it to the original response
    const modifiedResponse = await fetch(modifiedUrl);
    const modifiedText = await modifiedResponse.text();

    if (isDifferentResponse(originalText, modifiedText)) {
      // If the response is different, add the modified URL and search for more modifications
      addModifiedUrl(modifiedUrl);
      endIndex = middleIndex - 1;
    } else {
      // If the response is the same, continue searching in the upper half of the list
      startIndex = middleIndex + 1;
    }
  }

  // Check each parameter individually until the first parameter that modifies the response is found
  let found = false;
  for (const param of parameters) {
    const modifiedUrl = appendQueryParam(url, param);
    const modifiedResponse = await fetch(modifiedUrl);
    const modifiedText = await modifiedResponse.text();

    if (isDifferentResponse(originalText, modifiedText)) {
      // If the response is different, add the modified URL to the set
      addModifiedUrl(modifiedUrl);
      found = true;
      break;
    }
  }

  // If there are only two parameters left and we have a modified response when using only one of them,
  // try the other parameter
  if (!found && parameters.length === 2) {
    const modifiedUrl = appendQueryParam(url, parameters[0]);
    const modifiedResponse = await fetch(modifiedUrl);
    const modifiedText = await modifiedResponse.text();

    if (!isDifferentResponse(originalText, modifiedText)) {
      const otherModifiedUrl = appendQueryParam(url, parameters[1]);
      const otherModifiedResponse = await fetch(otherModifiedUrl);
      const otherModifiedText = await otherModifiedResponse.text();

      if (isDifferentResponse(originalText, otherModifiedText)) {
        addModifiedUrl(otherModifiedUrl);
      }
    } else {
      addModifiedUrl(modifiedUrl);
    }
  }
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
