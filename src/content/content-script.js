/**
 * Consolidated Content Script for Social Filler Pro Extension
 * 
 * This file consolidates all content script functionality:
 * - Field detection and filling
 * - Universal form filling
 * - Radio button handling
 * - Category auto-selection
 * - Location auto-filling
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONTENT_CONFIG = {
    VERSION: '7.0',
    SELECTORS: {
        // Universal form selectors
        EMAIL: ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]', 'input[placeholder*="email" i]'],
        PHONE: ['input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]', 'input[placeholder*="phone" i]'],
        NAME: ['input[name*="name" i]', 'input[id*="name" i]', 'input[placeholder*="name" i]'],
        COMPANY: ['input[name*="company" i]', 'input[id*="company" i]', 'input[placeholder*="company" i]'],
        ADDRESS: ['input[name*="address" i]', 'input[id*="address" i]', 'input[placeholder*="address" i]'],
        CITY: ['input[name*="city" i]', 'input[id*="city" i]', 'input[placeholder*="city" i]'],
        STATE: ['input[name*="state" i]', 'input[id*="state" i]', 'input[placeholder*="state" i]'],
        ZIP: ['input[name*="zip" i]', 'input[id*="zipcode" i]', 'input[placeholder*="zip" i]'],
        WEBSITE: ['input[name*="website" i]', 'input[id*="website" i]', 'input[placeholder*="website" i]'],
        DESCRIPTION: ['textarea[name*="description" i]', 'textarea[id*="description" i]', 'textarea[placeholder*="description" i]'],
        PASSWORD: ['input[type="password"]', 'input[name*="password" i]', 'input[id*="password" i]'],
        
        // Social media selectors
        FACEBOOK: ['input[name*="facebook" i]', 'input[id*="facebook" i]', 'input[placeholder*="facebook" i]'],
        INSTAGRAM: ['input[name*="instagram" i]', 'input[id*="instagram" i]', 'input[placeholder*="instagram" i]'],
        TWITTER: ['input[name*="twitter" i]', 'input[id*="twitter" i]', 'input[placeholder*="twitter" i]'],
        YOUTUBE: ['input[name*="youtube" i]', 'input[id*="youtube" i]', 'input[placeholder*="youtube" i]'],
        LINKEDIN: ['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[placeholder*="linkedin" i]'],
        PINTEREST: ['input[name*="pinterest" i]', 'input[id*="pinterest" i]', 'input[placeholder*="pinterest" i]'],
        TIKTOK: ['input[name*="tiktok" i]', 'input[id*="tiktok" i]', 'input[placeholder*="tiktok" i]'],
        SNAPCHAT: ['input[name*="snapchat" i]', 'input[id*="snapchat" i]', 'input[placeholder*="snapchat" i]'],
        
        // Category selectors
        CATEGORY: ['select[name*="category" i]', 'select[id*="category" i]', 'select[name*="type" i]'],
        
        // Location selectors (simplified to one field)
        LOCATION: ['select[name*="location" i]', 'select[id*="location" i]', 'input[name*="location" i]', 'select[name*="country" i]', 'select[id*="country" i]', 'select[name*="state" i]', 'select[id*="state" i]', 'select[name*="city" i]', 'select[id*="city" i]']
    },
    
    // Common category mappings
    CATEGORIES: {
        'business': ['business', 'company', 'corporate', 'enterprise', 'organization'],
        'restaurant': ['restaurant', 'food', 'dining', 'cafe', 'bar', 'pub'],
        'retail': ['retail', 'store', 'shop', 'shopping', 'commerce'],
        'service': ['service', 'services', 'professional', 'consulting'],
        'healthcare': ['healthcare', 'medical', 'health', 'clinic', 'hospital'],
        'education': ['education', 'school', 'university', 'learning', 'training'],
        'technology': ['technology', 'tech', 'software', 'IT', 'digital'],
        'entertainment': ['entertainment', 'entertainment', 'media', 'arts', 'culture']
    }
};

// ============================================================================
// LOGGING UTILITY
// ============================================================================

class ContentLogger {
    constructor(context) {
        this.context = context;
        this.logLevel = 'info';
    }

    log(level, message, ...args) {
        const levels = { error: 0, warn: 1, info: 2, debug: 3 };
        if (levels[level] <= levels[this.logLevel]) {
            console[level](`[${this.context}] ${message}`, ...args);
        }
    }

    error(message, ...args) { this.log('error', message, ...args); }
    warn(message, ...args) { this.log('warn', message, ...args); }
    info(message, ...args) { this.log('info', message, ...args); }
    debug(message, ...args) { this.log('debug', message, ...args); }
}

// ============================================================================
// FIELD DETECTOR
// ============================================================================

class FieldDetector {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Find fields using multiple selectors
     */
    findFields(selectors, fieldType) {
        const fields = [];
        
        if (Array.isArray(selectors)) {
            selectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (this.isValidField(element, fieldType)) {
                            fields.push(element);
                        }
                    });
                } catch (error) {
                    this.logger.debug(`Invalid selector: ${selector}`, error);
                }
            });
        } else {
            try {
                const elements = document.querySelectorAll(selectors);
                elements.forEach(element => {
                    if (this.isValidField(element, fieldType)) {
                        fields.push(element);
                    }
                });
            } catch (error) {
                this.logger.debug(`Invalid selector: ${selectors}`, error);
            }
        }
        
        this.logger.debug(`Found ${fields.length} ${fieldType} fields`);
        return fields;
    }

    /**
     * Check if element is a valid field
     */
    isValidField(element, fieldType) {
        if (!element || element.disabled || element.readOnly) {
            return false;
        }
        
        // Check if element is visible
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        
        return true;
    }
}

// ============================================================================
// FIELD FILLER
// ============================================================================

class FieldFiller {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Fill multiple fields with the same value
     */
    async fillFields(fields, value, fieldType) {
        if (!fields || fields.length === 0 || !value) {
            return { filled: 0, errors: [] };
        }

        let filled = 0;
        const errors = [];

        for (const field of fields) {
            try {
                await this.fillField(field, value, fieldType);
                filled++;
            } catch (error) {
                errors.push({ field: field, error: error.message });
                this.logger.warn(`Failed to fill field:`, error);
            }
        }

        this.logger.info(`Filled ${filled}/${fields.length} ${fieldType} fields`);
        return { filled, errors };
    }

    /**
     * Fill a single field
     */
    async fillField(field, value, fieldType) {
        if (!field || !value) return;

        // Focus the field
        field.focus();
        
        // Clear existing value
        field.value = '';
        
        // Trigger input events
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Set the value
        field.value = value;
        
        // Trigger final events
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
        
        this.logger.debug(`Filled ${fieldType} field with: ${value}`);
    }

    /**
     * Select option in dropdown
     */
    selectOption(select, value, type) {
        if (!select || !value) return false;

        const options = Array.from(select.options);
        
        // Try exact match first
        let option = options.find(opt => 
            opt.value.toLowerCase() === value.toLowerCase() || 
            opt.textContent.toLowerCase() === value.toLowerCase()
        );
        
        if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        
        // Try partial match
        option = options.find(opt => 
            opt.value.toLowerCase().includes(value.toLowerCase()) || 
            opt.textContent.toLowerCase().includes(value.toLowerCase())
        );
        
        if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        
        return false;
    }
}

// ============================================================================
// UNIVERSAL FORM FILLER
// ============================================================================

class UniversalFormFiller {
    constructor(logger, fieldDetector, fieldFiller) {
        this.logger = logger;
        this.fieldDetector = fieldDetector;
        this.fieldFiller = fieldFiller;
    }

    /**
     * Fill all universal forms
     */
    async fillAllForms() {
        try {
            const universalData = await this.loadUniversalData();
            if (!universalData || Object.keys(universalData).length === 0) {
                this.logger.info('No universal data available');
                return;
            }

            this.logger.info('Starting universal form filling...');
            
            // Fill each field type
            await this.fillFieldType('email', universalData.email, CONTENT_CONFIG.SELECTORS.EMAIL);
            await this.fillFieldType('phone', universalData.phone, CONTENT_CONFIG.SELECTORS.PHONE);
            await this.fillFieldType('name', universalData.name, CONTENT_CONFIG.SELECTORS.NAME);
            await this.fillFieldType('company', universalData.company, CONTENT_CONFIG.SELECTORS.COMPANY);
            await this.fillFieldType('address', universalData.address, CONTENT_CONFIG.SELECTORS.ADDRESS);
            await this.fillFieldType('city', universalData.city, CONTENT_CONFIG.SELECTORS.CITY);
            await this.fillFieldType('state', universalData.state, CONTENT_CONFIG.SELECTORS.STATE);
            await this.fillFieldType('zip', universalData.zip, CONTENT_CONFIG.SELECTORS.ZIP);
            await this.fillFieldType('website', universalData.website, CONTENT_CONFIG.SELECTORS.WEBSITE);
            await this.fillFieldType('description', universalData.description, CONTENT_CONFIG.SELECTORS.DESCRIPTION);
            
            this.logger.info('Universal form filling completed');
        } catch (error) {
            this.logger.error('Error filling universal forms:', error);
        }
    }

    /**
     * Fill specific field type
     */
    async fillFieldType(fieldType, value, selectors) {
        if (!value) return;
        
        const fields = this.fieldDetector.findFields(selectors, fieldType);
        if (fields.length > 0) {
            await this.fieldFiller.fillFields(fields, value, fieldType);
        }
    }

    /**
     * Load universal data from storage
     */
    async loadUniversalData() {
        try {
            const result = await chrome.storage.sync.get('universalFormData');
            return result.universalFormData || {};
        } catch (error) {
            this.logger.error('Error loading universal data:', error);
            return {};
        }
    }
}

// ============================================================================
// SOCIAL MEDIA FILLER
// ============================================================================

class SocialMediaFiller {
    constructor(logger, fieldDetector, fieldFiller) {
        this.logger = logger;
        this.fieldDetector = fieldDetector;
        this.fieldFiller = fieldFiller;
    }

    /**
     * Fill social media fields
     */
    async fillSocialMedia() {
        try {
            const socialLinks = await this.loadSocialLinks();
            if (!socialLinks || Object.keys(socialLinks).length === 0) {
                this.logger.info('No social media data available');
                return;
            }

            this.logger.info('Starting social media filling...');
            
            // Fill each platform
            const platformMappings = {
                facebook: CONTENT_CONFIG.SELECTORS.FACEBOOK,
                instagram: CONTENT_CONFIG.SELECTORS.INSTAGRAM,
                twitter: CONTENT_CONFIG.SELECTORS.TWITTER,
                youtube: CONTENT_CONFIG.SELECTORS.YOUTUBE,
                linkedin: CONTENT_CONFIG.SELECTORS.LINKEDIN,
                pinterest: CONTENT_CONFIG.SELECTORS.PINTEREST,
                tiktok: CONTENT_CONFIG.SELECTORS.TIKTOK,
                snapchat: CONTENT_CONFIG.SELECTORS.SNAPCHAT
            };

            for (const [platform, selectors] of Object.entries(platformMappings)) {
                const url = socialLinks[platform];
                if (url) {
                    const fields = this.fieldDetector.findFields(selectors, platform);
                    if (fields.length > 0) {
                        await this.fieldFiller.fillFields(fields, url, platform);
                    }
                }
            }
            
            this.logger.info('Social media filling completed');
        } catch (error) {
            this.logger.error('Error filling social media:', error);
        }
    }

    /**
     * Load social links from storage
     */
    async loadSocialLinks() {
        try {
            const result = await chrome.storage.sync.get('socialLinks');
            return result.socialLinks || {};
        } catch (error) {
            this.logger.error('Error loading social links:', error);
            return {};
        }
    }
}

// ============================================================================
// PASSWORD FILLER
// ============================================================================

class PasswordFiller {
    constructor(logger, fieldDetector, fieldFiller) {
        this.logger = logger;
        this.fieldDetector = fieldDetector;
        this.fieldFiller = fieldFiller;
    }

    /**
     * Fill password fields
     */
    async fillPasswords() {
        try {
            const password = await this.loadPassword();
            if (!password) {
                this.logger.info('No password available');
                return;
            }

            const fields = this.fieldDetector.findFields(CONTENT_CONFIG.SELECTORS.PASSWORD, 'password');
            if (fields.length > 0) {
                await this.fieldFiller.fillFields(fields, password, 'password');
            }
        } catch (error) {
            this.logger.error('Error filling passwords:', error);
        }
    }

    /**
     * Load password from storage
     */
    async loadPassword() {
        try {
            const result = await chrome.storage.sync.get('password');
            return result.password || null;
        } catch (error) {
            this.logger.error('Error loading password:', error);
            return null;
        }
    }
}

// ============================================================================
// CATEGORY AUTO SELECTOR
// ============================================================================

class CategoryAutoSelector {
    constructor(logger, fieldFiller) {
        this.logger = logger;
        this.fieldFiller = fieldFiller;
    }

    /**
     * Auto-select categories
     */
    async selectCategories() {
        try {
            const categoryData = await this.loadCategoryData();
            if (!categoryData || !categoryData.selected) {
                this.logger.info('No category data available');
                return;
            }

            const selects = this.findCategorySelects();
            if (selects.length === 0) {
                this.logger.info('No category selects found');
                return;
            }

            this.logger.info(`Found ${selects.length} category selects`);
            
            for (const select of selects) {
                await this.selectCategoryInSelect(select, categoryData.selected);
            }
        } catch (error) {
            this.logger.error('Error selecting categories:', error);
        }
    }

    /**
     * Find category select elements
     */
    findCategorySelects() {
        const selects = [];
        CONTENT_CONFIG.SELECTORS.CATEGORY.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.tagName === 'SELECT' && !element.disabled) {
                        selects.push(element);
                    }
                });
            } catch (error) {
                this.logger.debug(`Invalid category selector: ${selector}`);
            }
        });
        return selects;
    }

    /**
     * Select category in specific select element
     */
    async selectCategoryInSelect(select, category) {
        if (!select || !category) return false;

        const options = Array.from(select.options);
        
        // Try exact match first
        let option = options.find(opt => 
            opt.value.toLowerCase() === category.toLowerCase() || 
            opt.textContent.toLowerCase() === category.toLowerCase()
        );
        
        if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.logger.debug(`Selected category: ${category}`);
            return true;
        }
        
        // Try partial match
        option = options.find(opt => 
            opt.value.toLowerCase().includes(category.toLowerCase()) || 
            opt.textContent.toLowerCase().includes(category.toLowerCase())
        );
        
        if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.logger.debug(`Selected category (partial): ${category}`);
            return true;
        }
        
        return false;
    }

    /**
     * Load category data from storage
     */
    async loadCategoryData() {
        try {
            const result = await chrome.storage.sync.get('categoryData');
            return result.categoryData || {};
        } catch (error) {
            this.logger.error('Error loading category data:', error);
            return {};
        }
    }
}

// ============================================================================
// LOCATION AUTO FILLER
// ============================================================================

class LocationAutoFiller {
    constructor(logger, fieldFiller) {
        this.logger = logger;
        this.fieldFiller = fieldFiller;
    }

    /**
     * Auto-fill location fields (simplified to one field)
     */
    async fillLocation() {
        try {
            const locationData = await this.loadLocationData();
            if (!locationData || Object.keys(locationData).length === 0) {
                this.logger.info('No location data available');
                return;
            }

            this.logger.info('Starting location filling...');
            
            // Create combined location string
            const locationParts = [];
            if (locationData.city) locationParts.push(locationData.city);
            if (locationData.state) locationParts.push(locationData.state);
            if (locationData.country) locationParts.push(locationData.country);
            
            const combinedLocation = locationParts.join(', ');
            
            if (combinedLocation) {
                await this.fillLocationField('location', combinedLocation, CONTENT_CONFIG.SELECTORS.LOCATION);
            }
            
            this.logger.info('Location filling completed');
        } catch (error) {
            this.logger.error('Error filling location:', error);
        }
    }

    /**
     * Fill specific location field
     */
    async fillLocationField(fieldType, value, selectors) {
        if (!value) return;
        
        const fields = [];
        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.tagName === 'SELECT' && !element.disabled) {
                        fields.push(element);
                    }
                });
            } catch (error) {
                this.logger.debug(`Invalid location selector: ${selector}`);
            }
        });
        
        if (fields.length > 0) {
            for (const field of fields) {
                await this.selectLocationInDropdown(field, value, fieldType);
            }
        }
    }

    /**
     * Select location in dropdown
     */
    async selectLocationInDropdown(select, value, type) {
        if (!select || !value) return false;

        const options = Array.from(select.options);
        
        // Try exact match first
        let option = options.find(opt => 
            opt.value.toLowerCase() === value.toLowerCase() || 
            opt.textContent.toLowerCase() === value.toLowerCase()
        );
        
        if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.logger.debug(`Selected ${type}: ${value}`);
            return true;
        }
        
        // Try partial match
        option = options.find(opt => 
            opt.value.toLowerCase().includes(value.toLowerCase()) || 
            opt.textContent.toLowerCase().includes(value.toLowerCase())
        );
        
        if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.logger.debug(`Selected ${type} (partial): ${value}`);
            return true;
        }
        
        return false;
    }

    /**
     * Load location data from storage
     */
    async loadLocationData() {
        try {
            const result = await chrome.storage.sync.get('locationData');
            return result.locationData || {};
        } catch (error) {
            this.logger.error('Error loading location data:', error);
            return {};
        }
    }
}

// ============================================================================
// MAIN CONTENT SCRIPT
// ============================================================================

class ContentScript {
    constructor() {
        this.logger = new ContentLogger('ContentScript');
        this.fieldDetector = new FieldDetector(this.logger);
        this.fieldFiller = new FieldFiller(this.logger);
        this.universalFormFiller = new UniversalFormFiller(this.logger, this.fieldDetector, this.fieldFiller);
        this.socialMediaFiller = new SocialMediaFiller(this.logger, this.fieldDetector, this.fieldFiller);
        this.passwordFiller = new PasswordFiller(this.logger, this.fieldDetector, this.fieldFiller);
        this.categoryAutoSelector = new CategoryAutoSelector(this.logger, this.fieldFiller);
        this.locationAutoFiller = new LocationAutoFiller(this.logger, this.fieldFiller);
        
        this.isInitialized = false;
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
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.performAutoFill());
            } else {
                this.performAutoFill();
            }
            
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
            this.logger.debug('Received message:', message);
            
            switch (message.action) {
                case 'fillUniversalForms':
                    this.universalFormFiller.fillAllForms().then(() => {
                        sendResponse({ success: true });
                    });
                    return true; // Keep message channel open for async response
                    
                case 'fillSocialMedia':
                    this.socialMediaFiller.fillSocialMedia().then(() => {
                        sendResponse({ success: true });
                    });
                    return true;
                    
                case 'fillPasswords':
                    this.passwordFiller.fillPasswords().then(() => {
                        sendResponse({ success: true });
                    });
                    return true;
                    
                case 'selectCategories':
                    this.categoryAutoSelector.selectCategories().then(() => {
                        sendResponse({ success: true });
                    });
                    return true;
                    
                case 'fillLocation':
                    this.locationAutoFiller.fillLocation().then(() => {
                        sendResponse({ success: true });
                    });
                    return true;
                    
                case 'fillAll':
                    this.performAutoFill().then(() => {
                        sendResponse({ success: true });
                    });
                    return true;
                    
                case 'updateSettings':
                    this.updateSettings(message.settings);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    }

    /**
     * Update settings
     */
    updateSettings(settings) {
        if (settings) {
            this.logger.info('Settings updated:', Object.keys(settings));
            // Update log level if provided
            if (settings.logLevel) {
                this.logger.logLevel = settings.logLevel;
            }
        }
    }

    /**
     * Perform all auto-fill operations
     */
    async performAutoFill() {
        try {
            this.logger.info('Starting auto-fill operations...');
            
            // Fill all form types
            await this.universalFormFiller.fillAllForms();
            await this.socialMediaFiller.fillSocialMedia();
            await this.passwordFiller.fillPasswords();
            await this.categoryAutoSelector.selectCategories();
            await this.locationAutoFiller.fillLocation();
            
            this.logger.info('Auto-fill operations completed');
        } catch (error) {
            this.logger.error('Error during auto-fill:', error);
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize content script
if (typeof window !== 'undefined') {
    window.contentScript = new ContentScript();
}

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ContentScript,
        ContentLogger,
        FieldDetector,
        FieldFiller,
        UniversalFormFiller,
        SocialMediaFiller,
        PasswordFiller,
        CategoryAutoSelector,
        LocationAutoFiller,
        CONTENT_CONFIG
    };
}
