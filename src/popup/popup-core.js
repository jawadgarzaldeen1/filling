/**
 * popup-core.js
 * Social Filler Pro - Popup Core
 * ESM-ready for Chrome MV3
 */

import { EXTENSION_CONFIG } from '../common/config.js';

// ============================================================================
// UTILITY CLASSES
// ============================================================================

class PopupLogger {
    // ... (implementation remains the same)
}

class PopupUtils {
    // ... (implementation remains the same, but we will fix generateId)
    static generateId() {
        return crypto.randomUUID();
    }
    // ... rest of the class ...
}


// ============================================================================
// UNIVERSAL MODULES (These need to be defined before PopupInitializer uses them)
// ============================================================================

class UniversalFormManager {
    constructor(logger) {
        this.logger = logger;
        this.universalFormData = {};
    }

    async loadUniversalFormData() {
        try {
            const result = await chrome.storage.sync.get('universalFormData');
            this.universalFormData = result.universalFormData || {};
            this.logger.debug('Universal form data loaded:', Object.keys(this.universalFormData).length);
            return this.universalFormData;
        } catch (error) {
            this.logger.error('Error loading universal form data:', error);
            return {};
        }
    }

    async saveUniversalFormData() {
        try {
            await chrome.storage.sync.set({ universalFormData: this.universalFormData });
            this.logger.debug('Universal form data saved successfully');
            return true;
        } catch (error) {
            this.logger.error('Error saving universal form data:', error);
            throw error;
        }
    }

    async loadUniversalFormUI() {
        try {
            await this.loadUniversalFormData();
            const fieldMappings = {
                title: 'universal-title',
                company: 'universal-company',
                email: 'universal-email',
                phone: 'universal-phone',
                address: 'universal-address',
                city: 'universal-city',
                state: 'universal-state',
                zipcode: 'universal-zipcode',
                website: 'universal-website',
                description: 'universal-description',
                keywords: 'universal-keywords'
            };

            Object.entries(fieldMappings).forEach(([dataKey, fieldId]) => {
                const field = document.getElementById(fieldId);
                if (field && this.universalFormData[dataKey]) field.value = this.universalFormData[dataKey];
            });

            this.logger.debug('Universal form UI loaded');
        } catch (error) {
            this.logger.error('Error loading universal form UI:', error);
        }
    }

    async saveUniversalFormFromUI() {
        try {
            const fieldMappings = {
                title: 'universal-title',
                company: 'universal-company',
                email: 'universal-email',
                phone: 'universal-phone',
                address: 'universal-address',
                city: 'universal-city',
                state: 'universal-state',
                zipcode: 'universal-zipcode',
                website: 'universal-website',
                description: 'universal-description',
                keywords: 'universal-keywords'
            };

            Object.entries(fieldMappings).forEach(([dataKey, fieldId]) => {
                const field = document.getElementById(fieldId);
                if (field) {
                    const value = field.value.trim();
                    if (value) this.universalFormData[dataKey] = value;
                    else delete this.universalFormData[dataKey];
                }
            });

            await this.saveUniversalFormData();
            this.logger.info('Universal form data saved from UI');
            return true;
        } catch (error) {
            this.logger.error('Error saving universal form from UI:', error);
            throw error;
        }
    }
}

class GoogleSheetsParser {
    // ... (implementation remains the same)
}

class GoogleSheetsImporter {
    constructor(logger, universalFormManager, socialLinksManager) {
        this.logger = logger;
        this.universalFormManager = universalFormManager;
        this.socialLinksManager = socialLinksManager;
        this.parser = new GoogleSheetsParser(logger);
    }
    // ... (implementation remains the same)
}


// ============================================================================
// SERVICE MANAGEMENT & OTHER MANAGERS
// ============================================================================

class ServiceManager {
    // ... (implementation remains the same)
}

class SocialLinksManager {
    // ... (implementation remains the same)
}

class PasswordManager {
    // ... (implementation remains the same)
}

class CategoryManager {
    // ... (implementation remains the same)
}

class LocationManager {
    // ... (implementation remains the same)
}

class ResetManager {
    // ... (implementation remains the same)
}

class EventManager {
    // ... (implementation remains the same)
}


// ============================================================================
// POPUP INITIALIZER (The main class)
// ============================================================================

class PopupInitializer {
    constructor() {
        this.logger = new PopupLogger('PopupInitializer');
        this.serviceManager = new ServiceManager(this.logger);
        this.socialLinksManager = new SocialLinksManager(this.logger);
        this.passwordManager = new PasswordManager(this.logger);
        this.categoryManager = new CategoryManager(this.logger);
        this.locationManager = new LocationManager(this.logger);
        
        // Universal managers are now defined, so this is safe
        this.universalFormManager = new UniversalFormManager(this.logger);
        this.googleSheetsImporter = new GoogleSheetsImporter(
            this.logger,
            this.universalFormManager,
            this.socialLinksManager
        );

        this.resetManager = new ResetManager(
            this.logger,
            this.serviceManager,
            this.socialLinksManager,
            this.passwordManager
        );
        this.eventManager = new EventManager(
            this.logger,
            this.serviceManager,
            this.socialLinksManager,
            this.passwordManager,
            this.categoryManager,
            this.locationManager,
            this.resetManager
        );
    }

    async initialize() {
        try {
            // REMOVED: this.setupSettingsButton(); - This method did not exist
            this.logger.info(`Initializing Social Filler Pro Popup v${EXTENSION_CONFIG.VERSION}`);
            await this.loadAllData();
            this.eventManager.setupEventListeners();
            await this.loadUI();
            if (this.googleSheetsImporter) {
                try {
                    this.googleSheetsImporter.setupGoogleSheetsImport();
                    this.logger.debug('Google Sheets import initialized');
                } catch (error) {
                    this.logger.warn('Failed to initialize Google Sheets import:', error);
                }
            }
            this.logger.info('Popup initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize popup:', error);
            PopupUtils.showStatus('Failed to initialize popup', 'error');
        }
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.serviceManager.loadServices(),
                this.socialLinksManager.loadSocialLinks(),
                this.passwordManager.loadPassword(),
                this.categoryManager.loadCategory(),
                this.locationManager.updateLocation(),
                this.universalFormManager.loadUniversalFormData()
            ]);
            this.logger.debug('All data loaded successfully');
        } catch (error) {
            this.logger.error('Error loading data:', error);
        }
    }

    async loadUI() {
        try {
            await this.eventManager.loadSocialLinksUI();
            const password = await this.passwordManager.loadPassword();
            const passwordField = document.getElementById('passwordValue');
            if (passwordField) passwordField.value = password;
            await this.loadUniversalFormData();
            this.logger.debug('UI loaded successfully');
        } catch (error) {
            this.logger.error('Error loading UI:', error);
        }
    }

    async loadUniversalFormData() {
        try {
            const result = await chrome.storage.sync.get('universalFormData');
            const universalData = result.universalFormData || {};
            const fieldMappings = {
                'universal-title': 'title',
                'universal-company': 'company',
                'universal-email': 'email',
                'universal-phone': 'phone',
                'universal-address': 'address',
                'universal-city': 'city',
                'universal-state': 'state',
                'universal-zipcode': 'zipcode',
                'universal-website': 'website',
                'universal-keywords': 'keywords',
                'universal-description': 'description'
            };

            Object.entries(fieldMappings).forEach(([fieldId, dataKey]) => {
                const field = document.getElementById(fieldId);
                if (field && universalData[dataKey]) field.value = universalData[dataKey];
            });

            this.logger.debug('Universal form data loaded into UI');
        } catch (error) {
            this.logger.error('Error loading universal form data:', error);
        }
    }
}

// REMOVED: Redundant DOMContentLoaded listener and window assignments.
// The initialization is now correctly handled by popup-init.js.

// ============================================================================
// ESM EXPORTS
// ============================================================================

export { PopupInitializer };
