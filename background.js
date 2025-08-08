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
                // 1. Inject the content script to find potential ad elements first.
                await chrome.scripting.executeScript({
                    target: { tabId: request.tabId },
                    files: ['content.js']
                });

                // 2. Ask the content script to find and send back potential ad snippets.
                const adCandidates = await chrome.tabs.sendMessage(request.tabId, {
                    action: "findAdCandidates"
                });

                if (!adCandidates || adCandidates.length === 0) {
                    sendResponse({ status: "success", count: 0 });
                    return;
                }

                // 3. Get the API key from storage.
                const { apiKey } = await chrome.storage.sync.get('apiKey');
                if (!apiKey) {
                    sendResponse({ status: "error", message: "API key is not set. Please set it in the options." });
                    chrome.runtime.openOptionsPage();
                    return;
                }

                // 4. Analyze each candidate snippet with Gemini in parallel.
                const analysisPromises = adCandidates.map(candidate =>
                    analyzeAdSnippet(candidate.html, apiKey)
                );
                const results = await Promise.all(analysisPromises);

                // 5. Filter out non-ads and format the data for the content script.
                const confirmedAds = [];
                for (let i = 0; i < results.length; i++) {
                    if (results[i].isAd) {
                        confirmedAds.push({
                            selector: adCandidates[i].selector,
                            description: results[i].description
                        });
                    }
                }

                // 6. Send the confirmed ads back to the content script to be overlaid.
                if (confirmedAds.length > 0) {
                    const response = await chrome.tabs.sendMessage(request.tabId, {
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
 * Calls the Gemini API to analyze a single HTML snippet.
 * @param {string} htmlSnippet - A small piece of HTML that might be an ad.
 * @param {string} apiKey - The user's Gemini API key.
 * @returns {Promise<{isAd: boolean, description: string}>} - A promise that resolves to an object indicating if the snippet is an ad and its description.
 */
async function analyzeAdSnippet(htmlSnippet, apiKey) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
        Analyze the following HTML snippet. Your task is to determine if it is an advertisement.
        - If it IS an advertisement, provide a concise but precise one-sentence description of what it's for. The description must be in the same language as the ad content.
        - If it is NOT an advertisement (e.g., a navigation menu, a cookie consent banner, a related articles widget), simply state that it is not an ad.

        Respond ONLY with a valid JSON object with two keys:
        1. "isAd": a boolean (true or false).
        2. "description": a string. If isAd is false, this should be an empty string "".

        Example Response (for an ad):
        {
          "isAd": true,
          "description": "An advertisement for a new sports car."
        }

        Example Response (for non-ad):
        {
          "isAd": false,
          "description": ""
        }

        Here is the HTML snippet to analyze:
        \`\`\`html
        ${htmlSnippet}
        \`\`\`
    `;

    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("API request failed:", response.status, await response.text());
            return { isAd: false, description: "" }; // Gracefully fail
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedText);
        }
    } catch (error) {
        console.error("Error parsing Gemini response:", error);
    }
    
    // Default fallback in case of any error
    return { isAd: false, description: "" };
}