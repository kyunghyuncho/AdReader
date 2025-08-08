/**
 * Listener to automatically clear overlays when the user navigates to a new page.
 */
chrome.webNavigation.onCommitted.addListener((details) => {
    // We only want to act on the main page, not on iframes or other resources.
    if (details.frameId === 0) {
        // Send a message to the content script in that tab, telling it to clear overlays.
        chrome.tabs.sendMessage(details.tabId, { action: "clearOverlays" })
            .catch(error => {
                // This error is expected if the content script hasn't been injected on a page yet.
                // We can safely ignore it.
                if (!error.message.includes("Could not establish connection. Receiving end does not exist.")) {
                    console.warn("Ad Reader: Could not send clearOverlays message.", error);
                }
            });
    }
});


/**
 * Listener for messages from other parts of the extension (e.g., the popup).
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanForAds") {
        // This makes the function asynchronous, allowing us to use await
        (async () => {
            try {
                // 1. Get the API key from storage
                const data = await chrome.storage.sync.get('apiKey');
                if (!data.apiKey) {
                    sendResponse({ status: "error", message: "API key is not set. Please set it in the options." });
                    chrome.runtime.openOptionsPage();
                    return;
                }

                // 2. Inject the content script into the target tab
                await chrome.scripting.executeScript({
                    target: { tabId: request.tabId },
                    files: ['content.js']
                });

                // 3. Get the page's HTML content from the content script
                const [htmlContent] = await chrome.scripting.executeScript({
                    target: { tabId: request.tabId },
                    function: () => document.documentElement.outerHTML,
                });

                // 4. Call the Gemini API to analyze the HTML
                const adData = await analyzeHtmlWithGemini(htmlContent.result, data.apiKey);

                // 5. Send the ad data back to the content script to create overlays
                const response = await chrome.tabs.sendMessage(request.tabId, {
                    action: "createOverlays",
                    data: adData
                });
                
                // 6. Send a success response back to the popup
                sendResponse({ status: "success", count: response.count });

            } catch (error) {
                console.error("Ad Reader Background Error:", error);
                sendResponse({ status: "error", message: error.message || "An unknown error occurred." });
            }
        })();
        // Return true to indicate that the response will be sent asynchronously
        return true;
    }
});

/**
 * Calls the Gemini API to find and describe ads in the provided HTML.
 * @param {string} html - The HTML content of the page.
 * @param {string} apiKey - The user's Gemini API key.
 * @returns {Promise<object>} - A promise that resolves to the parsed JSON response from the API.
 */
async function analyzeHtmlWithGemini(html, apiKey) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
        Analyze the following HTML content. Your task is to identify all elements that are advertisements.
        For each advertisement you find, provide a robust CSS selector to locate it and a concise, one-sentence description of what the ad is for.
        Usually each ad is relatively small and can be identified by its unique attributes or text.
        All the advertisements in the page must be identified and described, as this is crucial for the user to understand what ads are present.
        The description should be easy to understand for someone with visual impairments.
        The description must be about the actual content of the ad, not just the element's text or attributes.
        Crucially, the description must be written in the primary language used in the advertisement or the surrounding page content.

        Respond ONLY with a valid JSON object. The JSON object should have a single key "ads", which is an array of objects.
        Each object in the array must have two keys: "selector" (the CSS selector string) and "description" (the ad description string).
        
        Example Response Format (if the page is in Spanish):
        {
          "ads": [
            {
              "selector": "#ad-banner-top",
              "description": "Un anuncio para un nuevo modelo de coche."
            },
            {
              "selector": "div.sidebar-ad > a",
              "description": "Una promoción para un servicio de alojamiento web con descuento."
            }
          ]
        }

        Here is the HTML to analyze:
        ${html}
    `;
    
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    
    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      const text = result.candidates[0].content.parts[0].text;
      // The API might wrap the JSON in markdown, so we need to clean it.
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText);
    } else {
      throw new Error("Invalid response structure from Gemini API.");
    }
}
