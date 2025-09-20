/**
 * Universal Form Filler for Social Filler Pro Extension
 * 
 * This module provides:
 * - Universal form field detection and filling
 * - Social media field filling
 * - Password field filling
 * - Form validation and error handling
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

// ============================================================================
// UNIVERSAL FORM FILLER CLASS
// ============================================================================

class UniversalFormFiller {
    constructor(logger, fieldDetector, fieldFiller) {
        this.logger = logger;
        this.fieldDetector = fieldDetector;
        this.fieldFiller = fieldFiller;
        this.isEnabled = true;
        this.fillDelay = 100;
    }

    /**
     * Fill all forms on the page with stored data
     */
    async fillAllForms() {
        if (!this.isEnabled) {
            this.logger.debug('Universal form filling is disabled');
            return;
        }

        try {
            this.logger.info('Starting universal form filling process');
            
            // Load data from storage
            const [socialLinks, universalData, password] = await Promise.all([
                this.loadSocialLinks(),
                this.loadUniversalFormData(),
                this.loadPassword()
            ]);

            let totalFilled = 0;

            // Fill social media fields
            if (socialLinks && Object.keys(socialLinks).length > 0) {
                totalFilled += await this.fillSocialMediaFields(socialLinks);
            }

            // Fill universal form fields
            if (universalData && Object.keys(universalData).length > 0) {
                totalFilled += await this.fillUniversalFields(universalData);
            }

            // Fill password fields
            if (password) {
                totalFilled += await this.fillPasswordFields(password);
            }

            if (totalFilled > 0) {
                this.logger.info(`Successfully filled ${totalFilled} fields across all forms`);
            } else {
                this.logger.debug('No fields were filled - no matching forms or data found');
            }

        } catch (error) {
            this.logger.error('Error during universal form filling:', error);
        }
    }

    /**
     * Load social links from storage
     */
    async loadSocialLinks() {
        try {
            const result = await chrome.storage.sync.get('socialLinks');
            const socialLinks = result.socialLinks;
            
            if (Array.isArray(socialLinks)) {
                // Convert new array format to object format for compatibility
                const linksObject = {};
                socialLinks.forEach(link => {
                    if (link.isActive && link.url) {
                        linksObject[link.platform] = link.url;
                    }
                });
                return linksObject;
            }
            
            return socialLinks || {};
        } catch (error) {
            this.logger.error('Error loading social links:', error);
            return {};
        }
    }

    /**
     * Load universal form data from storage
     */
    async loadUniversalFormData() {
        try {
            const result = await chrome.storage.sync.get('universalFormData');
            return result.universalFormData || {};
        } catch (error) {
            this.logger.error('Error loading universal form data:', error);
            return {};
        }
    }

    /**
     * Load password from storage
     */
    async loadPassword() {
        try {
            const result = await chrome.storage.sync.get('fillPassword');
            return result.fillPassword || '';
        } catch (error) {
            this.logger.error('Error loading password:', error);
            return '';
        }
    }

    /**
     * Fill social media fields
     */
    async fillSocialMediaFields(socialLinks) {
        this.logger.info('Filling social media fields');
        
        const platformMappings = {
            facebook: CONTENT_CONFIG.SELECTORS.FACEBOOK,
            instagram: CONTENT_CONFIG.SELECTORS.INSTAGRAM,
            twitter: CONTENT_CONFIG.SELECTORS.TWITTER,
            youtube: CONTENT_CONFIG.SELECTORS.YOUTUBE,
            linkedin: CONTENT_CONFIG.SELECTORS.LINKEDIN,
            pinterest: CONTENT_CONFIG.SELECTORS.PINTEREST,
            tiktok: CONTENT_CONFIG.SELECTORS.TIKTOK,
            snapchat: CONTENT_CONFIG.SELECTORS.SNAPCHAT,
            website: CONTENT_CONFIG.SELECTORS.WEBSITE
        };

        let totalFilled = 0;

        for (const [platform, url] of Object.entries(socialLinks)) {
            if (!url || !platformMappings[platform]) continue;

            try {
                const fields = this.fieldDetector.findFields(platformMappings[platform], platform);
                const filled = await this.fieldFiller.fillFields(fields, url, platform);
                totalFilled += filled;

                if (filled > 0) {
                    this.logger.debug(`Filled ${filled} ${platform} field(s) with: ${url}`);
                }

                // Add delay between platforms
                await this.delay(this.fillDelay);

            } catch (error) {
                this.logger.error(`Error filling ${platform} fields:`, error);
            }
        }

        return totalFilled;
    }

    /**
     * Fill universal form fields
     */
    async fillUniversalFields(universalData) {
        this.logger.info('Filling universal form fields');
        
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

        for (const [fieldType, value] of Object.entries(universalData)) {
            if (!value || !fieldMappings[fieldType]) continue;

            try {
                const fields = this.fieldDetector.findFields(fieldMappings[fieldType], fieldType);
                const filled = await this.fieldFiller.fillFields(fields, value, fieldType);
                totalFilled += filled;

                if (filled > 0) {
                    this.logger.debug(`Filled ${filled} ${fieldType} field(s) with: ${value}`);
                }

                // Add delay between field types
                await this.delay(this.fillDelay);

            } catch (error) {
                this.logger.error(`Error filling ${fieldType} fields:`, error);
            }
        }

        return totalFilled;
    }

    /**
     * Fill password fields
     */
    async fillPasswordFields(password) {
        this.logger.info('Filling password fields');
        
        try {
            const fields = this.fieldDetector.findFields(CONTENT_CONFIG.SELECTORS.PASSWORD, 'password');
            const filled = await this.fieldFiller.fillFields(fields, password, 'password');
            
            if (filled > 0) {
                this.logger.debug(`Filled ${filled} password field(s)`);
            }
            
            return filled;
        } catch (error) {
            this.logger.error('Error filling password fields:', error);
            return 0;
        }
    }

    /**
     * Enable or disable universal form filling
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.logger.info(`Universal form filling ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set fill delay between fields
     */
    setFillDelay(delay) {
        this.fillDelay = Math.max(0, delay);
        this.logger.debug(`Fill delay set to ${this.fillDelay}ms`);
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            fillDelay: this.fillDelay,
            version: CONTENT_CONFIG.VERSION
        };
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================================
// FORM VALIDATION UTILITIES
// ============================================================================

class FormValidator {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Validate form data before filling
     */
    validateFormData(data) {
        const errors = [];
        const warnings = [];

        // Validate social links
        if (data.socialLinks) {
            for (const [platform, url] of Object.entries(data.socialLinks)) {
                if (!this.isValidUrl(url)) {
                    errors.push(`Invalid ${platform} URL: ${url}`);
                }
            }
        }

        // Validate universal form data
        if (data.universalData) {
            if (data.universalData.email && !this.isValidEmail(data.universalData.email)) {
                errors.push(`Invalid email: ${data.universalData.email}`);
            }

            if (data.universalData.phone && !this.isValidPhone(data.universalData.phone)) {
                warnings.push(`Phone number format may be invalid: ${data.universalData.phone}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate URL format
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone format (basic validation)
     */
    isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize universal form filler when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait for main content script to initialize
        setTimeout(() => {
            if (window.contentScript && window.contentScript.logger) {
                window.universalFormFiller = new UniversalFormFiller(
                    window.contentScript.logger,
                    window.contentScript.fieldDetector,
                    window.contentScript.fieldFiller
                );
                window.formValidator = new FormValidator(window.contentScript.logger);
            }
        }, 1000);
    });
} else {
    // DOM already loaded
    setTimeout(() => {
        if (window.contentScript && window.contentScript.logger) {
            window.universalFormFiller = new UniversalFormFiller(
                window.contentScript.logger,
                window.contentScript.fieldDetector,
                window.contentScript.fieldFiller
            );
            window.formValidator = new FormValidator(window.contentScript.logger);
        }
    }, 1000);
}

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        UniversalFormFiller,
        FormValidator
    };
}
