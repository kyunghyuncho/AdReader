// This script is injected into the web page.

/**
 * Listener for messages from the background script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "createOverlays") {
        // Clear any existing overlays before creating new ones
        clearExistingOverlays();
        
        const adData = request.data;
        if (adData && adData.ads && adData.ads.length > 0) {
            let overlayCount = 0;
            adData.ads.forEach(ad => {
                try {
                    const adElement = document.querySelector(ad.selector);
                    if (adElement) {
                        createOverlayForElement(adElement, ad.description);
                        overlayCount++;
                    }
                } catch (e) {
                    console.warn(`Ad Reader: Invalid selector "${ad.selector}". Skipping.`);
                }
            });
            // Send the number of overlays created back to the background script
            sendResponse({ status: "success", count: overlayCount });
        } else {
            // Handle case where no ads were found
            sendResponse({ status: "success", count: 0 });
        }
    } else if (request.action === "clearOverlays") {
        // This new action handles clearing overlays on page navigation
        clearExistingOverlays();
    }
    // Return true to indicate async response, if needed.
    return true; 
});

/**
 * Creates a styled overlay for a given DOM element.
 * @param {HTMLElement} element - The ad element to overlay.
 * @param {string} description - The description of the ad.
 */
function createOverlayForElement(element, description) {
    const rect = element.getBoundingClientRect();

    // The main overlay container
    const overlay = document.createElement('div');
    overlay.className = 'ad-reader-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: ${window.scrollY + rect.top}px;
        left: ${window.scrollX + rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background-color: rgba(0, 0, 0, 0.7);
        border: 2px dashed #ff5722;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
    `;

    // The speaker icon
    const speakerIcon = document.createElement('div');
    speakerIcon.className = 'ad-reader-speaker-icon';
    speakerIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
    `;
    speakerIcon.style.cursor = 'pointer';

    // The description box (initially hidden)
    const descriptionBox = document.createElement('div');
    descriptionBox.className = 'ad-reader-description-box';
    descriptionBox.textContent = description;
    descriptionBox.style.display = 'none'; // Hidden by default

    // Event listener for the speaker icon
    speakerIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from bubbling up
        const isVisible = descriptionBox.style.display === 'block';
        descriptionBox.style.display = isVisible ? 'none' : 'block';
    });

    overlay.appendChild(speakerIcon);
    overlay.appendChild(descriptionBox);
    document.body.appendChild(overlay);
}

/**
 * Removes all previously created ad overlays from the page.
 */
function clearExistingOverlays() {
    const existingOverlays = document.querySelectorAll('.ad-reader-overlay');
    existingOverlays.forEach(overlay => overlay.remove());
}