function updateModifiedUrlsList() {
  const modifiedUrls = chrome.extension.getBackgroundPage().getModifiedUrls();
  const list = document.getElementById("modifiedUrls");

  list.innerHTML = "";

  for (const url of modifiedUrls) {
    const listItem = document.createElement("li");
    const link = document.createElement("a");

    link.href = url;
    link.target = "_blank";
    link.textContent = url;

    listItem.appendChild(link);
    list.appendChild(listItem);
  }
}
  
document.addEventListener("DOMContentLoaded", updateModifiedUrlsList);

document.getElementById("clearUrls").addEventListener("click", () => {
  chrome.extension.getBackgroundPage().clearModifiedUrls();
  updateModifiedUrlsList();
});

document.getElementById('info-icon').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://github.com/devploit/debugHunter' });
});