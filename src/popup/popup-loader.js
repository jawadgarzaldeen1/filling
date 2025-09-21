// Loader script for popup
(async () => {
    try {
        const { PopupInitializer } = await import(chrome.runtime.getURL('src/popup/popup-core.js'));
        window.popupInitializer = new PopupInitializer();
        await window.popupInitializer.initialize();
    } catch (error) {
        console.error('Error loading popup module:', error);
    }
})();
