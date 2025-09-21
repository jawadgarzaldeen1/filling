/**
 * popup-core.js
 * Social Filler Pro - Popup Core (Merged, full)
 * ESM-ready for Chrome MV3
 *
 * Contains:
 * - POPUP_CONFIG
 * - PopupLogger, PopupUtils
 * - ServiceManager, SocialLinksManager, PasswordManager, CategoryManager, LocationManager
 * - ResetManager, EventManager
 * - PopupInitializer, PopupManager (light UI wrapper)
 * - UniversalFormManager, GoogleSheetsParser, GoogleSheetsImporter, IntegrationHelper
 *
 * No CommonJS exports. Use ESM import.
 */

// ============================================================================
// CONFIG
// ============================================================================

const POPUP_CONFIG = {
    VERSION: '7.0',
    STORAGE_KEYS: {
        SERVICES: 'services',
        SOCIAL_LINKS: 'socialLinks',
        PASSWORD: 'fillPassword',
        SELECTED_CATEGORY: 'selectedCategory',
        SELECTED_LOCATION: 'selectedLocation',
        SETTINGS: 'settings',
        UNIVERSAL: 'universalFormData'
    },
    DEFAULT_SERVICES: {
        facebook: { enabled: true, priority: 1 },
        instagram: { enabled: true, priority: 2 },
        twitter: { enabled: true, priority: 3 },
        youtube: { enabled: true, priority: 4 },
        linkedin: { enabled: true, priority: 5 },
        pinterest: { enabled: true, priority: 6 },
        tiktok: { enabled: true, priority: 7 },
        snapchat: { enabled: true, priority: 8 },
        website: { enabled: true, priority: 9 }
    },
    MESSAGE_TYPES: {
        CATEGORY_UPDATED: 'CATEGORY_UPDATED',
        LOCATION_UPDATED: 'LOCATION_UPDATED'
    }
};

// ============================================================================
// UTILITY CLASSES
// ============================================================================

class PopupLogger {
    constructor(context = 'Popup') {
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
                default:
                    console.log(prefix, message, ...args);
            }
        }
    }

    error(message, ...args) { this.log(0, message, ...args); }
    warn(message, ...args) { this.log(1, message, ...args); }
    info(message, ...args) { this.log(2, message, ...args); }
    debug(message, ...args) { this.log(3, message, ...args); }
}

class PopupUtils {
    static showStatus(message, type = 'info', duration = 3000) {
        try {
            let statusElement = document.getElementById('statusMessage');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'statusMessage';
                statusElement.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    padding: 10px 15px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    z-index: 10000;
                    max-width: 300px;
                    word-wrap: break-word;
                    transition: all 0.3s ease;
                `;
                document.body.appendChild(statusElement);
            }

            statusElement.textContent = message;
            statusElement.style.display = 'block';

            const colors = {
                success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
                error: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
                warning: { bg: '#fff3cd', color: '#856404', border: '#ffeaa7' },
                info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
            };

            const style = colors[type] || colors.info;
            statusElement.style.backgroundColor = style.bg;
            statusElement.style.color = style.color;
            statusElement.style.border = `1px solid ${style.border}`;

            setTimeout(() => {
                if (statusElement) statusElement.style.display = 'none';
            }, duration);

        } catch (error) {
            console.error('Error showing status message:', error);
        }
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static normalizeUrl(url) {
        if (!url) return '';
        url = url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return url;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// ============================================================================
// SERVICE MANAGEMENT
// ============================================================================

class ServiceManager {
    constructor(logger) {
        this.logger = logger;
        this.services = {};
    }

    async loadServices() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SERVICES);
            this.services = result[POPUP_CONFIG.STORAGE_KEYS.SERVICES] || POPUP_CONFIG.DEFAULT_SERVICES;
            this.logger.debug('Services loaded:', Object.keys(this.services).length);
            return this.services;
        } catch (error) {
            this.logger.error('Error loading services:', error);
            this.services = POPUP_CONFIG.DEFAULT_SERVICES;
            return this.services;
        }
    }

    async saveServices() {
        try {
            await chrome.storage.sync.set({
                [POPUP_CONFIG.STORAGE_KEYS.SERVICES]: this.services
            });
            this.logger.debug('Services saved successfully');
            return true;
        } catch (error) {
            this.logger.error('Error saving services:', error);
            throw error;
        }
    }

    async toggleService(serviceName) {
        try {
            if (this.services[serviceName]) {
                this.services[serviceName].enabled = !this.services[serviceName].enabled;
                await this.saveServices();
                this.logger.info(`Service ${serviceName} ${this.services[serviceName].enabled ? 'enabled' : 'disabled'}`);
                return this.services[serviceName].enabled;
            }
            return false;
        } catch (error) {
            this.logger.error(`Error toggling service ${serviceName}:`, error);
            throw error;
        }
    }

    async resetToDefault() {
        try {
            this.services = { ...POPUP_CONFIG.DEFAULT_SERVICES };
            await this.saveServices();
            this.logger.info('Services reset to default');
            return true;
        } catch (error) {
            this.logger.error('Error resetting services:', error);
            throw error;
        }
    }

    getEnabledServices() {
        return Object.entries(this.services)
            .filter(([_, config]) => config.enabled)
            .map(([name]) => name);
    }
}

// ============================================================================
// SOCIAL LINKS MANAGEMENT
// ============================================================================

class SocialLinksManager {
    constructor(logger) {
        this.logger = logger;
        this.socialLinks = [];
    }

    async loadSocialLinks() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SOCIAL_LINKS);
            const links = result[POPUP_CONFIG.STORAGE_KEYS.SOCIAL_LINKS];
            
            if (Array.isArray(links)) {
                this.socialLinks = links;
            } else if (links && typeof links === 'object') {
                this.socialLinks = Object.entries(links).map(([platform, url]) => ({
                    id: PopupUtils.generateId(),
                    platform: platform.toLowerCase(),
                    url: url,
                    addedAt: Date.now(),
                    isActive: true
                }));
                await this.saveSocialLinks();
                this.logger.info(`Migrated ${this.socialLinks.length} social links to new format`);
            } else {
                this.socialLinks = [];
            }
            
            this.logger.debug('Social links loaded:', this.socialLinks.length);
            return this.socialLinks;
        } catch (error) {
            this.logger.error('Error loading social links:', error);
            this.socialLinks = [];
            return this.socialLinks;
        }
    }

    async saveSocialLinks() {
        try {
            await chrome.storage.sync.set({
                [POPUP_CONFIG.STORAGE_KEYS.SOCIAL_LINKS]: this.socialLinks
            });
            this.logger.debug('Social links saved successfully');
            return true;
        } catch (error) {
            this.logger.error('Error saving social links:', error);
            throw error;
        }
    }

    async addSocialLink(platform, url) {
        try {
            const duplicate = this.socialLinks.find(link => 
                link.platform.toLowerCase() === platform.toLowerCase() || 
                link.url === url
            );
            
            if (duplicate) {
                throw new Error(`Duplicate found: ${duplicate.platform} with URL ${duplicate.url}`);
            }

            const newLink = {
                id: PopupUtils.generateId(),
                platform: platform.toLowerCase(),
                url: PopupUtils.normalizeUrl(url),
                addedAt: Date.now(),
                isActive: true
            };

            this.socialLinks.push(newLink);
            await this.saveSocialLinks();
            this.logger.info(`Added social link: ${platform} - ${url}`);
            return newLink;
        } catch (error) {
            this.logger.error('Error adding social link:', error);
            throw error;
        }
    }

    async updateSocialLink(id, updates) {
        try {
            const index = this.socialLinks.findIndex(link => link.id === id);
            if (index === -1) {
                throw new Error('Social link not found');
            }

            if (updates.platform || updates.url) {
                const duplicate = this.socialLinks.find(link => 
                    link.id !== id && (
                        (updates.platform && link.platform.toLowerCase() === updates.platform.toLowerCase()) ||
                        (updates.url && link.url === updates.url)
                    )
                );
                
                if (duplicate) {
                    throw new Error(`Duplicate found: ${duplicate.platform} with URL ${duplicate.url}`);
                }
            }

            this.socialLinks[index] = { ...this.socialLinks[index], ...updates, updatedAt: Date.now() };
            await this.saveSocialLinks();
            this.logger.info(`Updated social link: ${id}`);
            return this.socialLinks[index];
        } catch (error) {
            this.logger.error('Error updating social link:', error);
            throw error;
        }
    }

    async deleteSocialLink(id) {
        try {
            const index = this.socialLinks.findIndex(link => link.id === id);
            if (index === -1) {
                throw new Error('Social link not found');
            }

            const deletedLink = this.socialLinks.splice(index, 1)[0];
            await this.saveSocialLinks();
            this.logger.info(`Deleted social link: ${deletedLink.platform} - ${deletedLink.url}`);
            return true;
        } catch (error) {
            this.logger.error('Error deleting social link:', error);
            throw error;
        }
    }

    validateSocialLink(platform, url) {
        const errors = [];
        
        if (!platform || platform.trim().length === 0) {
            errors.push('Platform is required');
        }
        
        if (!url || url.trim().length === 0) {
            errors.push('URL is required');
        } else {
            const normalizedUrl = PopupUtils.normalizeUrl(url);
            if (!PopupUtils.isValidUrl(normalizedUrl)) {
                errors.push('Invalid URL format');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    async removeSocialLink(linkId) {
        return this.deleteSocialLink(linkId);
    }

    async resetToDefault() {
        try {
            this.socialLinks = [];
            await this.saveSocialLinks();
            this.logger.debug('Reset social links to default');
        } catch (error) {
            this.logger.error('Error resetting social links:', error);
            throw error;
        }
    }

    getSocialLinksAsObject() {
        const linksObject = {};
        this.socialLinks.forEach(link => {
            if (link.isActive && link.url) {
                linksObject[link.platform] = link.url;
            }
        });
        return linksObject;
    }
}

// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================

class PasswordManager {
    constructor(logger) {
        this.logger = logger;
    }

    async loadPassword() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.PASSWORD);
            return result[POPUP_CONFIG.STORAGE_KEYS.PASSWORD] || '';
        } catch (error) {
            this.logger.error('Error loading password:', error);
            return '';
        }
    }

    async savePassword(password) {
        try {
            await chrome.storage.sync.set({
                [POPUP_CONFIG.STORAGE_KEYS.PASSWORD]: password
            });
            this.logger.debug('Password saved successfully');
            return true;
        } catch (error) {
            this.logger.error('Error saving password:', error);
            throw error;
        }
    }

    async clearPassword() {
        try {
            await chrome.storage.sync.remove(POPUP_CONFIG.STORAGE_KEYS.PASSWORD);
            this.logger.info('Password cleared');
            return true;
        } catch (error) {
            this.logger.error('Error clearing password:', error);
            throw error;
        }
    }
}

// ============================================================================
// CATEGORY MANAGEMENT
// ============================================================================

class CategoryManager {
    constructor(logger) {
        this.logger = logger;
    }

    async loadCategory() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY);
            const category = result[POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY] || '';
            
            const categoryInput = document.getElementById('categoryValue');
            if (categoryInput) {
                categoryInput.value = category;
            }
            
            this.logger.debug('Category loaded:', category);
            return category;
        } catch (error) {
            this.logger.error('Error loading category:', error);
            return '';
        }
    }

    async saveCategory() {
        try {
            const categoryInput = document.getElementById('categoryValue');
            if (!categoryInput) {
                throw new Error('Category input not found');
            }
            
            const category = categoryInput.value.trim();
            if (!category) {
                PopupUtils.showStatus('Please enter a category', 'error');
                return false;
            }

            await chrome.storage.sync.set({
                [POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY]: category
            });
            
            PopupUtils.showStatus(`Category "${category}" saved successfully`);
            this.logger.info('Category saved:', category);
            
            await this.notifyContentScripts(POPUP_CONFIG.MESSAGE_TYPES.CATEGORY_UPDATED, { category });
            
            return true;
        } catch (error) {
            this.logger.error('Error saving category:', error);
            PopupUtils.showStatus('Failed to save category', 'error');
            return false;
        }
    }

    clearCategoryForm() {
        const categoryInput = document.getElementById('categoryValue');
        if (categoryInput) categoryInput.value = '';
    }

    async getSelectedCategory() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY);
            return result[POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY] || null;
        } catch (error) {
            this.logger.error('Error getting selected category:', error);
            return null;
        }
    }

    async notifyContentScripts(messageType, data) {
        try {
            const tabs = await chrome.tabs.query({});
            const notifications = tabs.map(tab => {
                if (tab.id) {
                    return chrome.tabs.sendMessage(tab.id, {
                        type: messageType,
                        ...data
                    }).catch(() => {});
                }
            });
            await Promise.allSettled(notifications);
            this.logger.debug('Notified content scripts about category update');
        } catch (error) {
            this.logger.warn('Could not notify content scripts:', error);
        }
    }
}

// ============================================================================
// LOCATION MANAGEMENT
// ============================================================================

class LocationManager {
    constructor(logger) {
        this.logger = logger;
    }

    async loadLocation() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION);
            const locationData = result[POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION] || {};
            
            const countrySelect = document.getElementById('countryValue');
            if (countrySelect) countrySelect.value = locationData.country || '';
            const regionInput = document.getElementById('regionValue');
            if (regionInput) regionInput.value = locationData.region || '';
            const cityInput = document.getElementById('cityValue');
            if (cityInput) cityInput.value = locationData.city || '';
            const addressInput = document.getElementById('addressValue');
            if (addressInput) addressInput.value = locationData.address || '';
            
            this.logger.debug('Location loaded:', locationData);
            return locationData;
        } catch (error) {
            this.logger.error('Error loading location:', error);
            return {};
        }
    }

    async updateLocation() {
        try {
            if (window.LocationManager && typeof window.LocationManager.updateLocation === 'function') {
                const loc = await window.LocationManager.updateLocation();
                if (loc) {
                    const countrySelect = document.getElementById('countryValue');
                    if (countrySelect && loc.country) countrySelect.value = loc.country;
                    const regionInput = document.getElementById('regionValue');
                    if (regionInput && loc.region) regionInput.value = loc.region;
                    const cityInput = document.getElementById('cityValue');
                    if (cityInput && loc.city) cityInput.value = loc.city;
                    const addressInput = document.getElementById('addressValue');
                    if (addressInput && loc.address) addressInput.value = loc.address;
                }
                this.logger.debug('updateLocation via window.LocationManager result:', loc);
                return loc;
            }
            return await this.loadLocation();
        } catch (error) {
            this.logger.error('Error updating location:', error);
            return {};
        }
    }

    async saveLocation() {
        try {
            const country = document.getElementById('countryValue')?.value || '';
            const region = document.getElementById('regionValue')?.value?.trim() || '';
            const city = document.getElementById('cityValue')?.value?.trim() || '';
            const address = document.getElementById('addressValue')?.value?.trim() || '';
            
            if (!country && !region && !city && !address) {
                PopupUtils.showStatus('Please enter at least one location field', 'error');
                return false;
            }

            const locationData = { country, region, city, address };
            await chrome.storage.sync.set({
                [POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION]: locationData
            });
            
            const filledFields = Object.values(locationData).filter(v => v).length;
            PopupUtils.showStatus(`Location saved successfully (${filledFields} fields)`);
            this.logger.info('Location saved:', locationData);
            await this.notifyContentScripts(POPUP_CONFIG.MESSAGE_TYPES.LOCATION_UPDATED, { location: locationData });
            return true;
        } catch (error) {
            this.logger.error('Error saving location:', error);
            PopupUtils.showStatus('Failed to save location', 'error');
            return false;
        }
    }

    clearLocationForm() {
        const fields = ['countryValue', 'regionValue', 'cityValue', 'addressValue'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = '';
        });
    }

    async getSelectedLocation() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION);
            return result[POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION] || null;
        } catch (error) {
            this.logger.error('Error getting selected location:', error);
            return null;
        }
    }

    async notifyContentScripts(messageType, data) {
        try {
            const tabs = await chrome.tabs.query({});
            const notifications = tabs.map(tab => {
                if (tab.id) {
                    return chrome.tabs.sendMessage(tab.id, {
                        type: messageType,
                        ...data
                    }).catch(() => {});
                }
            });
            await Promise.allSettled(notifications);
            this.logger.debug('Notified content scripts about location update');
        } catch (error) {
            this.logger.warn('Could not notify content scripts:', error);
        }
    }
}

// ============================================================================
// RESET MANAGEMENT
// ============================================================================

class ResetManager {
    constructor(logger, serviceManager, socialLinksManager, passwordManager) {
        this.logger = logger;
        this.serviceManager = serviceManager;
        this.socialLinksManager = socialLinksManager;
        this.passwordManager = passwordManager;
    }

    async resetAll() {
        try {
            if (!confirm('Are you sure you want to reset all data? This cannot be undone!')) return false;
            this.logger.info('Resetting all data to defaults');
            await this.serviceManager.resetToDefault();
            this.socialLinksManager.socialLinks = [];
            await this.socialLinksManager.saveSocialLinks();
            await this.passwordManager.clearPassword();
            await chrome.storage.sync.remove(POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY);
            await chrome.storage.sync.remove(POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION);
            PopupUtils.showStatus('All data reset to defaults', 'success');
            this.logger.info('All data reset successfully');
            setTimeout(() => window.location.reload(), 1000);
            return true;
        } catch (error) {
            this.logger.error('Error resetting all data:', error);
            PopupUtils.showStatus('Failed to reset data', 'error');
            return false;
        }
    }
}

// ============================================================================
// EVENT MANAGEMENT
// ============================================================================

class EventManager {
    constructor(logger, serviceManager, socialLinksManager, passwordManager, categoryManager, locationManager, resetManager) {
        this.logger = logger;
        this.serviceManager = serviceManager;
        this.socialLinksManager = socialLinksManager;
        this.passwordManager = passwordManager;
        this.categoryManager = categoryManager;
        this.locationManager = locationManager;
        this.resetManager = resetManager;

        this.handleImportClick = this.handleImportClick.bind(this);
        this.handleClearImportClick = this.handleClearImportClick.bind(this);
        this.handleImportDataInput = this.handleImportDataInput.bind(this);
    };

    async handleImportClick() {
        if (!window.googleSheetsImporter) {
            this.logger.error('Google Sheets importer not available');
            return;
        }

        const importButton = document.getElementById('importSheetsData');
        const importTextarea = document.getElementById('sheetsImportData');
        
        if (!importTextarea || !importButton) return;

        const rawData = importTextarea.value.trim();
        if (!rawData) {
            PopupUtils.showStatus('Please paste your Google Sheets data first', 'error');
            return;
        }

        try {
            importButton.disabled = true;
            importButton.innerHTML = '⏳ Importing...';
            importButton.style.background = '#ff9800';

            await window.googleSheetsImporter.importGoogleSheetsData(rawData);
            
            importTextarea.value = '';
            
            importButton.disabled = false;
            importButton.innerHTML = '📥 Import & Fill All Data';
            importButton.style.background = '#4CAF50';
            
        } catch (error) {
            this.logger.error('Import failed:', error);
            PopupUtils.showStatus(`Import failed: ${error.message}`, 'error');
            importButton.disabled = false;
            importButton.innerHTML = '📥 Import & Fill All Data';
            importButton.style.background = '#4CAF50';
        }
    };

    handleClearImportClick() {
        const importTextarea = document.getElementById('sheetsImportData');
        if (importTextarea) {
            importTextarea.value = '';
            PopupUtils.showStatus('Import box cleared');
        }
    };

    handleImportDataInput(value) {
        const importStatus = document.getElementById('importStatus');
        if (!importStatus) return;

        if (value) {
            const hasLabels = /(\*\*.*?\*\*|Phone #|Website:|Email:)/i.test(value);
            importStatus.style.display = 'block';
            
            if (hasLabels) {
                importStatus.textContent = '✅ Data format looks good!';
                importStatus.className = 'import-status success';
            } else {
                importStatus.textContent = '⚠️ Make sure your data includes field labels like "**Business name:**"';
                importStatus.className = 'import-status warning';
            }
        } else {
            importStatus.style.display = 'none';
        }
    }

    setupGlobalEventHandlers = () => {
        document.addEventListener('click', (e) => this.handleGlobalClick(e));
        document.addEventListener('input', (e) => this.handleGlobalInput(e));
        document.addEventListener('change', (e) => this.handleGlobalChange(e));
        this.logger.debug('Global event handlers initialized');
    };

    handleGlobalClick = (e) => {
        const target = e.target;

        switch (target.id) {
            case 'addPlatformBtn':
                this.showAddPlatformModal();
                break;
            case 'resetPlatformsBtn':
                this.resetPlatforms();
                break;
            case 'importSheetsData':
                this.handleImportClick();
                break;
            case 'clearImportData':
                this.handleClearImportClick();
                break;
        }

        if (target.classList && target.classList.contains('toggle-platform')) {
            this.togglePlatform(target.dataset.platform);
        } else if (target.classList && target.classList.contains('remove-platform')) {
            this.removePlatform(target.dataset.platform);
        }
    };

    handleGlobalInput = (e) => {
        const target = e.target;

        if (target.classList && target.classList.contains('platform-url-input')) {
            this.handlePlatformUrlChange(target.dataset.platform, target.value.trim());
        } else if (target.id === 'sheetsImportData') {
            this.handleImportDataInput(target.value.trim());
        }
    };

    handleGlobalChange = (e) => {
        const target = e.target;

        if (target.tagName === 'SELECT') {
            this.handleSelectChange(target);
        }
    };

    setupEventListeners = () => {
        try {
            this.logger.debug('Setting up event listeners');
            this.setupGlobalEventHandlers();
            
            const saveButton = document.getElementById('saveButton');
            if (saveButton) saveButton.addEventListener('click', () => this.handleSave());

            const settingsButton = document.getElementById('settingsButton');
            if (settingsButton) settingsButton.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
            });

            const resetButton = document.getElementById('resetButton');
            if (resetButton) resetButton.addEventListener('click', () => this.resetManager.resetAll());

            const saveCategoryButton = document.getElementById('saveCategory');
            if (saveCategoryButton) saveCategoryButton.addEventListener('click', () => this.categoryManager.saveCategory());

            const saveLocationButton = document.getElementById('saveLocation');
            if (saveLocationButton) saveLocationButton.addEventListener('click', () => this.locationManager.saveLocation());

            const saveUniversalDataButton = document.getElementById('saveUniversalData');
            if (saveUniversalDataButton) saveUniversalDataButton.addEventListener('click', () => this.saveUniversalData());

            const togglePasswordButton = document.getElementById('togglePassword');
            if (togglePasswordButton) togglePasswordButton.addEventListener('click', () => this.togglePasswordVisibility());

            this.setupSocialLinkEventListeners();
            this.logger.debug('Event listeners setup complete');
        } catch (error) {
            this.logger.error('Error setting up event listeners:', error);
        }
    };

    setupSocialLinkEventListeners = () => {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'addPlatformBtn') this.showAddPlatformModal();
        });

        document.addEventListener('click', (e) => {
            if (e.target.id === 'resetPlatformsBtn') this.resetPlatforms();
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('toggle-platform')) {
                const platform = e.target.dataset.platform;
                this.togglePlatform(platform);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('remove-platform')) {
                const platform = e.target.dataset.platform;
                this.removePlatform(platform);
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.classList && e.target.classList.contains('platform-url-input')) {
                const platform = e.target.dataset.platform;
                const url = e.target.value.trim();
                this.handlePlatformUrlChange(platform, url);
            }
        });
    };

    showAddPlatformModal = () => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Add New Platform</h3>
                <div class="form-group">
                    <label>Platform Name</label>
                    <input type="text" id="newPlatformName" placeholder="Enter platform name">
                </div>
                <div class="form-group">
                    <label>Platform URL</label>
                    <input type="url" id="newPlatformUrl" placeholder="Enter platform URL">
                </div>
                <div class="modal-actions">
                    <button id="confirmAddPlatform" class="btn btn-primary">Add Platform</button>
                    <button id="cancelAddPlatform" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirmAddPlatform').addEventListener('click', () => {
            const name = document.getElementById('newPlatformName').value.trim();
            const url = document.getElementById('newPlatformUrl').value.trim();
            if (name && url) {
                this.addCustomPlatform(name, url);
                document.body.removeChild(modal);
            }
        });

        document.getElementById('cancelAddPlatform').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    };

    addCustomPlatform = async (name, url) => {
        try {
            const platform = name.toLowerCase().replace(/\s+/g, '-');
            await this.socialLinksManager.addSocialLink(platform, url);
            await this.renderPlatforms();
            PopupUtils.showStatus(`Added ${name} platform`, 'success');
        } catch (error) {
            PopupUtils.showStatus(`Failed to add platform: ${error.message}`, 'error');
        }
    };

    togglePlatform = async (platform) => {
        try {
            const platformDiv = document.querySelector(`[data-platform="${platform}"]`);
            if (!platformDiv) return;
            const input = platformDiv.querySelector('.platform-url-input');
            const toggleBtn = platformDiv.querySelector('.toggle-platform');
            const status = platformDiv.querySelector('.platform-status span');

            if (input.disabled) {
                input.disabled = false;
                input.focus();
                toggleBtn.textContent = '✅';
                status.textContent = 'Active';
                status.className = 'status-active';
                platformDiv.className = 'platform-item has-data';
            } else {
                input.disabled = true;
                input.value = '';
                toggleBtn.textContent = '⚪';
                status.textContent = 'Inactive';
                status.className = 'status-inactive';
                platformDiv.className = 'platform-item empty';
                const linkId = input.dataset.linkId;
                if (linkId) await this.socialLinksManager.removeSocialLink(linkId);
            }
        } catch (error) {
            PopupUtils.showStatus(`Failed to toggle platform: ${error.message}`, 'error');
        }
    };

    removePlatform = async (platform) => {
        if (!confirm(`Are you sure you want to remove ${platform}?`)) return;
        try {
            const platformDiv = document.querySelector(`[data-platform="${platform}"]`);
            if (!platformDiv) return;
            const input = platformDiv.querySelector('.platform-url-input');
            const linkId = input.dataset.linkId;
            
            if (linkId) await this.socialLinksManager.removeSocialLink(linkId);
            platformDiv.remove();
            PopupUtils.showStatus(`Removed ${platform} platform`, 'success');
        } catch (error) {
            PopupUtils.showStatus(`Failed to remove platform: ${error.message}`, 'error');
        }
    };

    handlePlatformUrlChange = async (platform, url) => {
        try {
            const platformDiv = document.querySelector(`[data-platform="${platform}"]`);
            if (!platformDiv) return;
            const input = platformDiv.querySelector('.platform-url-input');
            const linkId = input.dataset.linkId;

            if (url) {
                const validation = this.socialLinksManager.validateSocialLink(platform, url);
                if (!validation.isValid) {
                    PopupUtils.showStatus(`Invalid ${platform} URL: ${validation.errors.join(', ')}`, 'error');
                    return;
                }

                const normalizedUrl = PopupUtils.normalizeUrl(url);
                
                if (linkId) {
                    await this.socialLinksManager.updateSocialLink(linkId, { url: normalizedUrl });
                } else {
                    const newLink = await this.socialLinksManager.addSocialLink(platform, normalizedUrl);
                    input.dataset.linkId = newLink.id;
                }
            } else if (linkId) {
                await this.socialLinksManager.removeSocialLink(linkId);
                input.dataset.linkId = '';
            }
        } catch (error) {
            PopupUtils.showStatus(`Failed to update platform: ${error.message}`, 'error');
        }
    };

    resetPlatforms = async () => {
        if (!confirm('Are you sure you want to reset all platforms to default? This will remove all custom platforms.')) return;
        try {
            await this.socialLinksManager.resetToDefault();
            await this.renderPlatforms();
            PopupUtils.showStatus('Platforms reset to default', 'success');
        } catch (error) {
            PopupUtils.showStatus(`Failed to reset platforms: ${error.message}`, 'error');
        }
    };

    handleSave = async () => {
        try {
            this.logger.info('Handling save action');
            await this.saveSocialLinks();
            await this.savePassword();
            PopupUtils.showStatus('All changes saved successfully!', 'success');
        } catch (error) {
            this.logger.error('Error during save:', error);
            PopupUtils.showStatus('Failed to save changes', 'error');
        }
    };

    saveSocialLinks = async () => {
        try {
            const inputs = document.querySelectorAll('#fieldsContainer input[data-service]');
            let hasChanges = false;

            for (const input of inputs) {
                const service = input.dataset.service;
                const linkId = input.dataset.linkId;
                const value = input.value.trim();
                
                if (value) {
                    const validation = this.socialLinksManager.validateSocialLink(service, value);
                    if (!validation.isValid) {
                        PopupUtils.showStatus(`Invalid ${service}: ${validation.errors.join(', ')}`, 'error');
                        input.focus();
                        return;
                    }

                    const normalizedUrl = PopupUtils.normalizeUrl(value);
                    
                    if (linkId) {
                        const existingLink = this.socialLinksManager.socialLinks.find(link => link.id === linkId);
                        if (existingLink && existingLink.url !== normalizedUrl) {
                            await this.socialLinksManager.updateSocialLink(linkId, { url: normalizedUrl });
                            hasChanges = true;
                        }
                    } else {
                        try {
                            await this.socialLinksManager.addSocialLink(service, normalizedUrl);
                            hasChanges = true;
                        } catch (error) {
                            if (error.message.includes('Duplicate found')) {
                                PopupUtils.showStatus(`Duplicate ${service} link found`, 'warning');
                            } else {
                                throw error;
                            }
                        }
                    }
                } else if (linkId) {
                    await this.socialLinksManager.deleteSocialLink(linkId);
                    hasChanges = true;
                }
            }

            if (hasChanges) this.logger.info('Social links saved successfully');
        } catch (error) {
            this.logger.error('Error saving social links:', error);
            throw error;
        }
    };

    savePassword = async () => {
        try {
            const passwordField = document.getElementById('passwordValue');
            if (!passwordField) return;
            const password = passwordField.value;
            if (password) {
                await this.passwordManager.savePassword(password);
                this.logger.debug('Password saved successfully');
            } else {
                await this.passwordManager.clearPassword();
                this.logger.debug('Password cleared');
            }
        } catch (error) {
            this.logger.error('Error saving password:', error);
            throw error;
        }
    };

    handleDeleteLink = async (linkId) => {
        try {
            await this.socialLinksManager.deleteSocialLink(linkId);
            PopupUtils.showStatus('Social link deleted successfully');
            await this.loadSocialLinksUI();
        } catch (error) {
            PopupUtils.showStatus(`Failed to delete link: ${error.message}`, 'error');
        }
    };

    loadSocialLinksUI = async () => {
        try {
            const container = document.getElementById('fieldsContainer');
            if (!container) {
                this.logger.error("Element with ID 'fieldsContainer' not found.");
                return;
            }

            container.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'social-links-header';
            header.innerHTML = `
                <h3>🔗 Social Media Platforms</h3>
                <div class="platform-controls">
                    <button id="addPlatformBtn" class="btn btn-primary">➕ Add Platform</button>
                    <button id="resetPlatformsBtn" class="btn btn-secondary">🔄 Reset</button>
                </div>
            `;
            container.appendChild(header);

            const platformsContainer = document.createElement('div');
            platformsContainer.id = 'platformsContainer';
            platformsContainer.className = 'platforms-container';
            container.appendChild(platformsContainer);

            await this.renderPlatforms();
            this.setupSocialLinkEventListeners();
        } catch (error) {
            this.logger.error('Error loading social links UI:', error);
            PopupUtils.showStatus('Failed to load social links', 'error');
        }
    };

    renderPlatforms = async () => {
        const container = document.getElementById('platformsContainer');
        if (!container) return;

        container.innerHTML = '';

        const services = await this.serviceManager.loadServices();
        const serviceNames = Object.keys(services).sort();

        const linksMap = {};
        this.socialLinksManager.socialLinks.forEach(link => {
            linksMap[link.platform] = link;
        });

        serviceNames.forEach(service => {
            const existingLink = linksMap[service];
            const platformDiv = this.createPlatformElement(service, existingLink);
            container.appendChild(platformDiv);
        });
    };

    createPlatformElement = (service, existingLink = null) => {
        const div = document.createElement('div');
        div.className = `platform-item ${existingLink ? 'has-data' : 'empty'}`;
        div.dataset.platform = service;
                
        const serviceDisplay = this.getPlatformDisplayName(service);
        const platformIcon = this.getPlatformIcon(service);
                
        div.innerHTML = `
            <div class="platform-header">
                <div class="platform-info">
                    <span class="platform-icon">${platformIcon}</span>
                    <span class="platform-name">${serviceDisplay}</span>
                </div>
                <div class="platform-actions">
                    <button class="toggle-platform" data-platform="${service}" title="Toggle ${serviceDisplay}">
                        ${existingLink ? '✅' : '⚪'}
                    </button>
                    <button class="remove-platform" data-platform="${service}" title="Remove ${serviceDisplay}">🗑️</button>
                </div>
            </div>
            <div class="platform-input">
                <input 
                    type="url" 
                    class="platform-url-input"
                    data-platform="${service}"
                    data-link-id="${existingLink ? existingLink.id : ''}"
                    placeholder="Enter ${serviceDisplay} URL"
                    value="${existingLink ? PopupUtils.escapeHtml(existingLink.url) : ''}"
                    ${!existingLink ? 'disabled' : ''}
                >
                <div class="platform-status">
                    ${existingLink ? `<span class="status-active">Active</span>` : `<span class="status-inactive">Inactive</span>`}
                </div>
            </div>
        `;
        
        return div;
    };

    getPlatformDisplayName = (service) => {
        const displayNames = {
            facebook: 'Facebook',
            instagram: 'Instagram',
            twitter: 'Twitter/X',
            youtube: 'YouTube',
            linkedin: 'LinkedIn',
            pinterest: 'Pinterest',
            tiktok: 'TikTok',
            snapchat: 'Snapchat',
            website: 'Website'
        };
        return displayNames[service] || service.charAt(0).toUpperCase() + service.slice(1);
    };

    getPlatformIcon = (service) => {
        const icons = {
            facebook: '📘',
            instagram: '📷',
            twitter: '🐦',
            youtube: '📺',
            linkedin: '💼',
            pinterest: '📌',
            tiktok: '🎵',
            snapchat: '👻',
            website: '🌐'
        };
        return icons[service] || '🔗';
    };

    saveUniversalData = async () => {
        try {
            const universalData = {};
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
                if (field && field.value.trim()) universalData[dataKey] = field.value.trim();
            });

            await chrome.storage.sync.set({ universalFormData: universalData });
            PopupUtils.showStatus('Universal form data saved successfully!', 'success');
            this.logger.info('Universal form data saved:', universalData);
        } catch (error) {
            this.logger.error('Error saving universal form data:', error);
            PopupUtils.showStatus('Failed to save universal form data', 'error');
        }
    };

    togglePasswordVisibility = () => {
        const passwordField = document.getElementById('passwordValue');
        const toggleButton = document.getElementById('togglePassword');
        
        if (passwordField && toggleButton) {
            if (passwordField.type === 'password') {
                passwordField.type = 'text';
                toggleButton.textContent = '🙈';
            } else {
                passwordField.type = 'password';
                toggleButton.textContent = '👁️';
            }
        }
    }
}

// ============================================================================
// POPUP INITIALIZER
// ============================================================================

class PopupInitializer {
    constructor() {
        this.setupSettingsButton = this.setupSettingsButton.bind(this);
        this.logger = new PopupLogger('PopupInitializer');
        this.serviceManager = new ServiceManager(this.logger);
        this.socialLinksManager = new SocialLinksManager(this.logger);
        this.passwordManager = new PasswordManager(this.logger);
        this.categoryManager = new CategoryManager(this.logger);
        this.locationManager = new LocationManager(this.logger);
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

        // Universal managers (from popup-universal.js)
        this.universalFormManager = new UniversalFormManager(this.logger);
        this.googleSheetsImporter = new GoogleSheetsImporter(
            this.logger,
            this.universalFormManager,
            this.socialLinksManager
        );
    }

    async initialize() {
        try {
            this.setupSettingsButton();
            this.logger.info(`Initializing Social Filler Pro Popup v${POPUP_CONFIG.VERSION}`);
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

// ============================================================================
// POPUP MANAGER (light UI wrapper, optional)
// ============================================================================

class PopupManager {
    constructor() {
        this.config = POPUP_CONFIG;
        // This wrapper is intentionally lightweight — the main logic lives in PopupInitializer
    }

    async initializeManager() {
        // Optional UI-focused initialization can be added here
        return;
    }
}

// ============================================================================
// UNIVERSAL MODULES (merged from popup-universal.js)
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

    async clearUniversalFormData() {
        try {
            this.universalFormData = {};
            await this.saveUniversalFormData();
            this.logger.info('Universal form data cleared');
            return true;
        } catch (error) {
            this.logger.error('Error clearing universal form data:', error);
            throw error;
        }
    }

    getUniversalFormData() {
        return { ...this.universalFormData };
    }

    setUniversalFormData(data) {
        this.universalFormData = { ...data };
        if (!this.universalFormData.description && this.shouldAutoGenerateDescription()) {
            this.generateAutoDescription();
        }
    }

    shouldAutoGenerateDescription() {
        const hasBusinessInfo = this.universalFormData.title || this.universalFormData.company;
        const hasContactInfo = this.universalFormData.email || this.universalFormData.phone;
        const hasLocationInfo = this.universalFormData.address || this.universalFormData.city;
        return hasBusinessInfo && (hasContactInfo || hasLocationInfo);
    }

    generateAutoDescription() {
        try {
            const parts = [];
            if (this.universalFormData.title) parts.push(`${this.universalFormData.title} is a professional business`);
            else if (this.universalFormData.company) parts.push(`${this.universalFormData.company} is a professional business`);
            if (this.universalFormData.city && this.universalFormData.state) parts.push(`located in ${this.universalFormData.city}, ${this.universalFormData.state}`);
            else if (this.universalFormData.city) parts.push(`located in ${this.universalFormData.city}`);
            else if (this.universalFormData.address) parts.push(`located at ${this.universalFormData.address}`);
            if (this.universalFormData.keywords) {
                const keywords = this.universalFormData.keywords.split(',').slice(0, 3).join(', ');
                parts.push(`specializing in ${keywords}`);
            }
            if (this.universalFormData.phone) parts.push(`Contact us at ${this.universalFormData.phone}`);
            if (this.universalFormData.email) parts.push(`or email us at ${this.universalFormData.email}`);
            if (this.universalFormData.website) parts.push(`Visit our website at ${this.universalFormData.website}`);
            if (parts.length > 0) {
                this.universalFormData.description = parts.join('. ') + '.';
                this.logger.debug('Auto-generated description:', this.universalFormData.description);
            }
        } catch (error) {
            this.logger.error('Error generating auto description:', error);
        }
    }
}

// ---------------- GoogleSheetsParser (AI-like parser) ----------------

class GoogleSheetsParser {
    constructor(logger) {
        this.logger = logger;
    }

    parseGoogleSheetsData(rawData) {
        try {
            return this.aiParseGoogleSheetsData(rawData);
        } catch (error) {
            this.logger.error('Error parsing Google Sheets data:', error);
            return {
                universalFormData: {},
                socialLinks: {},
                passwords: {},
                metadata: {},
                errors: [error.message]
            };
        }
    }

    aiParseGoogleSheetsData(rawData) {
        const parsedData = {
            universalFormData: {},
            socialLinks: {},
            passwords: {},
            metadata: {},
            confidence: {},
            extractionMethod: 'ai'
        };
        
        if (!rawData || typeof rawData !== 'string') {
            this.logger.error('Invalid input data');
            return parsedData;
        }
        
        const cleanedData = this.cleanAndNormalizeData(rawData);
        const lines = cleanedData.split(/\r?\n/).map(line => line.trim()).filter(line => line);
        
        if (lines.length === 0) {
            this.logger.warn('No data found in input');
            return parsedData;
        }
        
        this.extractBusinessInfoAI(lines, parsedData);
        this.extractContactInfoAI(lines, parsedData);
        this.extractSocialLinksAI(lines, parsedData);
        this.extractLocationInfoAI(lines, parsedData);
        this.extractKeywordsAndDescriptionAI(lines, parsedData);
        
        parsedData.metadata.overallConfidence = this.calculateOverallConfidence(parsedData.confidence);
        parsedData.metadata.extractionTimestamp = new Date().toISOString();
        
        this.logger.info(`AI extraction completed with ${parsedData.metadata.overallConfidence}% confidence`);
        return parsedData;
    }

    cleanAndNormalizeData(rawData) {
        return rawData
            .replace(/\r\n/g, '\n')
            .replace(/\n+/g, '\n')
            .replace(/\s+/g, ' ')
            .trim();
    }

    extractBusinessInfoAI(lines, parsedData) {
        const businessPatterns = [
            { pattern: /\*\*Business name:\*\*(.+?)(?:\*\*|$)/i, field: 'title', confidence: 0.9 },
            { pattern: /Business[:\s]+(.+?)(?:\n|$)/i, field: 'title', confidence: 0.8 },
            { pattern: /Company[:\s]+(.+?)(?:\n|$)/i, field: 'company', confidence: 0.8 },
            { pattern: /Organization[:\s]+(.+?)(?:\n|$)/i, field: 'company', confidence: 0.7 },
            { pattern: /Phone[#\s]*:?\s*(.+?)(?:\n|$)/i, field: 'phone', confidence: 0.9 },
            { pattern: /\*\*Address:\*\*(.+?)(?:\*\*|$)/i, field: 'address', confidence: 0.9 },
            { pattern: /\*\*City:\*\*(.+?)(?:\*\*|$)/i, field: 'city', confidence: 0.9 },
            { pattern: /\*\*State:\*\*(.+?)(?:\*\*|$)/i, field: 'state', confidence: 0.9 },
            { pattern: /\*\*Zip:\*\*(.+?)(?:\*\*|$)/i, field: 'zip', confidence: 0.9 }
        ];

        this.extractWithPatterns(lines, businessPatterns, parsedData);
    }

    extractContactInfoAI(lines, parsedData) {
        const contactPatterns = [
            { pattern: /Email[:\s]+([^\s\*]+@[^\s\*]+)/i, field: 'email', confidence: 0.9 },
            { pattern: /\*\*PW:\*\*([^\*\s]+)/i, field: 'password', confidence: 0.9 },
            { pattern: /Password[:\s]+([^\s\*]+)/i, field: 'password', confidence: 0.8 }
        ];

        this.extractWithPatterns(lines, contactPatterns, parsedData);
    }

    extractSocialLinksAI(lines, parsedData) {
        const socialPatterns = [
            { pattern: /Website[:\s]+(https?:\/\/[^\s\*]+)/i, field: 'website', confidence: 0.9 },
            { pattern: /Facebook[:\s]*(https?:\/\/(?:www\.)?facebook\.com[^\s\*]+)/i, field: 'facebook', confidence: 0.9 },
            { pattern: /Instagram[:\s]*(https?:\/\/(?:www\.)?instagram\.com[^\s\*]+)/i, field: 'instagram', confidence: 0.9 },
            { pattern: /Twitter[:\s]*(https?:\/\/(?:x\.com|twitter\.com)[^\s\*]+)/i, field: 'twitter', confidence: 0.9 },
            { pattern: /YouTube[:\s]*(https?:\/\/(?:www\.)?youtube\.com[^\s\*]+)/i, field: 'youtube', confidence: 0.9 },
            { pattern: /LinkedIn[:\s]*(https?:\/\/(?:www\.)?linkedin\.com[^\s\*]+)/i, field: 'linkedin', confidence: 0.9 },
            { pattern: /Pinterest[:\s]*(https?:\/\/(?:www\.)?pinterest\.com[^\s\*]+)/i, field: 'pinterest', confidence: 0.9 },
            { pattern: /TikTok[:\s]*(https?:\/\/(?:www\.)?tiktok\.com[^\s\*]+)/i, field: 'tiktok', confidence: 0.9 }
        ];

        this.extractWithPatterns(lines, socialPatterns, parsedData);
    }

    extractLocationInfoAI(lines, parsedData) {
        const locationPatterns = [
            { pattern: /Country[:\s]+(.+?)(?:\n|$)/i, field: 'country', confidence: 0.8 },
            { pattern: /Location[:\s]+(.+?)(?:\n|$)/i, field: 'location', confidence: 0.8 },
            { pattern: /Address[:\s]+(.+?)(?:\n|$)/i, field: 'location', confidence: 0.7 }
        ];

        this.extractWithPatterns(lines, locationPatterns, parsedData);
    }

    extractKeywordsAndDescriptionAI(lines, parsedData) {
        const contentPatterns = [
            { pattern: /\*\*Keywords:\*\*(.+?)(?:\*\*|$)/i, field: 'keywords', confidence: 0.9 },
            { pattern: /Keywords[:\s]+(.+?)(?:\n|$)/i, field: 'keywords', confidence: 0.8 },
            { pattern: /Description[:\s]+(.+?)(?:\n|$)/i, field: 'description', confidence: 0.8 }
        ];

        this.extractWithPatterns(lines, contentPatterns, parsedData);
    }

    extractWithPatterns(lines, patterns, parsedData) {
        const fullText = lines.join(' ');
        patterns.forEach(({ pattern, field, confidence }) => {
            const match = fullText.match(pattern);
            if (match) {
                const value = match[1].trim();
                if (value.length > 0) {
                    if (field === 'password') parsedData.passwords.main = value;
                    else if (['facebook','instagram','twitter','youtube','linkedin','pinterest','tiktok','website'].includes(field)) parsedData.socialLinks[field] = value;
                    else parsedData.universalFormData[field] = value;
                    parsedData.confidence[field] = confidence;
                    this.logger.debug(`Extracted ${field}: ${value} (confidence: ${confidence})`);
                }
            }
        });
    }

    calculateOverallConfidence(confidence) {
        const scores = Object.values(confidence);
        if (scores.length === 0) return 0;
        const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        return Math.round(average * 100);
    }

    basicParseGoogleSheetsData(rawData) {
        const parsedData = {
            universalFormData: {},
            socialLinks: {},
            passwords: {},
            metadata: {}
        };
        const lines = rawData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const patterns = {
            businessName: /\*\*Business name:\*\*(.+?)(?:\*\*|$)/i,
            phone: /Phone #(.+?)(?:\*\*|$)/i,
            address: /\*\*Address:\*\*(.+?)(?:\*\*|$)/i,
            city: /\*\*City:\*\*(.+?)(?:\*\*|$)/i,
            zip: /\*\*Zip:\*\*(.+?)(?:\*\*|$)/i,
            website: /Website:(https?:\/\/[^\s\*]+)/i,
            facebook: /(https?:\/\/(?:www\.)?facebook\.com[^\s\*]+)/i,
            instagram: /(https?:\/\/(?:www\.)?instagram\.com[^\s\*]+)/i,
            youtube: /(https?:\/\/(?:www\.)?youtube\.com[^\s\*]+)/i,
            pinterest: /(https?:\/\/(?:www\.)?pinterest\.com[^\s\*]+)/i,
            twitter: /(https?:\/\/(?:x\.com|twitter\.com)[^\s\*]+)/i,
            email: /Email:([^\s\*]+@[^\s\*]+)/i,
            password: /\*\*PW:\*\*([^\*\s]+)/i,
            keywords: /\*\*Keywords:\*\*(.+?)(?:\*\*|$)/i
        };
        const fullText = lines.join(' ');
        const m = fullText.match(patterns.businessName);
        if (m) parsedData.universalFormData.title = parsedData.universalFormData.company = m[1].trim();
        const phoneMatch = fullText.match(patterns.phone);
        if (phoneMatch) parsedData.universalFormData.phone = phoneMatch[1].trim();
        const addressMatch = fullText.match(patterns.address);
        if (addressMatch) parsedData.universalFormData.address = addressMatch[1].split('Website:')[0].trim();
        const websiteMatch = fullText.match(patterns.website);
        if (websiteMatch) {
            parsedData.socialLinks.website = websiteMatch[1];
            parsedData.universalFormData.website = websiteMatch[1];
        }
        const facebookMatch = fullText.match(patterns.facebook);
        if (facebookMatch) parsedData.socialLinks.facebook = facebookMatch[1];
        const instagramMatch = fullText.match(patterns.instagram);
        if (instagramMatch) parsedData.socialLinks.instagram = instagramMatch[1];
        const youtubeMatch = fullText.match(patterns.youtube);
        if (youtubeMatch) parsedData.socialLinks.youtube = youtubeMatch[1];
        const pinterestMatch = fullText.match(patterns.pinterest);
        if (pinterestMatch) parsedData.socialLinks.pinterest = pinterestMatch[1];
        const twitterMatch = fullText.match(patterns.twitter);
        if (twitterMatch) parsedData.socialLinks.twitter = twitterMatch[1];
        const emailMatch = fullText.match(patterns.email);
        if (emailMatch) parsedData.universalFormData.email = emailMatch[1];
        const passwordMatch = fullText.match(patterns.password);
        if (passwordMatch) parsedData.passwords.main = passwordMatch[1];
        return parsedData;
    }
}

// ---------------- GoogleSheetsImporter ----------------

class GoogleSheetsImporter {
    constructor(logger, universalFormManager, socialLinksManager) {
        this.logger = logger;
        this.universalFormManager = universalFormManager;
        this.socialLinksManager = socialLinksManager;
        this.parser = new GoogleSheetsParser(logger);
    }

    async importGoogleSheetsData(rawData) {
        try {
            this.logger.info('Starting Google Sheets import...');
            this.showImportStatus('🤖 AI is analyzing and extracting data...', 'info');
            const parsedData = await this.parser.parseGoogleSheetsData(rawData);
            this.logger.debug('Parsed data:', parsedData);

            if (parsedData.errors && parsedData.errors.length > 0) {
                this.logger.error('Parsing errors:', parsedData.errors);
                PopupUtils.showStatus(`Import failed: ${parsedData.errors.join(', ')}`, 'error');
                return parsedData;
            }

            let importedCount = 0;
            let errors = [];

            if (!parsedData.universalFormData.description && window.EnhancedSheetsParser) {
                const generatedDesc = window.EnhancedSheetsParser.generateDescription(parsedData);
                if (generatedDesc) {
                    parsedData.universalFormData.description = generatedDesc;
                    this.logger.debug('Auto-generated description:', generatedDesc);
                }
            }

            if (parsedData.universalFormData && Object.keys(parsedData.universalFormData).length > 0) {
                try {
                    this.universalFormManager.setUniversalFormData(parsedData.universalFormData);
                    await this.universalFormManager.saveUniversalFormData();
                    Object.entries(parsedData.universalFormData).forEach(([key, value]) => {
                        const field = document.getElementById(`universal-${key}`);
                        if (field) {
                            field.value = value;
                            field.style.backgroundColor = '#E8F5E8';
                            importedCount++;
                        }
                    });
                } catch (error) {
                    errors.push(`Universal form data: ${error.message}`);
                    this.logger.error('Error saving universal form data:', error);
                }
            }

            if (parsedData.socialLinks && Object.keys(parsedData.socialLinks).length > 0) {
                try {
                    for (const [platform, url] of Object.entries(parsedData.socialLinks)) {
                        try {
                            await this.socialLinksManager.addSocialLink(platform, url);
                            importedCount++;
                        } catch (error) {
                            if (error.message.includes('Duplicate found')) {
                                this.logger.debug(`Skipping duplicate ${platform} link`);
                            } else {
                                errors.push(`Social link ${platform}: ${error.message}`);
                            }
                        }
                    }
                } catch (error) {
                    errors.push(`Social links: ${error.message}`);
                    this.logger.error('Error saving social links:', error);
                }
            }

            if (parsedData.passwords && parsedData.passwords.main) {
                try {
                    await chrome.storage.sync.set({ fillPassword: parsedData.passwords.main });
                    this.logger.debug('Saved password');
                    const passwordField = document.getElementById('passwordValue');
                    if (passwordField) {
                        passwordField.value = parsedData.passwords.main;
                        passwordField.style.backgroundColor = '#E8F5E8';
                        importedCount++;
                    }
                } catch (error) {
                    errors.push(`Password: ${error.message}`);
                    this.logger.error('Error saving password:', error);
                }
            }

            let statusMessage = '';
            let statusType = 'success';
            if (importedCount > 0) {
                statusMessage = `Successfully imported ${importedCount} fields!`;
                if (parsedData.warnings && parsedData.warnings.length > 0) {
                    statusMessage += ` (${parsedData.warnings.length} warnings)`;
                    statusType = 'warning';
                }
                if (errors.length > 0) {
                    statusMessage += ` (${errors.length} errors)`;
                    statusType = 'warning';
                }
            } else {
                statusMessage = 'No data found to import. Please check your Google Sheets format.';
                statusType = 'error';
            }

            PopupUtils.showStatus(statusMessage, statusType);
            if (parsedData.stats) {
                this.logger.info(`Stats: ${parsedData.stats.fieldsExtracted} fields extracted`);
            }
            await this.notifyContentScripts(parsedData);
            return parsedData;

        } catch (error) {
            this.logger.error('Critical error during import:', error);
            PopupUtils.showStatus(`Import failed: ${error.message}`, 'error');
            throw error;
        }
    }

    showAIExtractionResults(parsedData) {
        const resultsDiv = document.getElementById('aiExtractionResults');
        if (!resultsDiv) return;
        let html = '<div class="ai-results">';
        html += '<h4>🤖 AI Extraction Results</h4>';
        const confidence = parsedData.metadata?.overallConfidence || 0;
        html += `<div class="confidence-score">Overall Confidence: <span class="confidence-${confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low'}">${confidence}%</span></div>`;
        if (parsedData.universalFormData && Object.keys(parsedData.universalFormData).length > 0) {
            html += '<div class="extracted-section"><h5>📋 Business Information</h5><ul>';
            Object.entries(parsedData.universalFormData).forEach(([key, value]) => {
                const conf = parsedData.confidence?.[key] || 0;
                const confClass = conf >= 0.8 ? 'high' : conf >= 0.6 ? 'medium' : 'low';
                html += `<li><strong>${key}:</strong> ${value} <span class="confidence-${confClass}">(${Math.round(conf * 100)}%)</span></li>`;
            });
            html += '</ul></div>';
        }
        if (parsedData.socialLinks && Object.keys(parsedData.socialLinks).length > 0) {
            html += '<div class="extracted-section"><h5>🔗 Social Media Links</h5><ul>';
            Object.entries(parsedData.socialLinks).forEach(([platform, url]) => {
                const conf = parsedData.confidence?.[platform] || 0;
                const confClass = conf >= 0.8 ? 'high' : conf >= 0.6 ? 'medium' : 'low';
                html += `<li><strong>${platform}:</strong> ${url} <span class="confidence-${confClass}">(${Math.round(conf * 100)}%)</span></li>`;
            });
            html += '</ul></div>';
        }
        if (parsedData.passwords && parsedData.passwords.main) {
            const conf = parsedData.confidence?.password || 0;
            const confClass = conf >= 0.8 ? 'high' : conf >= 0.6 ? 'medium' : 'low';
            html += '<div class="extracted-section"><h5>🔐 Password</h5><ul>';
            html += `<li><strong>Password:</strong> •••••••• <span class="confidence-${confClass}">(${Math.round(conf * 100)}%)</span></li>`;
            html += '</ul></div>';
        }
        html += '</div>';
        resultsDiv.innerHTML = html;
        resultsDiv.style.display = 'block';
    }

    async notifyContentScripts(parsedData) {
        try {
            const tabs = await chrome.tabs.query({});
            const notifications = tabs.map(tab => {
                if (tab.id) {
                    return Promise.allSettled([
                        chrome.tabs.sendMessage(tab.id, {
                            type: 'UNIVERSAL_FORM_DATA_UPDATED',
                            data: parsedData.universalFormData || {}
                        }),
                        chrome.tabs.sendMessage(tab.id, {
                            type: 'SERVICES_UPDATED'
                        })
                    ]);
                }
            });
            await Promise.allSettled(notifications);
            this.logger.debug('Notified content scripts');
        } catch (error) {
            this.logger.warn('Could not notify content scripts:', error);
        }
    }

    setupGoogleSheetsImport() {
        const importButton = document.getElementById('importSheetsData');
        const clearButton = document.getElementById('clearImportData');
        const importTextarea = document.getElementById('sheetsImportData');
        if (importButton && importTextarea) {
            importButton.addEventListener('click', async () => {
                const rawData = importTextarea.value.trim();
                if (!rawData) {
                    this.showImportStatus('Please paste your Google Sheets data first', 'error');
                    return;
                }
                try {
                    importButton.disabled = true;
                    importButton.innerHTML = '⏳ Importing...';
                    importButton.style.background = '#ff9800';
                    this.showImportStatus('Parsing and importing data...', 'info');
                    const result = await this.importGoogleSheetsData(rawData);
                    this.showImportStatus(`✅ Successfully imported data! Check the fields below.`, 'success');
                    setTimeout(() => {
                        importTextarea.value = '';
                        this.hideImportStatus();
                    }, 3000);
                } catch (error) {
                    this.logger.error('Import failed:', error);
                    this.showImportStatus(`❌ Import failed: ${error.message}`, 'error');
                } finally {
                    importButton.disabled = false;
                    importButton.innerHTML = '📥 Import & Fill All Data';
                    importButton.style.background = '#4CAF50';
                }
            });
        }
        if (clearButton && importTextarea) {
            clearButton.addEventListener('click', () => {
                importTextarea.value = '';
                this.hideImportStatus();
                PopupUtils.showStatus('Import box cleared');
            });
        }
        if (importTextarea) {
            importTextarea.addEventListener('input', () => {
                const value = importTextarea.value.trim();
                if (value.length > 0) {
                    const hasLabels = /(\*\*.*?\*\*|Phone #|Website:|Email:)/i.test(value);
                    if (hasLabels) this.showImportStatus('✅ Data format looks good!', 'success');
                    else this.showImportStatus('⚠️ Make sure your data includes field labels like "**Business name:**"', 'warning');
                } else this.hideImportStatus();
            });
        }
    }

    showImportStatus(message, type = 'info') {
        const importStatus = document.getElementById('importStatus');
        if (!importStatus) return;
        importStatus.textContent = message;
        importStatus.style.display = 'block';
        const colors = {
            success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
            error: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
            warning: { bg: '#fff3cd', color: '#856404', border: '#ffeaa7' },
            info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
        };
        const style = colors[type] || colors.info;
        importStatus.style.backgroundColor = style.bg;
        importStatus.style.color = style.color;
        importStatus.style.border = `1px solid ${style.border}`;
    }

    hideImportStatus() {
        const importStatus = document.getElementById('importStatus');
        if (importStatus) importStatus.style.display = 'none';
    }
}

// ---------------- IntegrationHelper ----------------

class IntegrationHelper {
    constructor(logger) {
        this.logger = logger;
    }

    addDescriptionAutoFillButton() {
        const descriptionField = document.getElementById('universal-description');
        if (!descriptionField) return;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'description-auto-fill-container';
        buttonContainer.style.cssText = `display:flex;gap:5px;margin-top:5px;align-items:center;`;

        const autoFillButton = document.createElement('button');
        autoFillButton.textContent = '✨ Auto-Generate';
        autoFillButton.className = 'auto-fill-btn';
        autoFillButton.style.cssText = `background:#4CAF50;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:12px;`;

        autoFillButton.addEventListener('click', () => {
            if (window.DescriptionAutoFiller) {
                const description = window.DescriptionAutoFiller.generateDescriptionManually();
                if (description) PopupUtils.showStatus('Description auto-generated successfully!');
                else PopupUtils.showStatus('Could not generate description. Please fill in business name and keywords first.', 'warning');
            }
        });

        const templateSelect = document.createElement('select');
        templateSelect.className = 'template-select';
        templateSelect.style.cssText = `padding:5px;border:1px solid #ddd;border-radius:4px;font-size:12px;`;
        templateSelect.innerHTML = `
            <option value="auto">Auto-detect</option>
            <option value="business">Business</option>
            <option value="service">Service</option>
            <option value="cleaning">Cleaning</option>
        `;
        templateSelect.addEventListener('change', () => {
            if (window.DescriptionAutoFiller) {
                const templateType = templateSelect.value;
                const description = window.DescriptionAutoFiller.generateDescriptionManually(templateType);
                if (description) PopupUtils.showStatus(`Description generated using ${templateType} template!`);
            }
        });

        buttonContainer.appendChild(autoFillButton);
        buttonContainer.appendChild(templateSelect);
        descriptionField.parentNode.insertBefore(buttonContainer, descriptionField.nextSibling);

        autoFillButton.addEventListener('mouseenter', () => autoFillButton.style.backgroundColor = '#45a049');
        autoFillButton.addEventListener('mouseleave', () => autoFillButton.style.backgroundColor = '#4CAF50');
    }

    addDuplicateCleanupButton() {
        const buttonGroup = document.querySelector('.button-group');
        if (!buttonGroup) return;

        const cleanupButton = document.createElement('button');
        cleanupButton.textContent = '🧹 Clean Duplicates';
        cleanupButton.className = 'cleanup-duplicates-btn';
        cleanupButton.style.cssText = `background:#ff9800;color:white;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-left:5px;`;

        cleanupButton.addEventListener('click', async () => {
            try {
                cleanupButton.disabled = true;
                cleanupButton.textContent = '🧹 Cleaning...';
                cleanupButton.style.background = '#ff6b6b';
                if (window.DuplicatePrevention) {
                    const cleanedCount = await window.DuplicatePrevention.cleanupDuplicates();
                    cleanupButton.textContent = `✅ Cleaned ${cleanedCount}`;
                    cleanupButton.style.background = '#4CAF50';
                    setTimeout(() => {
                        cleanupButton.textContent = '🧹 Clean Duplicates';
                        cleanupButton.style.background = '#ff9800';
                        cleanupButton.disabled = false;
                    }, 3000);
                } else {
                    PopupUtils.showStatus('Duplicate prevention system not available', 'error');
                    cleanupButton.disabled = false;
                    cleanupButton.textContent = '🧹 Clean Duplicates';
                    cleanupButton.style.background = '#ff9800';
                }
            } catch (error) {
                this.logger.error('Error cleaning duplicates:', error);
                PopupUtils.showStatus('Error cleaning duplicates', 'error');
                cleanupButton.disabled = false;
                cleanupButton.textContent = '🧹 Clean Duplicates';
                cleanupButton.style.background = '#ff9800';
            }
        });

        buttonGroup.appendChild(cleanupButton);
    }
}

// ============================================================================
// INITIALIZATION (single DOMContentLoaded)
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (typeof window.UniversalFormManager !== 'undefined') {
            // If a global is present (unlikely in ESM flow), attach - safe fallback
            window.universalFormManager = new window.UniversalFormManager(new PopupLogger('UniversalForm'));
        }

        window.popupInitializer = new PopupInitializer();
        await window.popupInitializer.initialize();

        // After initialization, attach global helpers (IntegrationHelper, etc.) for backward compatibility
        window.universalFormManager = window.popupInitializer.universalFormManager;
        window.googleSheetsImporter = window.popupInitializer.googleSheetsImporter;
        window.integrationHelper = new IntegrationHelper(window.popupInitializer.logger);

        // Setup integration hooks
        try {
            window.googleSheetsImporter.setupGoogleSheetsImport();
        } catch (err) {
            window.popupInitializer.logger.warn('Google Sheets importer setup skipped:', err);
        }

        try {
            window.universalFormManager.loadUniversalFormUI();
        } catch (err) {
            window.popupInitializer.logger.warn('Load universal UI skipped:', err);
        }

        if (window.DescriptionAutoFiller) {
            try {
                window.DescriptionAutoFiller.initialize();
                window.integrationHelper.addDescriptionAutoFillButton();
            } catch (err) {
                window.popupInitializer.logger.warn('DescriptionAutoFiller init failed:', err);
            }
        }

        if (window.DuplicatePrevention) {
            try {
                window.DuplicatePrevention.initialize();
                window.integrationHelper.addDuplicateCleanupButton();
            } catch (err) {
                window.popupInitializer.logger.warn('DuplicatePrevention init failed:', err);
            }
        }

        window.popupInitializer.logger.info('Popup and universal modules initialized');
    } catch (error) {
        console.error('Error initializing popup:', error);
    }
});

// ============================================================================
// ESM EXPORTS
// ============================================================================

export { PopupInitializer };
export { POPUP_CONFIG };
