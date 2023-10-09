/*
QUERY PARAMS
*/

// List of query params to be tested
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

// Store modified URLs
const modifiedUrls = new Set();

// Function to append a specific query parameter to a URL
function appendQueryParam(url, param) {
  const urlObj = new URL(url);
  urlObj.searchParams.set(param.key, param.value);
  return urlObj.href;
}


// Function to add a Query Params URL
function addModifiedUrl(url) {
  if (!modifiedUrls.add(url)) {
    modifiedUrls.add(url);
    incrementCount();

    // Log for debugging
    console.log("addModifiedUrl: added url " + url + " to modified URLs");
  }
}

// Function to get Query Params URLs
function getModifiedUrls() {
  return Array.from(modifiedUrls);
}

// Function to remove a specific found sensitive path
function removeModifiedUrl(url) {
  modifiedUrls.delete(url);
  incrementCount();

  // Log for debugging
  console.log("removeModifiedUrl: removed url " + path + " from modified URLs");
}

// Function to clear Query Params URLs
function clearModifiedUrls() {
  modifiedUrls.clear();
  chrome.browserAction.setBadgeText({ text: '' }); // Clear the badge text

  // Log for debugging
  console.log("clearModifiedUrls: cleared list of modified URLs");
}

// Function to fetch URL and compare responses with and without each parameter
async function checkUrlWithParameters(url) {
  try {
    const originalResponse = await fetch(url);
    const originalText = await originalResponse.text();

    // Check all parameters combined
    const combinedUrl = queryParams.reduce((currentUrl, param) => {
      return appendQueryParam(currentUrl, param);
    }, url);

    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));

    const combinedResponse = await fetch(combinedUrl);
    const combinedText = await combinedResponse.text();

    if (await isDifferentResponse(originalText, combinedText)) {
      // Check each parameter individually
      for (const param of queryParams) {
        const modifiedUrl = appendQueryParam(url, param);

        const modifiedResponse = await fetch(modifiedUrl);
        const modifiedText = await modifiedResponse.text();

        if (await isDifferentResponse(originalText, modifiedText)) {
          console.log('%cParam query found: ' + modifiedUrl, 'background-color: green; color: white');
          addModifiedUrl(modifiedUrl);
          break;
        }
      }
    }
  } catch (error) {
    console.error(`Failed to fetch ${url}: ${error}`);
  }
}
 
// Expose functions to popup
window.getModifiedUrls = getModifiedUrls;
window.clearModifiedUrls = clearModifiedUrls;

/*
CUSTOM HEADERS
*/

// List of custom headers to be tested
const customHeaders = [
  { key: "Env", value: "pre" },
  { key: "X-Forwarded-For", value: "127.0.0.1" }
];

const foundCustomHeaders = new Set();

// Function add custom header
function addCustomHeader(url, headerToAdd) {
  if (!headerToAdd || !headerToAdd.key || !headerToAdd.value) {
    console.error("Invalid header:", headerToAdd);
    return;
  }
  let headerString = url + " - " + headerToAdd.key + ": " + headerToAdd.value;
  foundCustomHeaders.add(headerString);
  incrementCount();

  console.log("addCustomHeader: added header " + headerToAdd.key + ": " + headerToAdd.value + " to found custom headers");
}

// Function to get the list of found custom headers
function getCustomHeaders() {
  return foundCustomHeaders;
}

// Function to remove a custom header from the set of found headers
function removeCustomHeader(headerToRemove) {
  // Remove the header directly, no need to loop through all headers
  if(foundCustomHeaders.has(headerToRemove)) {
    foundCustomHeaders.delete(headerToRemove);
    incrementCount();

    // Log for debugging
    console.log("removeCustomHeader: removed header " + headerToRemove + " from found custom headers");
  }
}

// Function to clear the list of found custom headers
function clearCustomHeaders() {
  foundCustomHeaders.clear();
  chrome.browserAction.setBadgeText({ text: '' });

  // Log for debugging
  console.log("clearCustomHeaders: cleared list of found custom headers");
}

// Function to probe URL with custom headers
async function probeUrlWithHeaders(url, headers) {
  let fetchHeaders = new Headers();
  for(let key in headers) {
    fetchHeaders.append(key, headers[key]);
  }

  let response;
  try {
    response = await fetch(url, { headers: fetchHeaders });
  } catch (err) {
    console.error(`Error fetching ${url}: ${err.message}`);
    return null;
  }
  return response.text();
}

// Function to test URL with each custom header
async function probeHeaders(url) {
  const initialContent = await probeUrlWithHeaders(url, {});

  if (initialContent === null) return;

  let headers = {};
  customHeaders.forEach(header => {
    headers[header.key] = header.value;
  });

  const allHeadersContent = await probeUrlWithHeaders(url, headers);

  if (allHeadersContent === null) return;

  if (await isDifferentResponse(initialContent, allHeadersContent)) {
    for (let i = 0; i < customHeaders.length; i++) {
      let singleHeader = {};
      singleHeader[customHeaders[i].key] = customHeaders[i].value;
      
      const singleHeaderContent = await probeUrlWithHeaders(url, singleHeader);

      if (singleHeaderContent === null) continue;

      if (await isDifferentResponse(initialContent, singleHeaderContent)) {
        console.log('%cCustom header found in ' + url + ': ' + customHeaders[i].key + ": " + customHeaders[i].value, 'background-color: green; color: white');
        addCustomHeader(url, customHeaders[i]);
        break;
      }
    }
  }
}

// Expose function to popup
window.getCustomHeaders = getCustomHeaders;
window.removeCustomHeader = removeCustomHeader;
window.clearCustomHeaders = clearCustomHeaders;

/*
SENSITIVE PATHS
*/

// List of sensitive paths to be tested
const sensitivePaths = [
  "/.git/config",
  "/.env", "/auth.json",
  "/config.json",
  "/bitbucket-pipelines.yml"
];

// Store found sensitive paths
const foundSensitivePaths = new Set();

// Function to add a found sensitive path
function addFoundSensitivePath(url) {
  if (!foundSensitivePaths.has(url)) {
    foundSensitivePaths.add(url);
    incrementCount();

    // Log for debugging
    console.log("addFoundSensitivePath: added path " + url + " to found sensitive paths");
  }
}

// Function to get found sensitive paths
function getFoundSensitivePaths() {
  return Array.from(foundSensitivePaths);
}

// Function to remove a specific found sensitive path
function removeSensitivePath(path) {
  foundSensitivePaths.delete(path);
  incrementCount();

  // Log for debugging
  console.log("getFoundSensitivePaths: returning list of found sensitive paths");
}

// Function to clear found sensitive paths
function clearFoundSensitivePaths() {
  foundSensitivePaths.clear();
  chrome.browserAction.setBadgeText({ text: '' }); // Clear the badge text

  // Log for debugging
  console.log("clearFoundSensitivePaths: cleared list of found sensitive paths");
}

// Function to check sensitive paths for a domain
async function checkSensitivePaths(url) {
  const urlObj = new URL(url);
  const domain = urlObj.protocol + '//' + urlObj.hostname;

  let originalResponse = await fetch(domain);
  let originalText = await originalResponse.text();

  for (let path of sensitivePaths) {
    let urlToCheck = domain + path;

    let response = await fetch(urlToCheck);

    if (response.status === 200) {
      let pathText = await response.text();

      // Check if the original response contains "soft 404" keywords
      let isSoft404 = [
        "no encontrado",
        "error 404",
        "página no existe",
        "no se pudo encontrar",
        "not found",
        "failed to connect to",
      ].some(keyword => pathText.toLowerCase().includes(keyword.toLowerCase()));

      if(await isDifferentResponse(originalText, pathText)) {
        if (isSoft404) {
          console.log('%cThe server responded with a status of 200, but it might be a "soft 404": ' + domain, 'background-color: yellow; color: black');
        } else {
          console.log('%cThe server responded with a status of 200: ' + response.url, 'background-color: green; color: white');
          addFoundSensitivePath(urlToCheck);
        }
      }
    }
  }
}

// Expose functions to popup
window.getFoundSensitivePaths = getFoundSensitivePaths;
window.removeSensitivePath = removeSensitivePath;
window.clearFoundSensitivePaths = clearFoundSensitivePaths;

/*
GLOBAL FUNCTIONS
*/

// Counter for the number of modified URLs and sensitive paths
let countModifiedUrls = 0;
let countSensitivePaths = 0;

// Function to increment the counter and update the badge text
function incrementCount() {
  countModifiedUrls = modifiedUrls.size;
  countCustomHeaders = foundCustomHeaders.size;
  countSensitivePaths = foundSensitivePaths.size;

  const totalCount = countModifiedUrls + countCustomHeaders + countSensitivePaths;
  chrome.browserAction.setBadgeText({ text: totalCount.toString() });
  chrome.browserAction.setBadgeBackgroundColor({ color: 'red' });

  // Log for debugging
  console.log("incrementCount: total count is now " + totalCount);
}

// Check if a hostname matches a pattern
function matchesPattern(pattern, hostname) {
  const patternParts = pattern.split('.').reverse();
  const hostnameParts = hostname.split('.').reverse();

  // Check if the pattern is longer than the hostname. If so, it's not a match.
  if (patternParts.length > hostnameParts.length) {
      return false;
  }

  // Check each part of the pattern against the hostname.
  for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '*') {
          return true; // Wildcard matches all remaining hostname parts.
      }
      if (patternParts[i] !== hostnameParts[i]) {
          return false; // Mismatch.
      }
  }

  return true;
}

// Check if a URL is in the whitelist
async function isInWhitelist(url) {
  const urlObj = new URL(url);
  const { hostname } = urlObj;

  let storedSettings;
  try {
    storedSettings = await new Promise((resolve, reject) => {
      chrome.storage.sync.get('whitelist', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  } catch (err) {
    console.error(err);
  }

  const whitelist = storedSettings.whitelist || [];

  for (let i = 0; i < whitelist.length; i++) {
      const pattern = whitelist[i];
      if (matchesPattern(pattern, hostname)) {
          return true;
      }
  }

  return false;
}

// Check if URL is valid
async function isValidURL(url) {
  if (url.startsWith('chrome://')) {
    console.log("%cisValidUrl: skipping unsupported URL: " + url, 'background-color: yellow; color: black');
    return false;
  }

  let storedSettings;
  try {
    storedSettings = await new Promise((resolve, reject) => {
      chrome.storage.sync.get('checkInterval', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  } catch (err) {
    console.error(err);
  }
  const check_interval = storedSettings.checkInterval * 60 * 1000 || 300 * 60 * 1000; 
  console.log("isValidUrl: checking interval of " + storedSettings.checkInterval + " minutes");

  // Check when was the last time this URL was checked
  const lastChecked = localStorage.getItem(url);
  const now = Date.now();

  if (lastChecked !== null && (now - lastChecked < check_interval)) {
    console.log("%cisValidUrl: skipping recently checked URL: " + url, 'background-color: yellow; color: black');
    return true;
  }

  console.log("isValidUrl: url not analyzed in the lasts " + storedSettings.checkInterval + " minutes");
  localStorage.setItem(url, now.toString());

  return false;
}

// Check if URL is dynamic
async function isDynamicContent(url) {
  console.log("isDynamicContent: checking if " + url + " is dynamic...");
  const checks = 4;
  let lastLength = null;
  let lastText = null;
  let totalDifference = 0;

  for (let i = 0; i < checks; i++) {
    let response = await fetch(url);
    let text = await response.text();

    let currentLength = text.length;

    if (lastLength !== null) {
      totalDifference += Math.abs(currentLength - lastLength);
    }

    if (lastLength && totalDifference > 150) {
      console.log("%cisDynamicContent: skipping dynamic url: " + url + ". Total difference is " + totalDifference, 'background-color: yellow; color: black');

      return true;
    } else if (lastText && await isDifferentResponseDynamic(lastText, text)) {
      console.log("%cisDynamicContent: skipping dynamic url: " + url + ". The similarity is under the threshold", 'background-color: yellow; color: black');

      return true;
    } else {
      console.log("isDynamicContent: not dynamic url: " + url + ". Total difference is " + totalDifference);
    }

    lastLength = currentLength;
    lastText = text;

    // Add delay between checks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false;
}

// Function to check if two responses are meaningfully different
async function isDifferentResponseDynamic(originalText, modifiedText) {
  // Calculate the similarity between the two responses
  const similarity = stringSimilarity.compareTwoStrings(originalText, modifiedText);

  const similarityThreshold = 0.97;
  console.log("isDifferentResponseDynamic: similarityThreshold is " + similarityThreshold + " and similarity is " + similarity);

  // Return true if the similarity is below the threshold
  return similarity < similarityThreshold;
}

// Function to check if two responses are meaningfully different
async function isDifferentResponse(originalText, modifiedText) {
  // Calculate the similarity between the two responses
  const similarity = stringSimilarity.compareTwoStrings(originalText, modifiedText);

  let storedSettings;
  try {
    storedSettings = await new Promise((resolve, reject) => {
      chrome.storage.sync.get('similarityThreshold', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  } catch (err) {
    console.error(err);
  }
  const similarityThreshold = storedSettings.similarityThreshold || 0.95;
  console.log("isDifferentResponse: similarityThreshold is " + similarityThreshold + " and similarity is " + similarity);

  // Return true if the similarity is below the threshold
  return similarity < similarityThreshold;
}

// Update the tabs onUpdated listener to also call checkSensitivePaths
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    const url = new URL(tab.url);
    url.hash = '';
    const sanitizedUrl = url.toString();
    const isInWhitelistResult = await isInWhitelist(sanitizedUrl);
    if (!isInWhitelistResult) {
      console.log("%c[+] LAUNCHING DEBUGHUNTERPRO ON " + sanitizedUrl, 'background-color: purple; color: white');
      try {
        // Check if valid URL
        if (await isValidURL(sanitizedUrl)) {
          return;
        } else {
        // Skip dynamic content
          if (await isDynamicContent(sanitizedUrl)) {
            return;
          } else {
            await checkUrlWithParameters(sanitizedUrl, queryParams);
            await probeHeaders(sanitizedUrl);
          }
          await checkSensitivePaths(sanitizedUrl);
          }
      } catch (error) {
        console.error("Error processing URL " + tab.url + ": " + error, "background-color: red; color: white");
      }
    } else {
      console.log("%cURL whitelisted, not making requests: " + sanitizedUrl, "background-color: yellow; color: black");
    }
  }
});

