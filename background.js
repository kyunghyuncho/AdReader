/**
 * Listener to automatically clear overlays when the user navigates to a new page.
 */
chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) {
        chrome.tabs.sendMessage(details.tabId, { action: "clearOverlays" })
            .catch(error => {
                if (!error.message.includes("Could not establish connection. Receiving end does not exist.")) {
                    console.warn("Ad Reader: Could not send clearOverlays message.", error);
                }
            });
    }
});

/**
 * Main listener for messages from other parts of the extension.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanForAds") {
        (async () => {
            try {
                // FIX: Use request.tabId, as sender.tab is not available for messages from the popup.
                const tabId = request.tabId; 
                if (!tabId) {
                    throw new Error("Could not get tab ID.");
                }

                // 1. Inject the content script.
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });

                // 2. Get the API key from storage.
                const { apiKey } = await chrome.storage.sync.get('apiKey');
                if (!apiKey) {
                    sendResponse({ status: "error", message: "API key is not set. Please set it in the options." });
                    chrome.runtime.openOptionsPage();
                    return;
                }
                
                // --- STAGE 1: IDENTIFY AD SELECTORS FROM SKELETON ---
                // 3. Ask content script for the skeletonized HTML of the page.
                const skeletonHtml = await chrome.tabs.sendMessage(tabId, { action: "getSkeletonHtml" });
                if (!skeletonHtml) {
                    sendResponse({ status: "success", count: 0 });
                    return;
                }

                // 4. Send the skeleton to Gemini to get a list of likely ad selectors.
                const adSelectors = await findAdSelectorsFromSkeleton(skeletonHtml, apiKey);
                if (!adSelectors || adSelectors.length === 0) {
                    sendResponse({ status: "success", count: 0 });
                    return;
                }

                // --- STAGE 2: GET DESCRIPTIONS FOR IDENTIFIED ADS ---
                // 5. Ask content script to get the full HTML for only the identified ad selectors.
                const adSnippets = await chrome.tabs.sendMessage(tabId, {
                    action: "getAdSnippets",
                    selectors: adSelectors
                });

                // 6. Analyze each snippet with Gemini to get a description.
                const analysisPromises = adSnippets.map(snippet =>
                    analyzeAdSnippet(snippet.html, apiKey)
                );
                const results = await Promise.all(analysisPromises);

                // 7. Format the final data for overlay creation.
                const confirmedAds = [];
                for (let i = 0; i < results.length; i++) {
                    if (results[i].isAd) {
                        confirmedAds.push({
                            selector: adSnippets[i].selector,
                            description: results[i].description
                        });
                    }
                }

                // 8. Send confirmed ads to content script to create overlays.
                if (confirmedAds.length > 0) {
                    const response = await chrome.tabs.sendMessage(tabId, {
                        action: "createOverlays",
                        data: { ads: confirmedAds }
                    });
                     sendResponse({ status: "success", count: response.count });
                } else {
                     sendResponse({ status: "success", count: 0 });
                }

            } catch (error) {
                console.error("Ad Reader Background Error:", error);
                sendResponse({ status: "error", message: error.message || "An unknown error occurred." });
            }
        })();
        return true; // Indicate async response.
    }
});

/**
 * STAGE 1: Asks Gemini to find likely ad selectors from a skeletonized HTML.
 */
async function findAdSelectorsFromSkeleton(skeletonHtml, apiKey) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const prompt = `
        Analyze the following skeletonized HTML structure. Based on the element tags, class names, IDs, and structure, identify which elements are most likely to be advertisements.
        Do not analyze the content, only the structure. Pay attention to common ad-related patterns like 'aside', 'iframe', and divs with names like 'ad-container', 'sidebar-ad', 'banner'.

        Respond ONLY with a valid JSON object containing a single key "selectors", which is an array of CSS selector strings for each likely ad element.

        Example Response:
        {
          "selectors": [
            "#top-banner-ad-container",
            "body > div.main-content > aside > div.ad-wrapper",
            "iframe[src*='googlesyndication']"
          ]
        }

        Here is the skeleton HTML:
        \`\`\`html
        ${skeletonHtml}
        \`\`\`
    `;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) return [];
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanedText);
            return parsed.selectors || [];
        }
    } catch (error) {
        console.error("Error finding ad selectors from skeleton:", error);
    }
    return [];
}


/**
 * STAGE 2: Asks Gemini to describe a single, specific HTML ad snippet.
 */
async function analyzeAdSnippet(htmlSnippet, apiKey) {
    // FIX: Made model name consistent with the other function.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const prompt = `
        Analyze the following HTML snippet. Your task is to determine if it is an advertisement.
        - If it IS an advertisement, provide a concise, one-sentence description of what it's for. The description must be in the same language as the ad content.
        - If it is NOT an advertisement, simply state that it is not an ad.

        Respond ONLY with a valid JSON object with two keys: "isAd" (boolean) and "description" (string). If isAd is false, description should be an empty string.

        Here is the HTML snippet to analyze:
        \`\`\`html
        ${htmlSnippet}
        \`\`\`
    `;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) return { isAd: false, description: "" };
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedText);
        }
    } catch (error) {
        console.error("Error analyzing ad snippet:", error);
    }
    return { isAd: false, description: "" };
}