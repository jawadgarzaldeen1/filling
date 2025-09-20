/**
 * Core Popup Script for Social Filler Pro Extension
 * 
 * This module provides:
 * - Service management
 * - Social links management
 * - Password management
 * - Category and location management
 * - Event handling and UI updates
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const POPUP_CONFIG = {
    VERSION: '7.0',
    STORAGE_KEYS: {
        SERVICES: 'services',
        SOCIAL_LINKS: 'socialLinks',
        PASSWORD: 'fillPassword',
        SELECTED_CATEGORY: 'selectedCategory',
        SELECTED_LOCATION: 'selectedLocation',
        SETTINGS: 'settings'
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

/**
 * Enhanced logging system for popup
 */
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
            }
        }
    }

    error(message, ...args) { this.log(0, message, ...args); }
    warn(message, ...args) { this.log(1, message, ...args); }
    info(message, ...args) { this.log(2, message, ...args); }
    debug(message, ...args) { this.log(3, message, ...args); }
}

/**
 * Utility functions for popup
 */
class PopupUtils {
    /**
     * Show status message to user
     */
    static showStatus(message, type = 'info', duration = 3000) {
        try {
            // Create or update status element
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

            // Set message and styling
            statusElement.textContent = message;
            statusElement.style.display = 'block';

            // Set colors based on type
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

            // Auto-hide after duration
            setTimeout(() => {
                if (statusElement) {
                    statusElement.style.display = 'none';
                }
            }, duration);

        } catch (error) {
            console.error('Error showing status message:', error);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Validate URL format
     */
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Normalize URL format
     */
    static normalizeUrl(url) {
        if (!url) return '';
        url = url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return url;
    }

    /**
     * Debounce function
     */
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

    /**
     * Generate unique ID
     */
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

    /**
     * Load services from storage
     */
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

    /**
     * Save services to storage
     */
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

    /**
     * Toggle service enabled state
     */
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

    /**
     * Reset services to default
     */
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

    /**
     * Get enabled services
     */
    getEnabledServices() {
        return Object.entries(this.services)
            .filter(([_, config]) => config.enabled)
            .map(([name, _]) => name);
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

    /**
     * Load social links from storage
     */
    async loadSocialLinks() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SOCIAL_LINKS);
            const links = result[POPUP_CONFIG.STORAGE_KEYS.SOCIAL_LINKS];
            
            if (Array.isArray(links)) {
                this.socialLinks = links;
            } else if (links && typeof links === 'object') {
                // Migrate from old object format to new array format
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

    /**
     * Save social links to storage
     */
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

    /**
     * Add new social link
     */
    async addSocialLink(platform, url) {
        try {
            // Check for duplicates
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

    /**
     * Update existing social link
     */
    async updateSocialLink(id, updates) {
        try {
            const index = this.socialLinks.findIndex(link => link.id === id);
            if (index === -1) {
                throw new Error('Social link not found');
            }

            // Check for duplicates (excluding current link)
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

    /**
     * Delete social link
     */
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

    /**
     * Validate social link
     */
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

    /**
     * Get social links as object (for compatibility)
     */
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

    /**
     * Load password from storage
     */
    async loadPassword() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.PASSWORD);
            return result[POPUP_CONFIG.STORAGE_KEYS.PASSWORD] || '';
        } catch (error) {
            this.logger.error('Error loading password:', error);
            return '';
        }
    }

    /**
     * Save password to storage
     */
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

    /**
     * Clear password from storage
     */
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

    /**
     * Load category from storage
     */
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

    /**
     * Save category to storage
     */
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
            
            // Notify content scripts
            await this.notifyContentScripts(POPUP_CONFIG.MESSAGE_TYPES.CATEGORY_UPDATED, { category });
            
            return true;
        } catch (error) {
            this.logger.error('Error saving category:', error);
            PopupUtils.showStatus('Failed to save category', 'error');
            return false;
        }
    }

    /**
     * Clear category form
     */
    clearCategoryForm() {
        const categoryInput = document.getElementById('categoryValue');
        if (categoryInput) {
            categoryInput.value = '';
        }
    }

    /**
     * Get selected category
     */
    async getSelectedCategory() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY);
            return result[POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY] || null;
        } catch (error) {
            this.logger.error('Error getting selected category:', error);
            return null;
        }
    }

    /**
     * Notify content scripts about category update
     */
    async notifyContentScripts(messageType, data) {
        try {
            const tabs = await chrome.tabs.query({});
            const notifications = tabs.map(tab => {
                if (tab.id) {
                    return chrome.tabs.sendMessage(tab.id, {
                        type: messageType,
                        ...data
                    }).catch(() => {}); // Ignore errors for tabs without content script
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

    /**
     * Load location from storage
     */
    async loadLocation() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION);
            const locationData = result[POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION] || {};
            
            // Load country
            const countrySelect = document.getElementById('countryValue');
            if (countrySelect) {
                countrySelect.value = locationData.country || '';
            }
            
            // Load region
            const regionInput = document.getElementById('regionValue');
            if (regionInput) {
                regionInput.value = locationData.region || '';
            }
            
            // Load city
            const cityInput = document.getElementById('cityValue');
            if (cityInput) {
                cityInput.value = locationData.city || '';
            }
            
            // Load address
            const addressInput = document.getElementById('addressValue');
            if (addressInput) {
                addressInput.value = locationData.address || '';
            }
            
            this.logger.debug('Location loaded:', locationData);
            return locationData;
        } catch (error) {
            this.logger.error('Error loading location:', error);
            return {};
        }
    }

    /**
     * Save location to storage
     */
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
            
            // Notify content scripts
            await this.notifyContentScripts(POPUP_CONFIG.MESSAGE_TYPES.LOCATION_UPDATED, { location: locationData });
            
            return true;
        } catch (error) {
            this.logger.error('Error saving location:', error);
            PopupUtils.showStatus('Failed to save location', 'error');
            return false;
        }
    }

    /**
     * Clear location form
     */
    clearLocationForm() {
        const fields = ['countryValue', 'regionValue', 'cityValue', 'addressValue'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
            }
        });
    }

    /**
     * Get selected location
     */
    async getSelectedLocation() {
        try {
            const result = await chrome.storage.sync.get(POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION);
            return result[POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION] || null;
        } catch (error) {
            this.logger.error('Error getting selected location:', error);
            return null;
        }
    }

    /**
     * Notify content scripts about location update
     */
    async notifyContentScripts(messageType, data) {
        try {
            const tabs = await chrome.tabs.query({});
            const notifications = tabs.map(tab => {
                if (tab.id) {
                    return chrome.tabs.sendMessage(tab.id, {
                        type: messageType,
                        ...data
                    }).catch(() => {}); // Ignore errors for tabs without content script
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

    /**
     * Reset all data to defaults
     */
    async resetAll() {
        try {
            if (!confirm('Are you sure you want to reset all data? This cannot be undone!')) {
                return false;
            }

            this.logger.info('Resetting all data to defaults');
            
            // Reset services
            await this.serviceManager.resetToDefault();
            
            // Clear social links
            this.socialLinksManager.socialLinks = [];
            await this.socialLinksManager.saveSocialLinks();
            
            // Clear password
            await this.passwordManager.clearPassword();
            
            // Clear category
            await chrome.storage.sync.remove(POPUP_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY);
            
            // Clear location
            await chrome.storage.sync.remove(POPUP_CONFIG.STORAGE_KEYS.SELECTED_LOCATION);
            
            PopupUtils.showStatus('All data reset to defaults', 'success');
            this.logger.info('All data reset successfully');
            
            // Reload the popup
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
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
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        try {
            this.logger.debug('Setting up event listeners');
            
            // Save button
            const saveButton = document.getElementById('saveButton');
            if (saveButton) {
                saveButton.addEventListener('click', () => this.handleSave());
            }

            // Settings button
            const settingsButton = document.getElementById('settingsButton');
            if (settingsButton) {
                settingsButton.addEventListener('click', () => {
                    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
                });
            }

            // Reset button
            const resetButton = document.getElementById('resetButton');
            if (resetButton) {
                resetButton.addEventListener('click', () => this.resetManager.resetAll());
            }

            // Category save button
            const saveCategoryButton = document.getElementById('saveCategory');
            if (saveCategoryButton) {
                saveCategoryButton.addEventListener('click', () => this.categoryManager.saveCategory());
            }

            // Location save button
            const saveLocationButton = document.getElementById('saveLocation');
            if (saveLocationButton) {
                saveLocationButton.addEventListener('click', () => this.locationManager.saveLocation());
            }

            // Social link delete buttons
            this.setupSocialLinkDeleteListeners();

            this.logger.debug('Event listeners setup complete');
        } catch (error) {
            this.logger.error('Error setting up event listeners:', error);
        }
    }

    /**
     * Setup social link delete button listeners
     */
    setupSocialLinkDeleteListeners() {
        const container = document.getElementById('fieldsContainer');
        if (container) {
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-link-btn')) {
                    const linkId = e.target.dataset.linkId;
                    this.handleDeleteLink(linkId);
                }
            });
        }
    }

    /**
     * Handle save action
     */
    async handleSave() {
        try {
            this.logger.info('Handling save action');
            
            // Save social links
            await this.saveSocialLinks();
            
            // Save password
            await this.savePassword();
            
            PopupUtils.showStatus('All changes saved successfully!', 'success');
            
        } catch (error) {
            this.logger.error('Error during save:', error);
            PopupUtils.showStatus('Failed to save changes', 'error');
        }
    }

    /**
     * Save social links from UI
     */
    async saveSocialLinks() {
        try {
            const inputs = document.querySelectorAll('#fieldsContainer input[data-service]');
            let hasChanges = false;

            for (const input of inputs) {
                const service = input.dataset.service;
                const linkId = input.dataset.linkId;
                const value = input.value.trim();
                
                if (value) {
                    // Validate the link
                    const validation = this.socialLinksManager.validateSocialLink(service, value);
                    if (!validation.isValid) {
                        PopupUtils.showStatus(`Invalid ${service}: ${validation.errors.join(', ')}`, 'error');
                        input.focus();
                        return;
                    }

                    const normalizedUrl = PopupUtils.normalizeUrl(value);
                    
                    if (linkId) {
                        // Update existing link
                        const existingLink = this.socialLinksManager.socialLinks.find(link => link.id === linkId);
                        if (existingLink && existingLink.url !== normalizedUrl) {
                            await this.socialLinksManager.updateSocialLink(linkId, { url: normalizedUrl });
                            hasChanges = true;
                        }
                    } else {
                        // Add new link
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
                    // Remove link if input is empty
                    await this.socialLinksManager.deleteSocialLink(linkId);
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                this.logger.info('Social links saved successfully');
            }

        } catch (error) {
            this.logger.error('Error saving social links:', error);
            throw error;
        }
    }

    /**
     * Save password from UI
     */
    async savePassword() {
        try {
            const passwordField = document.getElementById('passwordValue');
            if (passwordField) {
                const password = passwordField.value;
                if (password) {
                    await this.passwordManager.savePassword(password);
                    this.logger.debug('Password saved successfully');
                } else {
                    await this.passwordManager.clearPassword();
                    this.logger.debug('Password cleared');
                }
            }
        } catch (error) {
            this.logger.error('Error saving password:', error);
            throw error;
        }
    }

    /**
     * Handle delete link action
     */
    async handleDeleteLink(linkId) {
        try {
            await this.socialLinksManager.deleteSocialLink(linkId);
            PopupUtils.showStatus('Social link deleted successfully');
            
            // Reload the UI
            await this.loadSocialLinksUI();
            
        } catch (error) {
            PopupUtils.showStatus(`Failed to delete link: ${error.message}`, 'error');
        }
    }

    /**
     * Load social links UI
     */
    async loadSocialLinksUI() {
        try {
            const container = document.getElementById('fieldsContainer');
            if (!container) {
                this.logger.error("Element with ID 'fieldsContainer' not found.");
                return;
            }

            container.innerHTML = '';

            const services = await this.serviceManager.loadServices();
            const serviceNames = Object.keys(services);

            // Create a map of existing links for quick lookup
            const linksMap = {};
            this.socialLinksManager.socialLinks.forEach(link => {
                linksMap[link.platform] = link;
            });

            serviceNames.forEach(service => {
                const div = document.createElement('div');
                div.className = 'field-item social-link-item';
                const inputId = `service-input-${service}`;
                
                const serviceDisplay = service.charAt(0).toUpperCase() + service.slice(1);
                const escapedService = PopupUtils.escapeHtml(service);
                const existingLink = linksMap[service];
                
                div.innerHTML = `
                    <label for="${inputId}">
                        ${serviceDisplay}:
                    </label>
                    <div class="social-input-group">
                        <input type="url"
                               id="${inputId}"
                               data-service="${escapedService}"
                               data-link-id="${existingLink ? existingLink.id : ''}"
                               value="${existingLink ? PopupUtils.escapeHtml(existingLink.url) : ''}"
                               placeholder="https://${service}.com/yourprofile">
                        ${existingLink ? `
                            <button class="delete-link-btn" data-link-id="${existingLink.id}" title="Delete this link">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                `;
                container.appendChild(div);
            });

        } catch (error) {
            this.logger.error('Error loading social links UI:', error);
            PopupUtils.showStatus('Failed to load social links', 'error');
        }
    }
}

// ============================================================================
// POPUP INITIALIZER
// ============================================================================

class PopupInitializer {
    constructor() {
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
    }

    /**
     * Initialize the popup
     */
    async initialize() {
        try {
            this.logger.info(`Initializing Social Filler Pro Popup v${POPUP_CONFIG.VERSION}`);
            
            // Load data
            await this.loadAllData();
            
            // Setup event listeners
            this.eventManager.setupEventListeners();
            
            // Load UI
            await this.loadUI();
            
            this.logger.info('Popup initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize popup:', error);
            PopupUtils.showStatus('Failed to initialize popup', 'error');
        }
    }

    /**
     * Load all data from storage
     */
    async loadAllData() {
        try {
            await Promise.all([
                this.serviceManager.loadServices(),
                this.socialLinksManager.loadSocialLinks(),
                this.passwordManager.loadPassword(),
                this.categoryManager.loadCategory(),
                this.locationManager.loadLocation()
            ]);
            this.logger.debug('All data loaded successfully');
        } catch (error) {
            this.logger.error('Error loading data:', error);
        }
    }

    /**
     * Load UI elements
     */
    async loadUI() {
        try {
            // Load social links UI
            await this.eventManager.loadSocialLinksUI();
            
            // Load password
            const password = await this.passwordManager.loadPassword();
            const passwordField = document.getElementById('passwordValue');
            if (passwordField) {
                passwordField.value = password;
            }
            
            this.logger.debug('UI loaded successfully');
        } catch (error) {
            this.logger.error('Error loading UI:', error);
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.popupInitializer = new PopupInitializer();
    window.popupInitializer.initialize();
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PopupInitializer,
        ServiceManager,
        SocialLinksManager,
        PasswordManager,
        CategoryManager,
        LocationManager,
        ResetManager,
        EventManager,
        PopupLogger,
        PopupUtils,
        POPUP_CONFIG
    };
}
