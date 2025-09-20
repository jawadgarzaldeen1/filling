/**
 * Core Content Script for Social Filler Pro Extension
 * 
 * This module provides:
 * - Field detection and filling
 * - Message handling
 * - State management
 * - Auto-selection features
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONTENT_CONFIG = {
    VERSION: '7.0',
    SELECTORS: {
        // Social media fields
        FACEBOOK: ['input[name*="facebook"]', 'input[id*="facebook"]', 'input[placeholder*="facebook" i]'],
        INSTAGRAM: ['input[name*="instagram"]', 'input[id*="instagram"]', 'input[placeholder*="instagram" i]'],
        TWITTER: ['input[name*="twitter"]', 'input[id*="twitter"]', 'input[placeholder*="twitter" i]'],
        YOUTUBE: ['input[name*="youtube"]', 'input[id*="youtube"]', 'input[placeholder*="youtube" i]'],
        LINKEDIN: ['input[name*="linkedin"]', 'input[id*="linkedin"]', 'input[placeholder*="linkedin" i]'],
        PINTEREST: ['input[name*="pinterest"]', 'input[id*="pinterest"]', 'input[placeholder*="pinterest" i]'],
        TIKTOK: ['input[name*="tiktok"]', 'input[id*="tiktok"]', 'input[placeholder*="tiktok" i]'],
        SNAPCHAT: ['input[name*="snapchat"]', 'input[id*="snapchat"]', 'input[placeholder*="snapchat" i]'],
        WEBSITE: ['input[name*="website"]', 'input[id*="website"]', 'input[placeholder*="website" i]', 'input[type="url"]'],
        
        // Universal form fields
        EMAIL: ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]'],
        PHONE: ['input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]'],
        NAME: ['input[name*="name" i]', 'input[id*="name" i]', 'input[placeholder*="name" i]'],
        COMPANY: ['input[name*="company" i]', 'input[id*="company" i]', 'input[placeholder*="company" i]'],
        ADDRESS: ['input[name*="address" i]', 'input[id*="address" i]', 'input[placeholder*="address" i]'],
        CITY: ['input[name*="city" i]', 'input[id*="city" i]', 'input[placeholder*="city" i]'],
        STATE: ['input[name*="state" i]', 'input[id*="state" i]', 'input[placeholder*="state" i]'],
        ZIP: ['input[name*="zip" i]', 'input[id*="zip" i]', 'input[placeholder*="zip" i]', 'input[name*="postal" i]'],
        
        // Category dropdowns
        CATEGORY: [
            'select[name="catId"]', 'select[id="catId"]', 
            'select[name="CATEGORY_ID"]', 'select[name="category"]',
            'select[id="category"]', 'select[name="category_id"]',
            'select[id="category_id"]'
        ],
        
        // Location dropdowns
        COUNTRY: [
            'select[name="countryId"]', 'select[id="countryId"]',
            'select[name="country"]', 'select[id="country"]',
            'select[name="country_id"]', 'select[id="country_id"]'
        ],
        REGION: [
            'select[name="regionId"]', 'select[id="regionId"]',
            'select[name="region"]', 'select[id="region"]',
            'select[name="state"]', 'select[id="state"]',
            'select[name="state_id"]', 'select[id="state_id"]'
        ],
        CITY: [
            'select[name="cityId"]', 'select[id="cityId"]',
            'select[name="city"]', 'select[id="city"]',
            'select[name="city_id"]', 'select[id="city_id"]'
        ],
        
        // Password fields
        PASSWORD: ['input[type="password"]', 'input[name*="password" i]', 'input[id*="password" i]']
    },
    MESSAGE_TYPES: {
        CONTEXT_INVALID: 'CONTEXT_INVALID',
        SERVICES_UPDATED: 'SERVICES_UPDATED',
        UNIVERSAL_FORM_DATA_UPDATED: 'UNIVERSAL_FORM_DATA_UPDATED',
        CATEGORY_UPDATED: 'CATEGORY_UPDATED',
        LOCATION_UPDATED: 'LOCATION_UPDATED',
        SETTINGS_UPDATED: 'SETTINGS_UPDATED'
    },
    FILL_DELAY: 100,
    VISUAL_FEEDBACK_DURATION: 2000
};

// ============================================================================
// UTILITY CLASSES
// ============================================================================

/**
 * Enhanced logging system for content scripts
 */
class ContentLogger {
    constructor(context = 'Content') {
        this.context = context;
        this.logLevel = 2; // INFO level
    }

    setLogLevel(level) {
        this.logLevel = typeof level === 'string' 
            ? ['error', 'warn', 'info', 'debug'].indexOf(level.toLowerCase())
            : level;
    }

    log(level, message, ...args) {
        const levelNum = typeof level === 'string' 
            ? ['error', 'warn', 'info', 'debug'].indexOf(level.toLowerCase())
            : level;
        
        if (levelNum <= this.logLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${this.context}]`;
            
            switch (levelNum) {
                case 0: // ERROR
                    console.error(prefix, message, ...args);
                    break;
                case 1: // WARN
                    console.warn(prefix, message, ...args);
                    break;
                case 2: // INFO
                    console.info(prefix, message, ...args);
                    break;
                case 3: // DEBUG
                    console.debug(prefix, message, ...args);
                    break;
            }
        }
    }

    error(message, ...args) { this.log(0, message, ...args); }
    warn(message, ...args) { this.log(1, message, ...args); }
    info(message, ...args) { this.log(2, message, ...args); }
    debug(message, ...args) { this.log(3, message, ...args); }
}

/**
 * Field detection and scoring system
 */
class FieldDetector {
    constructor(logger) {
        this.logger = logger;
        this.cache = new Map();
    }

    /**
     * Find and score fields based on selectors and content
     */
    findFields(selectors, fieldType) {
        const cacheKey = `${fieldType}-${selectors.join(',')}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const fields = [];
        
        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const score = this.calculateFieldScore(element, fieldType);
                    if (score > 0) {
                        fields.push({ element, score, selector, fieldType });
                    }
                });
            } catch (error) {
                this.logger.warn(`Invalid selector: ${selector}`, error);
            }
        }

        // Sort by score (highest first) and remove duplicates
        const uniqueFields = this.removeDuplicateFields(fields);
        uniqueFields.sort((a, b) => b.score - a.score);

        this.cache.set(cacheKey, uniqueFields);
        return uniqueFields;
    }

    /**
     * Calculate field relevance score
     */
    calculateFieldScore(element, fieldType) {
        let score = 0;

        // Base score for matching selector
        score += 10;

        // Check element attributes
        const name = element.name?.toLowerCase() || '';
        const id = element.id?.toLowerCase() || '';
        const placeholder = element.placeholder?.toLowerCase() || '';
        const className = element.className?.toLowerCase() || '';

        // Exact matches get highest score
        if (name.includes(fieldType) || id.includes(fieldType) || placeholder.includes(fieldType)) {
            score += 20;
        }

        // Partial matches
        if (name.includes(fieldType.substring(0, 3)) || id.includes(fieldType.substring(0, 3))) {
            score += 10;
        }

        // Check if field is visible and enabled
        if (element.offsetParent !== null && !element.disabled && !element.readOnly) {
            score += 5;
        }

        // Check if field is empty or has placeholder value
        if (!element.value || element.value === element.placeholder) {
            score += 5;
        }

        // Penalize hidden or disabled fields
        if (element.type === 'hidden' || element.disabled || element.readOnly) {
            score -= 20;
        }

        return Math.max(0, score);
    }

    /**
     * Remove duplicate fields (same element)
     */
    removeDuplicateFields(fields) {
        const seen = new Set();
        return fields.filter(field => {
            const key = `${field.element.tagName}-${field.element.name}-${field.element.id}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.debug('Field detection cache cleared');
    }
}

/**
 * Field filling system with visual feedback
 */
class FieldFiller {
    constructor(logger) {
        this.logger = logger;
        this.filledFields = new Set();
    }

    /**
     * Fill a field with value and provide visual feedback
     */
    async fillField(element, value, fieldType) {
        if (!element || !value || element.disabled || element.readOnly) {
            return false;
        }

        try {
            // Store original value for comparison
            const originalValue = element.value;
            
            // Fill the field
            element.value = value;
            
            // Trigger events
            this.triggerFieldEvents(element);
            
            // Add visual feedback
            this.addVisualFeedback(element, fieldType);
            
            // Track filled field
            this.filledFields.add(element);
            
            this.logger.debug(`Filled ${fieldType} field:`, { 
                selector: this.getElementSelector(element),
                value: value,
                originalValue: originalValue
            });
            
            return true;
        } catch (error) {
            this.logger.error(`Error filling ${fieldType} field:`, error);
            return false;
        }
    }

    /**
     * Fill multiple fields of the same type
     */
    async fillFields(fields, value, fieldType) {
        if (!fields || fields.length === 0 || !value) {
            return 0;
        }

        let filledCount = 0;
        
        for (const field of fields) {
            if (await this.fillField(field.element, value, fieldType)) {
                filledCount++;
                // Add small delay between fills
                await this.delay(CONTENT_CONFIG.FILL_DELAY);
            }
        }

        this.logger.info(`Filled ${filledCount} ${fieldType} field(s)`);
        return filledCount;
    }

    /**
     * Trigger field events to ensure proper form handling
     */
    triggerFieldEvents(element) {
        const events = ['input', 'change', 'blur'];
        
        events.forEach(eventType => {
            const event = new Event(eventType, { 
                bubbles: true, 
                cancelable: true 
            });
            element.dispatchEvent(event);
        });
    }

    /**
     * Add visual feedback to filled field
     */
    addVisualFeedback(element, fieldType) {
        const originalBackground = element.style.backgroundColor;
        const originalBorder = element.style.borderColor;
        
        // Apply visual feedback
        element.style.backgroundColor = '#E8F5E8';
        element.style.borderColor = '#4CAF50';
        element.style.transition = 'all 0.3s ease';
        
        // Remove visual feedback after delay
        setTimeout(() => {
            element.style.backgroundColor = originalBackground;
            element.style.borderColor = originalBorder;
        }, CONTENT_CONFIG.VISUAL_FEEDBACK_DURATION);
    }

    /**
     * Get CSS selector for element
     */
    getElementSelector(element) {
        if (element.id) return `#${element.id}`;
        if (element.name) return `[name="${element.name}"]`;
        if (element.className) return `.${element.className.split(' ')[0]}`;
        return element.tagName.toLowerCase();
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear filled fields tracking
     */
    clearFilledFields() {
        this.filledFields.clear();
        this.logger.debug('Cleared filled fields tracking');
    }
}

// ============================================================================
// AUTO-SELECTION SYSTEMS
// ============================================================================

/**
 * Category auto-selection system
 */
class CategoryAutoSelector {
    constructor(logger, fieldFiller) {
        this.logger = logger;
        this.fieldFiller = fieldFiller;
    }

    /**
     * Auto-select category dropdowns
     */
    async selectCategoryDropdowns() {
        try {
            // Get saved category from storage
            const result = await chrome.storage.sync.get('selectedCategory');
            const savedCategory = result.selectedCategory;
            
            if (!savedCategory) {
                this.logger.debug('No saved category found for auto-selection');
                return 0;
            }
            
            this.logger.info('Looking for category dropdowns to auto-select:', savedCategory);
            
            // Find category dropdowns
            const fields = this.findCategoryDropdowns();
            let selectedCount = 0;
            
            for (const field of fields) {
                if (this.selectCategoryInDropdown(field.element, savedCategory)) {
                    selectedCount++;
                    await this.fieldFiller.delay(CONTENT_CONFIG.FILL_DELAY);
                }
            }
            
            if (selectedCount > 0) {
                this.logger.info(`Auto-selected category in ${selectedCount} dropdown(s)`);
            } else {
                this.logger.debug('No matching category dropdowns found');
            }
            
            return selectedCount;
        } catch (error) {
            this.logger.error('Error auto-selecting categories:', error);
            return 0;
        }
    }

    /**
     * Find category dropdown elements
     */
    findCategoryDropdowns() {
        const fields = [];
        
        for (const selector of CONTENT_CONFIG.SELECTORS.CATEGORY) {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.tagName === 'SELECT' && element.options.length > 1) {
                        fields.push({ element, selector });
                    }
                });
            } catch (error) {
                this.logger.warn(`Invalid category selector: ${selector}`, error);
            }
        }
        
        return fields;
    }

    /**
     * Select category in dropdown
     */
    selectCategoryInDropdown(select, savedCategory) {
        if (!select || !select.options) return false;
        
        const options = Array.from(select.options);
        let matchingOption = null;
        
        // First try exact match
        matchingOption = options.find(option => 
            option.text.trim() === savedCategory || 
            option.text.includes(savedCategory)
        );
        
        // If no exact match, try partial match (case insensitive)
        if (!matchingOption) {
            const lowerSaved = savedCategory.toLowerCase();
            matchingOption = options.find(option => 
                option.text.toLowerCase().includes(lowerSaved) ||
                lowerSaved.includes(option.text.toLowerCase())
            );
        }
        
        if (matchingOption) {
            select.value = matchingOption.value;
            this.fieldFiller.triggerFieldEvents(select);
            this.fieldFiller.addVisualFeedback(select, 'category');
            
            this.logger.debug('Auto-selected category:', matchingOption.text);
            return true;
        }
        
        return false;
    }
}

/**
 * Location auto-fill system
 */
class LocationAutoFiller {
    constructor(logger, fieldFiller) {
        this.logger = logger;
        this.fieldFiller = fieldFiller;
    }

    /**
     * Auto-fill location fields
     */
    async fillLocationFields() {
        try {
            // Get saved location from storage
            const result = await chrome.storage.sync.get('selectedLocation');
            const savedLocation = result.selectedLocation;
            
            if (!savedLocation) {
                this.logger.debug('No saved location found for auto-fill');
                return 0;
            }
            
            this.logger.info('Looking for location fields to auto-fill:', savedLocation);
            
            let filledCount = 0;
            
            // Fill country dropdown
            if (savedLocation.country) {
                filledCount += await this.fillCountryDropdowns(savedLocation.country);
            }
            
            // Fill region/state dropdown
            if (savedLocation.region) {
                filledCount += await this.fillRegionDropdowns(savedLocation.region);
            }
            
            // Fill city dropdown
            if (savedLocation.city) {
                filledCount += await this.fillCityDropdowns(savedLocation.city);
            }
            
            // Fill address input
            if (savedLocation.address) {
                filledCount += await this.fillAddressInputs(savedLocation.address);
            }
            
            if (filledCount > 0) {
                this.logger.info(`Auto-filled ${filledCount} location field(s)`);
            } else {
                this.logger.debug('No matching location fields found');
            }
            
            return filledCount;
        } catch (error) {
            this.logger.error('Error auto-filling location fields:', error);
            return 0;
        }
    }

    /**
     * Fill country dropdowns
     */
    async fillCountryDropdowns(countryCode) {
        const fields = this.findLocationDropdowns(CONTENT_CONFIG.SELECTORS.COUNTRY);
        let filledCount = 0;
        
        for (const field of fields) {
            if (this.selectLocationInDropdown(field.element, countryCode, 'country')) {
                filledCount++;
                await this.fieldFiller.delay(CONTENT_CONFIG.FILL_DELAY);
            }
        }
        
        return filledCount;
    }

    /**
     * Fill region dropdowns
     */
    async fillRegionDropdowns(regionName) {
        const fields = this.findLocationDropdowns(CONTENT_CONFIG.SELECTORS.REGION);
        let filledCount = 0;
        
        for (const field of fields) {
            if (this.selectLocationInDropdown(field.element, regionName, 'region')) {
                filledCount++;
                await this.fieldFiller.delay(CONTENT_CONFIG.FILL_DELAY);
            }
        }
        
        return filledCount;
    }

    /**
     * Fill city dropdowns
     */
    async fillCityDropdowns(cityName) {
        const fields = this.findLocationDropdowns(CONTENT_CONFIG.SELECTORS.CITY);
        let filledCount = 0;
        
        for (const field of fields) {
            if (this.selectLocationInDropdown(field.element, cityName, 'city')) {
                filledCount++;
                await this.fieldFiller.delay(CONTENT_CONFIG.FILL_DELAY);
            }
        }
        
        return filledCount;
    }

    /**
     * Fill address inputs
     */
    async fillAddressInputs(address) {
        const fields = this.findLocationInputs(CONTENT_CONFIG.SELECTORS.ADDRESS);
        let filledCount = 0;
        
        for (const field of fields) {
            if (await this.fieldFiller.fillField(field.element, address, 'address')) {
                filledCount++;
                await this.fieldFiller.delay(CONTENT_CONFIG.FILL_DELAY);
            }
        }
        
        return filledCount;
    }

    /**
     * Find location dropdown elements
     */
    findLocationDropdowns(selectors) {
        const fields = [];
        
        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.tagName === 'SELECT' && element.options.length > 1) {
                        fields.push({ element, selector });
                    }
                });
            } catch (error) {
                this.logger.warn(`Invalid location selector: ${selector}`, error);
            }
        }
        
        return fields;
    }

    /**
     * Find location input elements
     */
    findLocationInputs(selectors) {
        const fields = [];
        
        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.tagName === 'INPUT' && element.type !== 'hidden') {
                        fields.push({ element, selector });
                    }
                });
            } catch (error) {
                this.logger.warn(`Invalid location input selector: ${selector}`, error);
            }
        }
        
        return fields;
    }

    /**
     * Select location in dropdown
     */
    selectLocationInDropdown(select, value, type) {
        if (!select || !select.options) return false;
        
        const options = Array.from(select.options);
        let matchingOption = null;
        
        // First try exact match
        matchingOption = options.find(option => 
            option.value === value || 
            option.text.trim() === value ||
            option.text.includes(value)
        );
        
        // If no exact match, try partial match (case insensitive)
        if (!matchingOption) {
            const lowerValue = value.toLowerCase();
            matchingOption = options.find(option => 
                option.text.toLowerCase().includes(lowerValue) ||
                lowerValue.includes(option.text.toLowerCase())
            );
        }
        
        if (matchingOption) {
            select.value = matchingOption.value;
            this.fieldFiller.triggerFieldEvents(select);
            this.fieldFiller.addVisualFeedback(select, type);
            
            this.logger.debug(`Auto-selected ${type}:`, matchingOption.text);
            return true;
        }
        
        return false;
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
            contextValid: true,
            services: {},
            universalFormData: {},
            settings: {}
        };
        
        this.initialize();
    }

    /**
     * Initialize the content script
     */
    async initialize() {
        try {
            this.logger.info(`Initializing Social Filler Pro Content Script v${CONTENT_CONFIG.VERSION}`);
            
            // Setup message listener
            this.setupMessageListener();
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup DOM observers
            this.setupDOMObservers();
            
            // Auto-select categories and fill location
            await this.performAutoSelections();
            
            this.isInitialized = true;
            this.logger.info('Content script initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize content script:', error);
        }
    }

    /**
     * Setup message listener for communication with background and popup
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.logger.debug('Message received:', message.type);
            
            this.handleMessage(message, sender)
                .then(result => sendResponse(result))
                .catch(error => {
                    this.logger.error('Error handling message:', error);
                    sendResponse({ success: false, error: error.message });
                });
            
            return true; // Indicate async response
        });
    }

    /**
     * Handle incoming messages
     */
    async handleMessage(message, sender) {
        try {
            switch (message.type) {
                case CONTENT_CONFIG.MESSAGE_TYPES.CONTEXT_INVALID:
                    this.extensionState.contextValid = false;
                    this.logger.warn('Context invalidated by background worker');
                    return { success: true };
                
                case CONTENT_CONFIG.MESSAGE_TYPES.SERVICES_UPDATED:
                    this.logger.info('Services configuration updated');
                    await this.loadServices();
                    return { success: true };
                
                case CONTENT_CONFIG.MESSAGE_TYPES.UNIVERSAL_FORM_DATA_UPDATED:
                    this.logger.info('Universal form data updated');
                    this.extensionState.universalFormData = message.data || {};
                    setTimeout(() => this.fillUniversalForms(), 500);
                    return { success: true };
                
                case CONTENT_CONFIG.MESSAGE_TYPES.CATEGORY_UPDATED:
                    this.logger.info('Category updated, auto-selecting category dropdowns');
                    setTimeout(() => this.categoryAutoSelector.selectCategoryDropdowns(), 500);
                    return { success: true };
                
                case CONTENT_CONFIG.MESSAGE_TYPES.LOCATION_UPDATED:
                    this.logger.info('Location updated, auto-filling location fields');
                    setTimeout(() => this.locationAutoFiller.fillLocationFields(), 500);
                    return { success: true };
                
                case CONTENT_CONFIG.MESSAGE_TYPES.SETTINGS_UPDATED:
                    this.logger.info('Settings updated');
                    this.extensionState.settings = message.settings || {};
                    this.updateSettings();
                    return { success: true };
                
                default:
                    this.logger.warn('Unknown message type:', message.type);
                    return { success: false, error: 'Unknown message type' };
            }
        } catch (error) {
            this.logger.error('Error handling message:', error);
            throw error;
        }
    }

    /**
     * Load initial data from storage
     */
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadServices(),
                this.loadUniversalFormData(),
                this.loadSettings()
            ]);
            this.logger.debug('Initial data loaded successfully');
        } catch (error) {
            this.logger.error('Error loading initial data:', error);
        }
    }

    /**
     * Load services from storage
     */
    async loadServices() {
        try {
            const result = await chrome.storage.sync.get('services');
            this.extensionState.services = result.services || {};
            this.logger.debug('Services loaded:', Object.keys(this.extensionState.services).length);
        } catch (error) {
            this.logger.error('Error loading services:', error);
        }
    }

    /**
     * Load universal form data from storage
     */
    async loadUniversalFormData() {
        try {
            const result = await chrome.storage.sync.get('universalFormData');
            this.extensionState.universalFormData = result.universalFormData || {};
            this.logger.debug('Universal form data loaded:', Object.keys(this.extensionState.universalFormData).length);
        } catch (error) {
            this.logger.error('Error loading universal form data:', error);
        }
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get('settings');
            this.extensionState.settings = result.settings || {};
            this.updateSettings();
            this.logger.debug('Settings loaded:', Object.keys(this.extensionState.settings).length);
        } catch (error) {
            this.logger.error('Error loading settings:', error);
        }
    }

    /**
     * Update settings and apply to components
     */
    updateSettings() {
        if (this.extensionState.settings.debugMode) {
            this.logger.setLogLevel('debug');
        } else {
            this.logger.setLogLevel('info');
        }
    }

    /**
     * Setup DOM observers for dynamic content
     */
    setupDOMObservers() {
        // Observer for new form elements
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'FORM' || 
                                node.querySelector && node.querySelector('input, select, textarea')) {
                                shouldCheck = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldCheck) {
                this.logger.debug('New form elements detected, checking for auto-selections');
                setTimeout(() => {
                    this.performAutoSelections();
                }, 1000);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.logger.debug('DOM observer setup complete');
    }

    /**
     * Perform auto-selections (categories and location)
     */
    async performAutoSelections() {
        try {
            await Promise.all([
                this.categoryAutoSelector.selectCategoryDropdowns(),
                this.locationAutoFiller.fillLocationFields()
            ]);
        } catch (error) {
            this.logger.error('Error performing auto-selections:', error);
        }
    }

    /**
     * Fill universal forms with stored data
     */
    async fillUniversalForms() {
        try {
            const data = this.extensionState.universalFormData;
            if (!data || Object.keys(data).length === 0) {
                this.logger.debug('No universal form data to fill');
                return;
            }
            
            this.logger.info('Filling universal forms with stored data');
            
            // Map data fields to selectors
            const fieldMappings = {
                email: CONTENT_CONFIG.SELECTORS.EMAIL,
                phone: CONTENT_CONFIG.SELECTORS.PHONE,
                name: CONTENT_CONFIG.SELECTORS.NAME,
                company: CONTENT_CONFIG.SELECTORS.COMPANY,
                address: CONTENT_CONFIG.SELECTORS.ADDRESS,
                city: CONTENT_CONFIG.SELECTORS.CITY,
                state: CONTENT_CONFIG.SELECTORS.STATE,
                zip: CONTENT_CONFIG.SELECTORS.ZIP
            };
            
            let totalFilled = 0;
            
            for (const [fieldType, selectors] of Object.entries(fieldMappings)) {
                if (data[fieldType]) {
                    const fields = this.fieldDetector.findFields(selectors, fieldType);
                    const filled = await this.fieldFiller.fillFields(fields, data[fieldType], fieldType);
                    totalFilled += filled;
                }
            }
            
            if (totalFilled > 0) {
                this.logger.info(`Filled ${totalFilled} universal form fields`);
            }
        } catch (error) {
            this.logger.error('Error filling universal forms:', error);
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.contentScript = new ContentScript();
    });
} else {
    window.contentScript = new ContentScript();
}

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ContentScript,
        ContentLogger,
        FieldDetector,
        FieldFiller,
        CategoryAutoSelector,
        LocationAutoFiller,
        CONTENT_CONFIG
    };
}
