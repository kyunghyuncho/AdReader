# Ad Reader - Microsoft Edge Extension

Ad Reader is an accessibility-focused browser extension designed to help users with visual impairments or reading difficulties understand the content of advertisements on web pages. It uses the power of Google's Gemini AI to analyze, describe, and overlay ads with clear, readable descriptions.

## ✨ Features

* **AI-Powered Ad Detection:** Scans the entire webpage to identify advertisement elements.
* **Intelligent Descriptions:** Calls the Gemini API to generate concise, easy-to-understand descriptions of each ad's content.
* **Multi-Language Support:** Automatically provides ad descriptions in the primary language of the webpage.
* **Clear Overlays:** Places a dark, non-intrusive overlay on each detected ad, featuring a speaker icon and the AI-generated description.
* **User-Controlled:** Overlays can be dismissed individually with a simple click on the 'x' button.
* **Clean Experience:** All overlays are automatically removed when you navigate to a new page or reload, ensuring a fresh start every time.

## 🚀 Installation & Setup

To get started with Ad Reader for development, you can "sideload" it into Microsoft Edge.

### 1. Clone or Download the Repository

First, get the project files onto your local machine.

```bash
git clone https://github.com/your-username/ad-reader.git
```

Or download the ZIP and extract it.

### 2. Load the Extension in Edge

1.  Open Microsoft Edge and navigate to the extensions page by typing `edge://extensions` in the address bar.
2.  In the bottom-left corner, toggle on **Developer mode**.
3.  Click the **Load unpacked** button that appears at the top of the page.
4.  In the file selection dialog, navigate to and select the `AdReader` project folder.

The Ad Reader icon should now appear in your browser's toolbar!

### 3. Configure the API Key

The extension requires a Google Gemini API key to function.

1.  Visit the [**Google AI Studio**](https://aistudio.google.com/app/apikey) to generate your free API key.
2.  In Edge, right-click the Ad Reader extension icon and select **Options**.
3.  Paste your newly generated API key into the input field and click **Save**.

## 📖 How to Use

1.  Navigate to any webpage that contains advertisements.
2.  Click on the **Ad Reader icon** in the Edge toolbar to open the popup.
3.  Click the **Scan for Ads** button.
4.  After a brief moment, the extension will overlay all detected ads with a description.
    * Click the **'×'** on any overlay to dismiss it individually.

## 🔧 How It Works

The extension is built on three core components that work together:

* **Popup Script (`popup.js`):** This is the user interface you see when you click the extension icon. Its only job is to tell the background script when to start scanning a page.
* **Background Script (`background.js`):** This is the extension's brain. It listens for the "scan" command, retrieves the page's HTML, sends it to the Gemini API for analysis, and then passes the results to the content script. It also handles page navigation events to know when to clear old overlays.
* **Content Script (`content.js`):** This script is injected directly into the webpage. It receives the ad data from the background script and is responsible for creating, styling, and managing the overlays that you see on the page.

## 🛠️ Troubleshooting

If you encounter any issues, here are a few common solutions:

* **Overlays are not appearing:**
    * Ensure you have correctly saved your Gemini API key in the options page.
    * Open the DevTools (F12) on the webpage and check the Console for any errors prefixed with "Ad Reader".
    * The page may not have any elements that the AI identifies as an advertisement.
* **The popup says "API key is not set":**
    * Right-click the extension icon, go to **Options**, and re-enter and save your API key.
* **Ad descriptions seem incorrect:**
    * The quality of the description depends on the AI model's analysis. Try reloading the page and scanning again.

## 🗺️ Future Plans

We have exciting features planned for future releases:

* **\[ ] Text-to-Speech:** Implement audio playback of the ad descriptions when the speaker icon is clicked.
* **\[ ] Customization:** Add options to allow users to change the color and appearance of the overlays.
* **\[ ] Allow/Block Lists:** Give users the ability to specify domains where the extension should automatically run or be disabled.

## 🤝 How to Contribute

Contributions are welcome! If you have ideas for new features, bug fixes, or improvements, please feel free to:

1.  **Fork the repository.**
2.  Create a new branch for your feature (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a **Pull Request**.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

