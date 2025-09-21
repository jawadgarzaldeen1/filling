/**
 * Core Content Script for Social Filler Pro Extension
 * 
 * This module provides:
 * - Field detection and filling
 * - Message handling
 * - State management
 * - Auto-selection features
 * 
 * @version 7.1
 * @author Social Filler Pro Team
 */

'use strict';

import { EXTENSION_CONFIG } from '../common/config.js';

// ============================================================================
// UTILITY CLASSES
// ============================================================================

class ContentLogger { 
    // ... implementation ...
}

class FieldDetector {
    // ... implementation ...
}

class FieldFiller {
    // ... implementation ...
}

// ============================================================================
// AUTO-SELECTION SYSTEMS
// ============================================================================

class CategoryAutoSelector {
    // ... implementation ...
}

class LocationAutoFiller {
    constructor(logger, fieldFiller) {
        this.logger = logger;
        this.fieldFiller = fieldFiller;
    }

    async fillLocationFields() {
        try {
            const { selectedLocation } = await chrome.storage.sync.get('selectedLocation');

            if (!selectedLocation) {
                this.logger.debug('No saved location found for auto-fill');
                return 0;
            }
            
            this.logger.info('Looking for location fields to auto-fill:', selectedLocation);
            
            let filledCount = 0;
            if (selectedLocation.country) {
                filledCount += await this.fillLocationDropdowns(EXTENSION_CONFIG.SELECTORS.COUNTRY, selectedLocation.country, 'country');
            }
            if (selectedLocation.region) {
                filledCount += await this.fillLocationDropdowns(EXTENSION_CONFIG.SELECTORS.REGION, selectedLocation.region, 'region');
            }
            if (selectedLocation.city) {
                filledCount += await this.fillLocationDropdowns(EXTENSION_CONFIG.SELECTORS.CITY, selectedLocation.city, 'city');
            }
            if (selectedLocation.address) {
                filledCount += await this.fillAddressInputs(selectedLocation.address);
            }
            
            if (filledCount > 0) {
                this.logger.info(`Auto-filled ${filledCount} location field(s)`);
            }
            
            return filledCount;
        } catch (error) {
            this.logger.error('Error auto-filling location fields:', error);
            return 0;
        }
    }

    async fillLocationDropdowns(selectors, value, type) {
        const fields = this.findLocationDropdowns(selectors);
        let filledCount = 0;
        for (const field of fields) {
            if (this.selectLocationInDropdown(field.element, value, type)) {
                filledCount++;
                await this.fieldFiller.delay(EXTENSION_CONFIG.FILL_DELAY);
            }
        }
        return filledCount;
    }

    async fillAddressInputs(address) {
        // ... implementation ...
    }

    findLocationDropdowns(selectors) {
        // ... implementation ...
    }

    findLocationInputs(selectors) {
        // ... implementation ...
    }

    selectLocationInDropdown(select, value, type) {
        // ... implementation ...
    }
}

// ============================================================================
// MAIN CONTENT SCRIPT CLASS
// ============================================================================

class ContentScript {
    constructor() {
        this.logger = new ContentLogger('ContentScript');
        this.fieldDetector = new FieldDetector(this.logger);
        this.fieldFiller = new FieldFiller(this.logger);
        this.categoryAutoSelector = new CategoryAutoSelector(this.logger, this.fieldFiller);
        this.locationAutoFiller = new LocationAutoFiller(this.logger, this.fieldFiller);
        
        this.isInitialized = false;
        this.extensionState = {
            services: {},
            universalFormData: {},
            settings: {}
        };
        
        this.initialize();
    }

    async initialize() {
        this.logger.info(`Initializing Social Filler Pro Content Script v${EXTENSION_CONFIG.VERSION}`);
        this.setupMessageListener();
        await this.loadInitialData();
        this.setupDOMObservers();
        await this.performAutoSelections();
        this.isInitialized = true;
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender).then(sendResponse);
            return true; // Keep message channel open for async response
        });
    }

    async handleMessage(message) {
        const { type, data, settings } = message;
        switch (type) {
            case EXTENSION_CONFIG.MESSAGE_TYPES.SERVICES_UPDATED:
                await this.loadServices();
                break;
            case EXTENSION_CONFIG.MESSAGE_TYPES.UNIVERSAL_FORM_DATA_UPDATED:
                this.extensionState.universalFormData = data || {};
                setTimeout(() => this.fillUniversalForms(), 500);
                break;
            case EXTENSION_CONFIG.MESSAGE_TYPES.CATEGORY_UPDATED:
                setTimeout(() => this.categoryAutoSelector.selectCategoryDropdowns(), 500);
                break;
            case EXTENSION_CONFIG.MESSAGE_TYPES.LOCATION_UPDATED:
                setTimeout(() => this.locationAutoFiller.fillLocationFields(), 500);
                break;
            case EXTENSION_CONFIG.MESSAGE_TYPES.SETTINGS_UPDATED:
                this.extensionState.settings = settings || {};
                this.updateSettings();
                break;
            default:
                this.logger.warn('Unknown message type:', type);
                return { success: false, error: 'Unknown message type' };
        }
        return { success: true };
    }

    async loadInitialData() {
        await Promise.all([
            this.loadServices(),
            this.loadUniversalFormData(),
            this.loadSettings()
        ]);
    }

    async loadServices() {
        const { services } = await chrome.storage.sync.get('services');
        this.extensionState.services = services || {};
    }

    async loadUniversalFormData() {
        const { universalFormData } = await chrome.storage.sync.get('universalFormData');
        this.extensionState.universalFormData = universalFormData || {};
    }

    async loadSettings() {
        const { settings } = await chrome.storage.sync.get('settings');
        this.extensionState.settings = settings || {};
        this.updateSettings();
    }

    updateSettings() {
        const { debugMode } = this.extensionState.settings;
        this.logger.setLogLevel(debugMode ? 'debug' : 'info');
    }

    setupDOMObservers() {
        const observer = new MutationObserver(mutations => {
            if (mutations.some(m => m.addedNodes.length > 0)) {
                this.logger.debug('DOM changed, checking for auto-selections');
                setTimeout(() => this.performAutoSelections(), 1000);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async performAutoSelections() {
        await Promise.all([
            this.categoryAutoSelector.selectCategoryDropdowns(),
            this.locationAutoFiller.fillLocationFields()
        ]);
    }

    async fillUniversalForms() {
        const { universalFormData } = this.extensionState;
        if (!universalFormData || Object.keys(universalFormData).length === 0) return;

        const fieldMappings = {
            email: EXTENSION_CONFIG.SELECTORS.EMAIL,
            phone: EXTENSION_CONFIG.SELECTORS.PHONE,
            name: EXTENSION_CONFIG.SELECTORS.NAME,
            company: EXTENSION_CONFIG.SELECTORS.COMPANY,
            address: EXTENSION_CONFIG.SELECTORS.ADDRESS,
            city: EXTENSION_CONFIG.SELECTORS.CITY,
            state: EXTENSION_CONFIG.SELECTORS.STATE,
            zip: EXTENSION_CONFIG.SELECTORS.ZIP
        };

        for (const [type, selectors] of Object.entries(fieldMappings)) {
            if (universalFormData[type]) {
                const fields = this.fieldDetector.findFields(selectors, type);
                await this.fieldFiller.fillFields(fields, universalFormData[type], type);
            }
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ContentScript());
} else {
    new ContentScript();
}
