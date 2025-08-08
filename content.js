// This script is injected into the web page.

/**
 * Generates a unique and robust CSS selector for a given element.
 * @param {HTMLElement} el The element to generate a selector for.
 * @returns {string} A CSS selector.
 */
function getUniqueSelector(el) {
    if (el.id) {
        // If the element has an ID, that's the most reliable selector.
        return `#${el.id.replace(/:/g, '\\:')}`; // Escape colons for CSS
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
    const candidates = new Map(); // Use a Map to automatically handle duplicates by selector.
    const addCandidate = (el) => {
        // Basic filtering to avoid capturing tiny or invisible elements.
        const rect = el.getBoundingClientRect();
        if (rect.height > 30 && rect.width > 30 && el.offsetParent !== null) {
            const selector = getUniqueSelector(el);
            if (!candidates.has(selector)) {
                candidates.set(selector, { selector, html: el.outerHTML });
            }
        }
    };

    // An expanded list of common keywords in multiple languages.
    const adKeywords = [
        // English
        'ad', 'advert', 'sponsor', 'promo', 'banner', 'google_ads', 'doubleclick', 
        'ad-slot', 'ad-container', 'advertisement', 'sponsored', 'promotion', 'affiliate',
        // Spanish
        'anuncio', 'publicidad', 'patrocinado',
        // French
        'publicité', 'annonce', 'sponsorisé', 'pub',
        // German
        'werbung', 'anzeige', 'gesponsert',
        // Portuguese
        'anúncio', 'publicidade', 'patrocinado',
        // Italian
        'pubblicità', 'annuncio', 'sponsorizzato',
        // Dutch
        'advertentie', 'gesponsord',
        // Japanese
        '広告', // kōkoku
        'スポンサー', // suponsā
        // Chinese
        '广告', // guǎnggào
        '赞助', // zànzhù
        // Korean
        '광고', // gwanggo
        // Russian
        'реклама', // reklama
        'спонсор', // sponsor
        // Hindi
        'विज्ञापन', // vigyapan
        // Arabic
        'إعلان' // iʻlān
    ];
    
    // --- Detection Strategies ---

    // 1. Keyword-based search in IDs and classes
    const keywordQuery = adKeywords.map(kw => `[id*="${kw}"], [class*="${kw}"]`).join(', ');
    document.querySelectorAll(keywordQuery).forEach(addCandidate);

    // 2. Common data-ad attributes (strong signal)
    document.querySelectorAll('[data-ad-client], [data-ad-slot], [data-ad-format], [data-ad-manager-id]').forEach(addCandidate);

    // 3. Common iframe sources for ad networks
    document.querySelectorAll('iframe').forEach(iframe => {
        const src = iframe.src || '';
        if (src.includes('googlesyndication') || src.includes('doubleclick') || src.includes('amazon-adsystem') || src.includes('adservice')) {
            addCandidate(iframe);
        }
    });

    // 4. Structural analysis: Look for images inside links that open in a new tab.
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
        if (link.querySelector('img')) {
            addCandidate(link);
        }
    });

    // 5. ARIA roles commonly used for ad sidebars and regions.
    document.querySelectorAll('[role="complementary"], [role="region"][aria-label*="advert"], [role="banner"]').forEach(addCandidate);

    // 6. Positional analysis: Look for sticky/fixed elements at the top or bottom.
    document.querySelectorAll('div, section').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
            if (parseInt(style.bottom, 10) < 10 || parseInt(style.top, 10) < 10) {
                addCandidate(el);
            }
        }
    });
    
    return Array.from(candidates.values());
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
        flex-direction: row;
        padding: 10px;
        box-sizing: border-box;
    `;

    // Create a container for the main content (speaker + description)
    const mainContent = document.createElement('div');
    mainContent.style.cssText = `
        display: flex;
        align-items: center;
        gap: 15px;
        flex-grow: 1; /* This will take up most of the space */
        overflow: hidden; /* Prevent text from pushing the layout */
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
        color: #fff;
        background: none;
        text-align: left;
        font-size: 14px;
    `;

    mainContent.appendChild(speakerIcon);
    mainContent.appendChild(descriptionBox);

    // Create the close button as a flex item
    const closeButton = document.createElement('div');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
        font-size: 24px;
        color: white;
        cursor: pointer;
        font-weight: bold;
        line-height: 1;
        flex-shrink: 0; /* Prevent the button from being squished */
        align-self: flex-start; /* Align to the top of the flex container */
        padding-left: 10px; /* Add some space */
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

    overlay.appendChild(mainContent);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);
}

/**
 * Removes all previously created ad overlays from the page.
 */
function clearExistingOverlays() {
    document.querySelectorAll('.ad-reader-overlay').forEach(overlay => overlay.remove());
}