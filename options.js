document.addEventListener('DOMContentLoaded', () => {
    // Get the similarity threshold slider and display elements
    const similarityThresholdSlider = document.getElementById('similarityThreshold');
    const similarityThresholdValue = document.getElementById('similarityThresholdValue');
  
    // Function to update the display value
    function updateDisplayValue(value) {
      similarityThresholdValue.textContent = value;
    }
  
    // Load the saved similarity threshold value
    chrome.storage.sync.get('similarityThreshold', (data) => {
      const value = data.similarityThreshold || 0.92;
      similarityThresholdSlider.value = value;
      updateDisplayValue(value);
    });
  
    // Save the similarity threshold value when the slider changes
    similarityThresholdSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      updateDisplayValue(value);
      chrome.storage.sync.set({ similarityThreshold: value }, () => {
        console.log('Similarity threshold saved:', value);
      });
    });
  });
  