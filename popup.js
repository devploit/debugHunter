// QUERY PARAMS

// This function populates the modified URLs list in the popup
function updateModifiedUrlsList() {
  const modifiedUrls = chrome.extension.getBackgroundPage().getModifiedUrls();
  const list = document.getElementById("queryParams");

  list.innerHTML = "";

  // Iterate over each modified URL
  for (const url of modifiedUrls) {
    // Create a new list item
    const listItem = document.createElement("li");
    listItem.style.position = "relative";

    // Create a new anchor tag
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";

    // Trim the displayed URL if it is too long
    if (url.length > 60) {
      link.textContent = url.substring(0, 57) + "...";
    } else {
      link.textContent = url;
    }

    listItem.appendChild(link);

    // Create the remove icon
    const removeIcon = document.createElement('i');
    removeIcon.className = "fa fa-times";
    removeIcon.style.position = "absolute";
    removeIcon.style.right = "10px";
    removeIcon.style.top = "50%";
    removeIcon.style.transform = "translateY(-50%)";
    removeIcon.style.cursor = "pointer";
    removeIcon.onclick = function() {
      // Remove the URL from the modified URLs list in the background page
      chrome.extension.getBackgroundPage().removeModifiedUrl(url);
      updateModifiedUrlsList();
    }
    // Add the remove icon to the list item
    listItem.appendChild(removeIcon);

    // Add the list item to the list
    list.appendChild(listItem);
  }
}

// Call updateModifiedUrlsList when the popup is loaded
document.addEventListener("DOMContentLoaded", updateModifiedUrlsList);

// CUSTOM HEADERS
function updateCustomHeadersList() {
  const foundCustomHeaders = chrome.extension.getBackgroundPage().getCustomHeaders();
  const list = document.getElementById("customHeaders");

  list.innerHTML = "";

  for (const header of foundCustomHeaders) {
    const listItem = document.createElement("li");
    listItem.style.position = "relative";

    const textNode = document.createTextNode(header);
    listItem.appendChild(textNode);

    const removeIcon = document.createElement('i');
    removeIcon.className = "fa fa-times";
    removeIcon.style.position = "absolute";
    removeIcon.style.right = "10px";
    removeIcon.style.top = "50%";
    removeIcon.style.transform = "translateY(-50%)";
    removeIcon.style.cursor = "pointer";
    removeIcon.onclick = function() {
      // Remove the URL from the modified URLs list in the background page
      chrome.extension.getBackgroundPage().removeCustomHeader(header);
      updateCustomHeadersList();
    }
    // Add the remove icon to the list item
    listItem.appendChild(removeIcon);

    // Add the list item to the list
    list.appendChild(listItem);
  }
}

// Call updateCustomHeadersList when the popup is loaded
document.addEventListener("DOMContentLoaded", updateCustomHeadersList);

// SENSITIVE PATHS
function updateSensitivePaths() {
  const urlList = document.getElementById('sensitivePaths');
  while (urlList.firstChild) {
    urlList.firstChild.remove();
  }

  // Get updated found sensitive paths
  const paths = chrome.extension.getBackgroundPage().getFoundSensitivePaths();

  // Iterate over each found sensitive path
  for (let path of paths) {
    // Create a new list item
    const listItem = document.createElement('li');
    listItem.style.position = "relative";

    // Create a new anchor tag
    const anchor = document.createElement('a');
    anchor.href = path;
    anchor.target = '_blank';
    anchor.textContent = path;
    listItem.appendChild(anchor);

    // Create the remove icon
    const removeIcon = document.createElement('i');
    removeIcon.className = "fa fa-times";
    removeIcon.style.position = "absolute";
    removeIcon.style.right = "10px";
    removeIcon.style.top = "50%";
    removeIcon.style.transform = "translateY(-50%)";
    removeIcon.style.cursor = "pointer";
    removeIcon.onclick = function() {
      // Remove the path from the found sensitive paths list in the background page
      chrome.extension.getBackgroundPage().removeSensitivePath(path);
      updateSensitivePaths();
    }
    // Add the remove icon to the list item
    listItem.appendChild(removeIcon);

    // Add the list item to the list
    urlList.appendChild(listItem);
  }
}

// Call updateSensitivePaths when the popup is loaded
document.addEventListener("DOMContentLoaded", updateSensitivePaths);

// Get the current options from storage
document.getElementById('info-icon').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://github.com/devploit/debugHunterPro' });
});

// Open the options page when the options link is clicked
document.getElementById('options-link').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Clear all found sensitive paths, custom headers, and modified URLs
document.getElementById('clear-all').addEventListener('click', () => {
  chrome.extension.getBackgroundPage().clearFoundSensitivePaths();
  updateSensitivePaths();
  chrome.extension.getBackgroundPage().clearCustomHeaders();
  updateCustomHeadersList();
  chrome.extension.getBackgroundPage().clearModifiedUrls();
  updateModifiedUrlsList();
});
