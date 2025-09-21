/**
 * Social Filler Pro - Content Script Entry Point
 * 
 * This script dynamically imports the main content script module
 * and initializes it. This is the entry point defined in manifest.json.
 * 
 * @version 7.1
 * @author Social Filler Pro Team
 */

'use strict';

(async () => {
    try {
        // Get the URL for the main content script module
        const coreScriptURL = chrome.runtime.getURL('src/content/content-core.js');
        
        // Dynamically import the module
        const { default: ContentScript } = await import(coreScriptURL);
        
        // Initialize the content script
        if (typeof window.contentScript === 'undefined') {
            window.contentScript = new ContentScript();
            console.log('[Social Filler Pro] Content script loaded and initialized.');
        } else {
            console.log('[Social Filler Pro] Content script already loaded.');
        }
    } catch (error) {
        console.error('[Social Filler Pro] Failed to load content script module:', error);
    }
})();
