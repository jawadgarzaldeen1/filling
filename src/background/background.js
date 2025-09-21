/**
 * Background Service Worker for Social Filler Pro Extension
 * 
 * This module handles:
 * - Extension lifecycle events
 * - Inter-script communication
 * - Storage management
 * - Tab notifications
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

import { EXTENSION_CONFIG } from '../common/config.js';

// ============================================================================
// UTILITY CLASSES
// ============================================================================

/**
 * Enhanced logging system with configurable levels
 */
class Logger {
    constructor(context = 'Background') {
        this.context = context;
        this.logLevel = EXTENSION_CONFIG.LOG_LEVELS.INFO;
        this.errorCount = 0;
        this.errorResetInterval = setInterval(() => {
            this.errorCount = 0;
        }, 60000); // Reset error count every minute
    }

    setLogLevel(level) {
        this.logLevel = typeof level === 'string' 
            ? EXTENSION_CONFIG.LOG_LEVELS[level.toUpperCase()] 
            : level;
    }

    async log(level, message, ...args) {
        const levelNum = typeof level === 'string' 
            ? EXTENSION_CONFIG.LOG_LEVELS[level.toUpperCase()] 
            : level;
        
        if (levelNum <= this.logLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${this.context}]`;
            
            // Track error frequency
            if (levelNum === EXTENSION_CONFIG.LOG_LEVELS.ERROR) {
                this.errorCount++;
                
                // If too many errors occur, notify user and reduce logging
                if (this.errorCount > 10) {
                    try {
                        await chrome.notifications.create({
                            type: 'basic',
                            iconUrl: '/icons/icon48.svg',
                            title: 'Social Filler Pro Warning',
                            message: 'Multiple errors detected. Check console for details.'
                        });
                        return; // Skip logging to prevent console spam
                    } catch (e) {
                        // Fallback if notifications fail
                        console.error(prefix, 'Failed to show notification:', e);
                    }
                }
            }
            
            try {
                switch (levelNum) {
                    case EXTENSION_CONFIG.LOG_LEVELS.ERROR:
                        console.error(prefix, message, ...args);
                        break;
                    case EXTENSION_CONFIG.LOG_LEVELS.WARN:
                        console.warn(prefix, message, ...args);
                        break;
                    case EXTENSION_CONFIG.LOG_LEVELS.INFO:
                        console.info(prefix, message, ...args);
                        break;
                    case EXTENSION_CONFIG.LOG_LEVELS.DEBUG:
                        console.debug(prefix, message, ...args);
                        break;
                }
            } catch (e) {
                // Fallback logging if console methods fail
                console.log(prefix, `[${level}]`, message, ...args);
            }
        }
    }

    destroy() {
        clearInterval(this.errorResetInterval);
    }

    error(message, ...args) { this.log(EXTENSION_CONFIG.LOG_LEVELS.ERROR, message, ...args); }
    warn(message, ...args) { this.log(EXTENSION_CONFIG.LOG_LEVELS.WARN, message, ...args); }
    info(message, ...args) { this.log(EXTENSION_CONFIG.LOG_LEVELS.INFO, message, ...args); }
    debug(message, ...args) { this.log(EXTENSION_CONFIG.LOG_LEVELS.DEBUG, message, ...args); }
}

/**
 * Promise-based storage operations with error handling
 */
class StorageManager {
    constructor(logger) {
        this.logger = logger;
    }

    async get(keys = null) {
        try {
            const result = await chrome.storage.sync.get(keys);
            this.logger.debug('Storage get successful:', keys, result);
            return result;
        } catch (error) {
            this.logger.error('Storage get failed:', error);
            throw new Error(`Failed to retrieve data: ${error.message}`);
        }
    }

    async set(data) {
        try {
            await chrome.storage.sync.set(data);
            this.logger.debug('Storage set successful:', data);
            return true;
        } catch (error) {
            this.logger.error('Storage set failed:', error);
            throw new Error(`Failed to save data: ${error.message}`);
        }
    }

    async clear() {
        try {
            await chrome.storage.sync.clear();
            this.logger.info('Storage cleared successfully');
            return true;
        } catch (error) {
            this.logger.error('Storage clear failed:', error);
            throw new Error(`Failed to clear storage: ${error.message}`);
        }
    }
}

/**
 * Tab management utilities
 */
class TabManager {
    constructor(logger) {
        this.logger = logger;
    }

    async getAllTabs() {
        try {
            const tabs = await chrome.tabs.query({});
            this.logger.debug(`Retrieved ${tabs.length} tabs`);
            return tabs;
        } catch (error) {
            this.logger.error('Failed to get tabs:', error);
            throw new Error(`Failed to retrieve tabs: ${error.message}`);
        }
    }

    async sendMessageToAllTabs(message) {
        try {
            const tabs = await this.getAllTabs();
            const notifications = tabs
                .filter(tab => tab.id)
                .map(tab => this.sendMessageToTab(tab.id, message));
            
            const results = await Promise.allSettled(notifications);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            this.logger.info(`Message sent to ${successful} tabs, ${failed} failed`);
            return { successful, failed, results };
        } catch (error) {
            this.logger.error('Failed to send message to all tabs:', error);
            throw new Error(`Failed to notify tabs: ${error.message}`);
        }
    }

    async sendMessageToTab(tabId, message) {
        try {
            await chrome.tabs.sendMessage(tabId, message);
            this.logger.debug(`Message sent to tab ${tabId}:`, message.type);
            return { tabId, success: true };
        } catch (error) {
            this.logger.debug(`Failed to send message to tab ${tabId}:`, error.message);
            return { tabId, success: false, error: error.message };
        }
    }
}

// ============================================================================
// MAIN BACKGROUND SERVICE WORKER
// ============================================================================

class BackgroundServiceWorker {
    constructor() {
        this.logger = new Logger('BackgroundServiceWorker');
        this.storage = new StorageManager(this.logger);
        this.tabManager = new TabManager(this.logger);
        this.isInitialized = false;
        
        this.initialize();
    }

    /**
     * Initialize the background service worker
     */
    async initialize() {
        try {
            this.logger.info(`Initializing Social Filler Pro v${EXTENSION_CONFIG.VERSION}`);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize storage with defaults
            await this.initializeStorage();
            
            this.isInitialized = true;
            this.logger.info('Background service worker initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize background service worker:', error);
        }
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Extension lifecycle events
        chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this));
        chrome.runtime.onStartup.addListener(this.handleStartup.bind(this));
        
        // Message handling
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        
        // Storage change notifications
        chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));
        
        this.logger.debug('Event listeners setup complete');
    }

    /**
     * Handle extension installation
     */
    async handleInstall(details) {
        try {
            this.logger.info('Extension installed/updated:', details.reason);
            
            switch (details.reason) {
                case 'install':
                    await this.handleFirstInstall();
                    break;
                case 'update':
                    await this.handleUpdate(details.previousVersion);
                    break;
                case 'chrome_update':
                    await this.handleChromeUpdate();
                    break;
            }
        } catch (error) {
            this.logger.error('Error handling install event:', error);
        }
    }

    /**
     * Handle first installation
     */
    async handleFirstInstall() {
        try {
            this.logger.info('First installation - setting up defaults');
            await this.initializeStorage();
            
            // Notify all tabs about the new extension
            await this.tabManager.sendMessageToAllTabs({
                type: EXTENSION_CONFIG.MESSAGE_TYPES.SERVICES_UPDATED,
                message: 'Extension installed successfully'
            });
        } catch (error) {
            this.logger.error('Error during first install:', error);
        }
    }

    /**
     * Handle extension update
     */
    async handleUpdate(previousVersion) {
        try {
            this.logger.info(`Extension updated from ${previousVersion} to ${EXTENSION_CONFIG.VERSION}`);
            
            // Perform any necessary migrations
            await this.performMigrations(previousVersion);
            
            // Notify tabs about the update
            await this.tabManager.sendMessageToAllTabs({
                type: EXTENSION_CONFIG.MESSAGE_TYPES.SERVICES_UPDATED,
                message: `Extension updated to v${EXTENSION_CONFIG.VERSION}`
            });
        } catch (error) {
            this.logger.error('Error during update:', error);
        }
    }

    /**
     * Handle Chrome browser update
     */
    async handleChromeUpdate() {
        try {
            this.logger.info('Chrome browser updated - checking compatibility');
            // Add any Chrome-specific update logic here
        } catch (error) {
            this.logger.error('Error during Chrome update:', error);
        }
    }

    /**
     * Handle extension startup
     */
    async handleStartup() {
        try {
            this.logger.info('Extension startup');
            await this.initializeStorage();
        } catch (error) {
            this.logger.error('Error during startup:', error);
        }
    }

    /**
     * Initialize storage with default values
     */
    async initializeStorage() {
        try {
            const existingData = await this.storage.get();
            
            // Set default services if not present
            if (!existingData[EXTENSION_CONFIG.STORAGE_KEYS.SERVICES]) {
                await this.storage.set({
                    [EXTENSION_CONFIG.STORAGE_KEYS.SERVICES]: EXTENSION_CONFIG.DEFAULT_SERVICES
                });
                this.logger.info('Default services initialized');
            }

            // Set default settings if not present
            if (!existingData[EXTENSION_CONFIG.STORAGE_KEYS.SETTINGS]) {
                const defaultSettings = {
                    // Automatically fill forms when a page loads.
                    autoFillOnLoad: true,
                    // Show visual feedback (e.g., highlighting) when fields are filled.
                    showVisualFeedback: true,
                    // Enable debug logging for troubleshooting.
                    debugMode: false,
                    // Delay in milliseconds before filling a form.
                    fillDelay: 500,
                    // Automatically normalize URLs to a consistent format.
                    autoNormalizeUrls: true,
                    // Validate URLs before attempting to fill them.
                    validateUrls: true,
                    // Enforce strict matching for field detection.
                    strictMode: true,
                    // Perform case-sensitive matching for field labels.
                    caseSensitive: false,
                    // Threshold for fuzzy matching of field labels (0.0 to 1.0).
                    similarityThreshold: 0.8,
                    // Automatically generate descriptions for social media posts.
                    autoGenerateDescriptions: true,
                    // Overwrite user-made changes in a form.
                    overwriteUserChanges: false,
                    // The default template to use for filling forms. 'auto' means detect automatically.
                    defaultTemplate: 'auto',
                    // The minimum length for automatically generated descriptions.
                    descriptionMinLength: 20,
                    // Automatically parse imported data.
                    autoParseOnImport: true,
                    // Show warnings during the import process.
                    showImportWarnings: true,
                    // Timeout in seconds for the import process.
                    importTimeout: 30,
                    // The level of detail for logging (e.g., 'info', 'debug', 'warn', 'error').
                    logLevel: 'info',
                    // The number of recent operations to cache for performance.
                    cacheSize: 10,
                    // The interval in minutes to check for extension updates.
                    updateInterval: 5
                };
                
                await this.storage.set({
                    [EXTENSION_CONFIG.STORAGE_KEYS.SETTINGS]: defaultSettings
                });
                this.logger.info('Default settings initialized');
            }

            this.logger.debug('Storage initialization complete');
        } catch (error) {
            this.logger.error('Failed to initialize storage:', error);
            // Fallback: try to set at least the essential defaults
            try {
                await this.storage.set({
                    [EXTENSION_CONFIG.STORAGE_KEYS.SERVICES]: EXTENSION_CONFIG.DEFAULT_SERVICES,
                    [EXTENSION_CONFIG.STORAGE_KEYS.PASSWORD]: ''
                });
                this.logger.warn('Fallback storage initialization completed');
            } catch (fallbackError) {
                this.logger.error('Fallback storage initialization failed:', fallbackError);
            }
        }
    }

    /**
     * Perform data migrations between versions
     */
    async performMigrations(previousVersion) {
        try {
            this.logger.info(`Performing migrations from ${previousVersion}`);
            
            // Example migration: Convert old social links format to new array format
            const { socialLinks } = await this.storage.get(EXTENSION_CONFIG.STORAGE_KEYS.SOCIAL_LINKS);
            if (socialLinks && !Array.isArray(socialLinks)) {
                const migratedLinks = Object.entries(socialLinks).map(([platform, url]) => ({
                    id: this.generateId(),
                    platform: platform.toLowerCase(),
                    url: url,
                    addedAt: Date.now(),
                    isActive: true
                }));
                
                await this.storage.set({
                    [EXTENSION_CONFIG.STORAGE_KEYS.SOCIAL_LINKS]: migratedLinks
                });
                
                this.logger.info(`Migrated ${migratedLinks.length} social links to new format`);
            }
            
            this.logger.info('Migrations completed successfully');
        } catch (error) {
            this.logger.error('Error during migrations:', error);
        }
    }

    /**
     * Handle incoming messages from content scripts and popup
     */
    handleMessage(message, sender, sendResponse) {
        this.logger.debug('Message received:', message.type, sender.tab?.id);

        // Use async handler for better error handling
        this.handleAsyncMessage(message, sender)
            .then(result => sendResponse(result))
            .catch(error => {
                this.logger.error('Error handling message:', error);
                sendResponse({ success: false, error: error.message });
            });

        // Return true to indicate we will send a response asynchronously
        return true;
    }

    /**
     * Async message handler
     */
    async handleAsyncMessage(message, sender) {
        try {
            switch (message.type) {
                case EXTENSION_CONFIG.MESSAGE_TYPES.GET_SERVICES:
                    return await this.handleGetServices();
                
                case EXTENSION_CONFIG.MESSAGE_TYPES.RESET_SERVICES:
                    return await this.handleResetServices();
                
                default:
                    this.logger.warn('Unknown message type:', message.type);
                    return { success: false, error: 'Unknown message type' };
            }
        } catch (error) {
            this.logger.error('Error in async message handler:', error);
            throw error;
        }
    }

    /**
     * Handle GET_SERVICES message
     */
    async handleGetServices() {
        try {
            const result = await this.storage.get(EXTENSION_CONFIG.STORAGE_KEYS.SERVICES);
            const services = result[EXTENSION_CONFIG.STORAGE_KEYS.SERVICES] || EXTENSION_CONFIG.DEFAULT_SERVICES;
            
            this.logger.debug('Services requested, returning:', Object.keys(services).length, 'services');
            return { services };
        } catch (error) {
            this.logger.error('Error getting services:', error);
            throw new Error('Failed to retrieve services');
        }
    }

    /**
     * Handle RESET_SERVICES_TO_DEFAULT message
     */
    async handleResetServices() {
        try {
            this.logger.info('Resetting services to default');
            
            await this.storage.set({
                [EXTENSION_CONFIG.STORAGE_KEYS.SERVICES]: EXTENSION_CONFIG.DEFAULT_SERVICES,
                [EXTENSION_CONFIG.STORAGE_KEYS.PASSWORD]: ''
            });
            
            // Notify all tabs about the reset
            const notificationResult = await this.tabManager.sendMessageToAllTabs({
                type: EXTENSION_CONFIG.MESSAGE_TYPES.SERVICES_UPDATED,
                message: 'Services configuration reset to default'
            });
            
            this.logger.info('Services reset complete, notified tabs:', notificationResult);
            return { success: true };
        } catch (error) {
            this.logger.error('Error resetting services:', error);
            throw new Error('Failed to reset services');
        }
    }

    /**
     * Handle storage change events
     */
    async handleStorageChange(changes, areaName) {
        try {
            this.logger.debug('Storage changed:', Object.keys(changes), 'in', areaName);
            
            // Notify tabs about relevant changes
            const notifications = [];
            
            if (changes[EXTENSION_CONFIG.STORAGE_KEYS.SERVICES]) {
                notifications.push({
                    type: EXTENSION_CONFIG.MESSAGE_TYPES.SERVICES_UPDATED,
                    message: 'Services configuration updated'
                });
            }
            
            if (changes[EXTENSION_CONFIG.STORAGE_KEYS.UNIVERSAL_FORM_DATA]) {
                notifications.push({
                    type: EXTENSION_CONFIG.MESSAGE_TYPES.UNIVERSAL_FORM_DATA_UPDATED,
                    data: changes[EXTENSION_CONFIG.STORAGE_KEYS.UNIVERSAL_FORM_DATA].newValue
                });
            }
            
            if (changes[EXTENSION_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY]) {
                notifications.push({
                    type: EXTENSION_CONFIG.MESSAGE_TYPES.CATEGORY_UPDATED,
                    category: changes[EXTENSION_CONFIG.STORAGE_KEYS.SELECTED_CATEGORY].newValue
                });
            }
            
            if (changes[EXTENSION_CONFIG.STORAGE_KEYS.SELECTED_LOCATION]) {
                notifications.push({
                    type: EXTENSION_CONFIG.MESSAGE_TYPES.LOCATION_UPDATED,
                    location: changes[EXTENSION_CONFIG.STORAGE_KEYS.SELECTED_LOCATION].newValue
                });
            }
            
            if (changes[EXTENSION_CONFIG.STORAGE_KEYS.SETTINGS]) {
                notifications.push({
                    type: EXTENSION_CONFIG.MESSAGE_TYPES.SETTINGS_UPDATED,
                    settings: changes[EXTENSION_CONFIG.STORAGE_KEYS.SETTINGS].newValue
                });
            }
            
            // Send all notifications
            for (const notification of notifications) {
                await this.tabManager.sendMessageToAllTabs(notification);
            }
            
        } catch (error) {
            this.logger.error('Error handling storage change:', error);
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return crypto.randomUUID();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize the background service worker
const backgroundWorker = new BackgroundServiceWorker();

// Export for testing purposes (if in test environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BackgroundServiceWorker,
        Logger,
        StorageManager,
        TabManager,
        EXTENSION_CONFIG
    };
}
