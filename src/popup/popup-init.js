import { initializeTabs } from './popup-tabs.js';
import { PopupInitializer } from './popup-core.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize tabs
        initializeTabs();

        // Initialize popup
        const popupInitializer = new PopupInitializer();
        await popupInitializer.initialize();
    } catch (error) {
        console.error('Error initializing popup:', error);
    }
});