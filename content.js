// This script is injected into the web page.

/**
 * Generates a unique and robust CSS selector for a given element.
 * @param {HTMLElement} el The element to generate a selector for.
 * @returns {string} A CSS selector.
 */
function getUniqueSelector(el) {
    if (el.id) {
        // If the element has an ID, that's the most reliable selector.
        return `#${el.id}`;
    }
    // Fallback to a path from the body
    let path = '';
    let currentEl = el;
    while (currentEl.parentElement) {
        const parent = currentEl.parentElement;
        const children = Array.from(parent.children);
        const index = children.indexOf(currentEl) + 1;
        const tagName = currentEl.tagName.toLowerCase();
        path = `> ${tagName}:nth-child(${index}) ${path}`;
        
        if (parent.tagName.toLowerCase() === 'body') {
            break;
        }
        currentEl = parent;
    }
    return `body ${path.trim()}`;
}


/**
 * Finds elements on the page that are likely to be ads based on heuristics.
 * @returns {Array<{selector: string, html: string}>} An array of candidate ad objects.
 */
function findPotentialAds() {
    const candidates = [];
    // A list of common keywords found in ad-related class names or IDs.
    const adKeywords = ['ad', 'advert', 'sponsor', 'promo', 'banner', 'google_ads', 'doubleclick'];
    
    // Query for elements containing ad-related keywords in their attributes.
    const query = adKeywords.map(kw => `[id*="${kw}"], [class*="${kw}"]`).join(', ');
    
    document.querySelectorAll(query).forEach(el => {
        // Basic filtering to avoid capturing the whole page or tiny elements.
        const rect = el.getBoundingClientRect();
        if (rect.height > 30 && rect.width > 30 && el.offsetParent !== null) {
             const selector = getUniqueSelector(el);
             candidates.push({ selector: selector, html: el.outerHTML });
        }
    });

    // Also look for iframes from common ad networks.
    document.querySelectorAll('iframe').forEach(iframe => {
        const src = iframe.src || '';
        if (src.includes('googlesyndication') || src.includes('doubleclick')) {
            const selector = getUniqueSelector(iframe);
            candidates.push({ selector: selector, html: iframe.outerHTML });
        }
    });
    
    // Remove duplicates based on the selector
    const uniqueCandidates = Array.from(new Map(candidates.map(item => [item.selector, item])).values());
    
    return uniqueCandidates;
}


/**
 * Listener for messages from the background script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findAdCandidates") {
        const candidates = findPotentialAds();
        sendResponse(candidates);
    }
    else if (request.action === "createOverlays") {
        clearExistingOverlays();
        const adData = request.data;
        let overlayCount = 0;
        if (adData && adData.ads && adData.ads.length > 0) {
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
        }
        sendResponse({ status: "success", count: overlayCount });
    } else if (request.action === "clearOverlays") {
        clearExistingOverlays();
    }
    return true; // Indicate async response.
});


/**
 * Creates a styled overlay for a given DOM element.
 * @param {HTMLElement} element - The ad element to overlay.
 * @param {string} description - The description of the ad.
 */
function createOverlayForElement(element, description) {
    const rect = element.getBoundingClientRect();

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
        flex-direction: row;
        gap: 15px;
        padding: 10px;
        box-sizing: border-box;
    `;

    const speakerIcon = document.createElement('div');
    speakerIcon.className = 'ad-reader-speaker-icon';
    speakerIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    speakerIcon.style.cursor = 'pointer';
    speakerIcon.style.flexShrink = '0';

    const descriptionBox = document.createElement('div');
    descriptionBox.className = 'ad-reader-description-box';
    descriptionBox.textContent = description;
    descriptionBox.style.cssText = `
        position: static;
        transform: none;
        color: #fff;
        background: none;
        box-shadow: none;
        border: none;
        text-align: left;
        font-size: 14px;
        flex-grow: 1;
    `;

    const closeButton = document.createElement('div');
    closeButton.textContent = '×';
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
    
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.remove();
    });

    speakerIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log("Speaking ad:", description);
        speakerIcon.style.transform = 'scale(1.1)';
        setTimeout(() => { speakerIcon.style.transform = 'scale(1)'; }, 150);
    });

    overlay.appendChild(speakerIcon);
    overlay.appendChild(descriptionBox);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);
}

/**
 * Removes all previously created ad overlays from the page.
 */
function clearExistingOverlays() {
    document.querySelectorAll('.ad-reader-overlay').forEach(overlay => overlay.remove());
}