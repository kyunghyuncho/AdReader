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
    // Updated styles for side-by-side layout
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
        flex-direction: row; /* Arrange items side-by-side */
        gap: 15px; /* Add space between icon and text */
        padding: 10px;
        box-sizing: border-box;
    `;

    // The speaker icon
    const speakerIcon = document.createElement('div');
    speakerIcon.className = 'ad-reader-speaker-icon';
    speakerIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
    `;
    speakerIcon.style.cursor = 'pointer';
    speakerIcon.style.flexShrink = '0'; // Prevent icon from shrinking

    // The description box, now always visible
    const descriptionBox = document.createElement('div');
    descriptionBox.className = 'ad-reader-description-box';
    descriptionBox.textContent = description;
    // Override positioning from the CSS file to work with flexbox
    descriptionBox.style.cssText = `
        position: static;
        transform: none;
        bottom: auto;
        left: auto;
        color: #fff; /* Ensure text is white against the dark overlay */
        background: none;
        box-shadow: none;
        border: none;
        text-align: left;
        font-size: 14px;
        flex-grow: 1; /* Allow text to take up available space */
    `;

    // The close button ('x')
    const closeButton = document.createElement('div');
    closeButton.textContent = '×'; // Using the multiplication sign for a clean 'x'
    closeButton.style.cssText = `
        position: absolute;
        top: 2px;
        right: 8px;
        font-size: 24px;
        color: white;
        cursor: pointer;
        font-weight: bold;
        line-height: 1;
    `;
    
    // Event listener for the close button
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent other clicks from firing
        overlay.remove(); // Remove the entire overlay
    });

    // Placeholder for future text-to-speech functionality
    speakerIcon.addEventListener('click', (e) => {
        e.stopPropagation(); 
        // TODO: Add text-to-speech logic here in the future.
        console.log("Speaking ad:", description); 
        // Add a visual cue that it was clicked
        speakerIcon.style.transform = 'scale(1.1)';
        setTimeout(() => {
            speakerIcon.style.transform = 'scale(1)';
        }, 150);
    });

    overlay.appendChild(speakerIcon);
    overlay.appendChild(descriptionBox);
    overlay.appendChild(closeButton); // Add the close button to the overlay
    document.body.appendChild(overlay);
}

/**
 * Removes all previously created ad overlays from the page.
 */
function clearExistingOverlays() {
    const existingOverlays = document.querySelectorAll('.ad-reader-overlay');
    existingOverlays.forEach(overlay => overlay.remove());
}
