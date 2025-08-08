// This script is injected into the web page.

/**
 * Generates a unique CSS selector for a given element.
 */
function getUniqueSelector(el) {
    if (el.id) {
        return `#${el.id.replace(/:/g, '\\:')}`;
    }
    let path = '';
    let currentEl = el;
    while (currentEl.parentElement) {
        const parent = currentEl.parentElement;
        let index = 1;
        let sibling = currentEl.previousElementSibling;
        while(sibling) {
            if (sibling.tagName === currentEl.tagName) {
                index++;
            }
            sibling = sibling.previousElementSibling;
        }
        const tagName = currentEl.tagName.toLowerCase();
        path = `> ${tagName}:nth-of-type(${index}) ${path}`;
        if (parent.tagName.toLowerCase() === 'body') break;
        currentEl = parent;
    }
    return `body ${path.trim()}`;
}

/**
 * Creates a "skeleton" of the document's HTML by removing bulky content.
 * This preserves the structure for layout analysis by the AI.
 * @returns {string} The skeletonized HTML as a string.
 */
function createSkeletonHtml() {
    const clonedBody = document.body.cloneNode(true);

    // Remove scripts and styles as they are not needed for structural analysis
    clonedBody.querySelectorAll('script, style, link[rel="stylesheet"]').forEach(el => el.remove());

    // Remove bulky text content but keep the tags
    clonedBody.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, li, a, td, th').forEach(el => {
        if (el.children.length === 0) { // Only clear text from leaf nodes
            el.textContent = '';
        }
    });

    // Remove image data but keep the img tags and their alts
    clonedBody.querySelectorAll('img').forEach(img => {
        img.removeAttribute('src');
        img.removeAttribute('srcset');
    });
    
    // Remove video sources
    clonedBody.querySelectorAll('video').forEach(vid => {
        vid.removeAttribute('src');
        vid.querySelectorAll('source').forEach(s => s.remove());
    });

    return clonedBody.outerHTML;
}

/**
 * Listener for messages from the background script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getSkeletonHtml") {
        sendResponse(createSkeletonHtml());
    } 
    else if (request.action === "getAdSnippets") {
        const snippets = request.selectors.map(selector => {
            try {
                const el = document.querySelector(selector);
                return el ? { selector, html: el.outerHTML } : null;
            } catch (e) {
                console.warn(`Ad Reader: Invalid selector from AI - "${selector}". Skipping.`);
                return null;
            }
        }).filter(Boolean); // Filter out nulls if selector not found or invalid
        sendResponse(snippets);
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

    const mainContent = document.createElement('div');
    mainContent.style.cssText = `display: flex; align-items: center; gap: 15px; flex-grow: 1; overflow: hidden;`;

    const speakerIcon = document.createElement('div');
    speakerIcon.className = 'ad-reader-speaker-icon';
    speakerIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    speakerIcon.style.cssText = `cursor: pointer; flex-shrink: 0;`;

    const descriptionBox = document.createElement('div');
    descriptionBox.className = 'ad-reader-description-box';
    descriptionBox.textContent = description;
    descriptionBox.style.cssText = `color: #fff; background: none; text-align: left; font-size: 14px;`;

    mainContent.appendChild(speakerIcon);
    mainContent.appendChild(descriptionBox);

    const closeButton = document.createElement('div');
    closeButton.textContent = '×';
    closeButton.style.cssText = `font-size: 24px; color: white; cursor: pointer; font-weight: bold; line-height: 1; flex-shrink: 0; align-self: flex-start; padding-left: 10px;`;
    
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