document.addEventListener('DOMContentLoaded', () => {
    // Get the similarity threshold slider and display elements
    const similarityThresholdSlider = document.getElementById('similarityThreshold');
    const similarityThresholdValue = document.getElementById('similarityThresholdValue');

    // Function to update the display value
    function updateDisplayValue(value, displayElement) {
        displayElement.textContent = value;
    }

    // Load the saved similarity threshold value
    chrome.storage.sync.get('similarityThreshold', (data) => {
        const value = data.similarityThreshold || 0.95;
        similarityThresholdSlider.value = value;
        updateDisplayValue(value, similarityThresholdValue);
    });

    // Save the similarity threshold value when the slider changes
    similarityThresholdSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        updateDisplayValue(value, similarityThresholdValue);
        chrome.storage.sync.set({ similarityThreshold: value }, () => {
            console.log('Similarity threshold saved:', value);
        });
    });

    // Get the check interval slider and display elements
    const checkIntervalRange = document.getElementById('checkInterval');
    const checkIntervalValue = document.getElementById('checkIntervalValue');

    // Load the saved check interval value
    chrome.storage.sync.get('checkInterval', (data) => {
        const value = data.checkInterval || 480;
        checkIntervalRange.value = value;
        updateDisplayValue(value, checkIntervalValue);
    });

    // Save the check interval value when the slider changes
    checkIntervalRange.addEventListener('input', (e) => {
        const value = e.target.value;
        updateDisplayValue(value, checkIntervalValue);
        chrome.storage.sync.set({ checkInterval: value }, () => {
            console.log('Check interval saved:', value);
        });
    });

    // Get the whitelist display, form, and input elements
    const whitelistDisplay = document.getElementById('whitelistDisplay');
    const addWhitelistForm = document.getElementById('addWhitelistForm');
    const newWhitelistDomain = document.getElementById('newWhitelistDomain');

    // Load the saved whitelist
    chrome.storage.sync.get('whitelist', (data) => {
        const whitelist = data.whitelist || [];
        displayWhitelist(whitelist);
    });

    // Display the whitelist
    function displayWhitelist(whitelist) {
        // Clear the current display
        whitelistDisplay.innerHTML = '';

        // Add each domain to the display
        whitelist.forEach(domain => {
            const listItem = document.createElement('li');
            listItem.textContent = domain;
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.className = 'remove';
            removeButton.addEventListener('click', () => {
                removeDomainFromWhitelist(domain);
            });
            listItem.appendChild(removeButton);
            whitelistDisplay.appendChild(listItem);
        });
    }

    // Remove a domain from the whitelist
    function removeDomainFromWhitelist(domain) {
        chrome.storage.sync.get('whitelist', (data) => {
            let whitelist = data.whitelist || [];
            whitelist = whitelist.filter(d => d !== domain);
            chrome.storage.sync.set({ whitelist: whitelist }, () => {
                console.log('Domain removed from whitelist:', domain);
                displayWhitelist(whitelist);
            });
        });
    }

    // Add a new domain to the whitelist when the form is submitted
    addWhitelistForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const domain = newWhitelistDomain.value.trim();
        if (domain) {
            chrome.storage.sync.get('whitelist', (data) => {
                let whitelist = data.whitelist || [];
                if (!whitelist.includes(domain)) {
                    whitelist.push(domain);
                    chrome.storage.sync.set({ whitelist: whitelist }, () => {
                        console.log('Domain added to whitelist:', domain);
                        displayWhitelist(whitelist);
                    });
                }
            });
            newWhitelistDomain.value = '';
        }
    });
});
