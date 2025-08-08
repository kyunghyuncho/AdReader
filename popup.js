// Get references to the UI elements in popup.html
const scanButton = document.getElementById('scanButton');
const statusDiv = document.getElementById('status');
const optionsLink = document.getElementById('optionsLink');

/**
 * Handles the click event for the "Scan for Ads" button.
 */
scanButton.addEventListener('click', async () => {
    // Disable the button and show a loading message to prevent multiple clicks
    scanButton.disabled = true;
    statusDiv.textContent = 'Scanning...';

    try {
        // Get the current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Send a message to the background script to start the ad detection process
        const response = await chrome.runtime.sendMessage({
            action: "scanForAds",
            tabId: tab.id
        });

        // Handle the response from the background script
        if (response.status === "success") {
            statusDiv.textContent = `Found and overlaid ${response.count} ads.`;
        } else {
            statusDiv.textContent = `Error: ${response.message}`;
        }

    } catch (error) {
        console.error("Ad Reader Error:", error);
        statusDiv.textContent = 'An unexpected error occurred.';
    } finally {
        // Re-enable the button after the process is complete
        scanButton.disabled = false;
    }
});

/**
 * Opens the options page when the "Settings" link is clicked.
 */
optionsLink.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});