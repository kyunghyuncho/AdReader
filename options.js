// Get references to UI elements in options.html
const apiKeyInput = document.getElementById('apiKey');
const saveButton = document.getElementById('saveButton');
const statusDiv = document.getElementById('status');

/**
 * Saves the API key to chrome.storage.
 */
function saveOptions() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        // Use chrome.storage.sync to save the key. It will sync across devices.
        chrome.storage.sync.set({ apiKey: apiKey }, () => {
            statusDiv.textContent = 'API Key saved successfully!';
            setTimeout(() => {
                statusDiv.textContent = '';
            }, 2000); // Clear the message after 2 seconds
        });
    } else {
        statusDiv.textContent = 'Please enter a valid API key.';
    }
}

/**
 * Restores the saved API key when the options page is opened.
 */
function restoreOptions() {
    chrome.storage.sync.get('apiKey', (data) => {
        if (data.apiKey) {
            apiKeyInput.value = data.apiKey;
        }
    });
}

// Add event listeners
document.addEventListener('DOMContentLoaded', restoreOptions);
saveButton.addEventListener('click', saveOptions);