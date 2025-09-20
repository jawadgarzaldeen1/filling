// Core content script functionality - optimized and modular
const logger = {
    log: (...args) => console.log('[FILLER]', new Date().toLocaleTimeString(), ...args),
    warn: (...args) => console.warn('[FILLER]', ...args),
    error: (...args) => console.error('[FILLER]', ...args)
};

// Global state management
const ExtensionState = {
    contextValid: true,
    servicesConfig: {},
    socialLinksData: {},
    fillPasswordValue: null,
    universalFormData: {}
};

// Utility functions
const Utils = {
    isElementVisible(element) {
        if (!element) return false;
        return element.offsetParent !== null;
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Field detection and scoring system
const FieldDetector = {
    scoreField(field, serviceName, serviceKeywords = []) {
        if (!field) return -1000;
        
        let score = 0;
        const allKeywords = [serviceName, ...serviceKeywords];
        
        // Direct matches
        if (field.dataset && field.dataset.service?.toLowerCase() === serviceName.toLowerCase()) score += 100;
        if (field.id?.toLowerCase() === serviceName.toLowerCase()) score += 90;
        if (field.name?.toLowerCase() === serviceName.toLowerCase()) score += 80;

        // Keyword matches
        const placeholder = field.placeholder || '';
        const ariaLabel = field.getAttribute('aria-label') || '';
        let labelText = '';

        // Get associated label text
        if (field.id) {
            const labels = document.querySelectorAll(`label[for="${CSS.escape(field.id)}"]`);
            labels.forEach(lbl => labelText += ' ' + (lbl.textContent || ''));
        }
        const parentLabel = field.closest('label');
        if (parentLabel) {
            labelText += ' ' + (parentLabel.textContent || '');
        }

        // Score keyword matches
        if (this.matchesKeywords(placeholder, allKeywords)) score += 60;
        if (this.matchesKeywords(ariaLabel, allKeywords)) score += 50;
        if (this.matchesKeywords(labelText, allKeywords)) score += 40;

        // Penalize password fields unless explicitly for passwords
        if (field.type === 'password' && serviceName.toLowerCase() !== 'password') {
            score -= 1000;
        }

        // Penalize hidden or disabled fields
        if (!Utils.isElementVisible(field) || field.disabled) {
            score -= 1000;
        }

        return score;
    },

    matchesKeywords(text, keywords) {
        if (!text) return false;
        text = text.toLowerCase();
        return keywords.some(kw => text.includes(kw.toLowerCase()));
    },

    findFieldForService(serviceName, serviceKeywords = []) {
        logger.log(`Attempting to find field for service: ${serviceName}`);
        
        const potentialFields = document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea');
        
        const scoredFields = Array.from(potentialFields)
            .map(field => ({ field, score: this.scoreField(field, serviceName, serviceKeywords) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score);

        const bestMatch = scoredFields[0]?.field;
        if (bestMatch) {
            logger.log(`Found field for ${serviceName} with score ${scoredFields[0].score}`);
            return bestMatch;
        }

        logger.log(`No suitable field found for ${serviceName}`);
        return null;
    }
};

// Field filling functionality
const FieldFiller = {
    fillSingleField(field, value) {
        if (!field || !Utils.isElementVisible(field)) {
            logger.warn('Attempted to fill non-visible or null field');
            return false;
        }
        
        try {
            if (field.disabled) {
                logger.warn('Attempted to fill disabled field:', field);
                return false;
            }

            // Set the value
            field.value = value;
            
            // Dispatch events common frameworks might listen for
            field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            field.focus();
            field.blur();

            // Add visual feedback
            field.style.boxShadow = '0 0 5px green';
            setTimeout(() => { field.style.boxShadow = ''; }, 2000);
            
            logger.log('Field filled successfully:', {
                type: 'FIELD_FILLED',
                field: {
                    id: field.id || "no-id",
                    name: field.name || "no-name",
                    type: field.type || "unknown-type",
                    value: field.type === 'password' ? '********' : value
                }
            });
            
            return true;
        } catch (error) {
            logger.error('Error filling field:', error, field);
            return false;
        }
    },

    async fillFields() {
        if (!ExtensionState.contextValid) {
            logger.warn("Context invalid, skipping fill.");
            return;
        }
        
        if (Object.keys(ExtensionState.socialLinksData).length === 0 && !ExtensionState.fillPasswordValue) {
            logger.log("No social links or password data to fill.");
            return;
        }

        logger.log('Starting field filling process with data:', { 
            links: ExtensionState.socialLinksData, 
            hasPassword: !!ExtensionState.fillPasswordValue 
        });

        // Fill social link fields
        for (const [serviceName, url] of Object.entries(ExtensionState.socialLinksData)) {
            if (!url) continue;

            const serviceKeywords = ExtensionState.servicesConfig[serviceName]?.keywords || [];
            const field = FieldDetector.findFieldForService(serviceName, serviceKeywords);

            if (field && field.value !== url) {
                logger.log(`Filling field for ${serviceName}`);
                this.fillSingleField(field, url);
            } else if (field && field.value === url) {
                logger.log(`Field for ${serviceName} already has the correct value.`);
            }
        }

        // Fill password fields if enabled and value exists
        if (ExtensionState.fillPasswordValue) {
            const passwordFields = document.querySelectorAll('input[type="password"]');
            logger.log(`Found ${passwordFields.length} password fields.`);
            
            passwordFields.forEach(field => {
                if (Utils.isElementVisible(field) && field.value !== ExtensionState.fillPasswordValue) {
                    logger.log("Filling password field:", field.id || field.name || "unnamed field");
                    this.fillSingleField(field, ExtensionState.fillPasswordValue);
                } else if (Utils.isElementVisible(field) && field.value === ExtensionState.fillPasswordValue) {
                    logger.log("Password field already has the correct value:", field.id || field.name || "unnamed field");
                }
            });
        }

        logger.log('Field filling attempt finished.');
    }
};

// Data loading functionality
const DataLoader = {
    async loadServicesConfig() {
        try {
            const servicesResponse = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: "GET_SERVICES" }, resolve);
            });
            
            if (servicesResponse?.services) {
                ExtensionState.servicesConfig = servicesResponse.services;
                // Convert stored patterns back to RegExp objects
                Object.values(ExtensionState.servicesConfig).forEach(config => {
                    if (config.patterns && Array.isArray(config.patterns)) {
                        config.patterns = config.patterns.map(p => {
                            if (!p || !p.source) return null;
                            try {
                                return new RegExp(p.source, p.flags || 'i');
                            } catch (e) {
                                logger.error("Error converting pattern:", p, e);
                                return null;
                            }
                        }).filter(Boolean);
                    }
                });
            }
        } catch (error) {
            logger.error("Error loading services config:", error);
        }
    },

    async loadSocialLinks() {
        try {
            const linksResponse = await chrome.storage.sync.get('socialLinks');
            ExtensionState.socialLinksData = linksResponse?.socialLinks || {};
            logger.log("Social links loaded:", ExtensionState.socialLinksData);
        } catch (error) {
            logger.error("Error loading social links:", error);
        }
    },

    async loadPassword() {
        try {
            const passwordResponse = await chrome.storage.sync.get('fillPassword');
            ExtensionState.fillPasswordValue = passwordResponse?.fillPassword || null;
            logger.log("Password setting loaded:", ExtensionState.fillPasswordValue ? 'Password present' : 'No password');
        } catch (error) {
            logger.error("Error loading password:", error);
        }
    },

    async loadUniversalFormData() {
        try {
            const response = await chrome.storage.sync.get('universalFormData');
            ExtensionState.universalFormData = response?.universalFormData || {};
            logger.log("Universal form data loaded:", ExtensionState.universalFormData);
        } catch (error) {
            logger.error("Error loading universal form data:", error);
        }
    },

    async loadAllData() {
        logger.log("Loading initial data...");
        try {
            await Promise.all([
                this.loadServicesConfig(),
                this.loadSocialLinks(),
                this.loadPassword(),
                this.loadUniversalFormData()
            ]);
            
            // Trigger initial fill after loading all data
            await FieldFiller.fillFields();
        } catch (error) {
            logger.error("Error loading data from storage:", error);
        }
    }
};

// Message handling
const MessageHandler = {
    handleMessage(message, sender, sendResponse) {
        if (message.type === 'CONTEXT_INVALID') {
            ExtensionState.contextValid = false;
            logger.warn('Context invalidated by background worker. Reload page recommended.');
            ObserverManager.stopAll();
        } else if (message.type === 'SERVICES_UPDATED') {
            logger.log('Services configuration updated, reloading data...');
            DataLoader.loadAllData();
        } else if (message.type === 'UNIVERSAL_FORM_DATA_UPDATED') {
            logger.log('Universal form data updated');
            ExtensionState.universalFormData = message.data || {};
            setTimeout(() => {
                UniversalFormFiller.fillAllForms();
            }, 500);
        }
        
        return true;
    }
};

// Observer management
const ObserverManager = {
    observers: new Map(),
    
    createObserver(name, callback, options = {}) {
        const debouncedCallback = Utils.debounce(callback, options.debounceDelay || 500);
        
        const observer = new MutationObserver(debouncedCallback);
        this.observers.set(name, observer);
        return observer;
    },
    
    startObserver(name, target, options) {
        const observer = this.observers.get(name);
        if (observer && target) {
            observer.observe(target, options);
            logger.log(`Observer ${name} started`);
        }
    },
    
    stopObserver(name) {
        const observer = this.observers.get(name);
        if (observer) {
            observer.disconnect();
            logger.log(`Observer ${name} stopped`);
        }
    },
    
    stopAll() {
        this.observers.forEach((observer, name) => {
            observer.disconnect();
            logger.log(`Observer ${name} stopped`);
        });
        this.observers.clear();
    }
};

// Initialize core functionality
const CoreInitializer = {
    async initialize() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupObservers();
                DataLoader.loadAllData();
            });
        } else {
            this.setupObservers();
            await DataLoader.loadAllData();
        }
        
        // Setup message listener
        chrome.runtime.onMessage.addListener(MessageHandler.handleMessage);
        
        logger.log("Core content script initialized");
    },
    
    setupObservers() {
        // Main form observer
        const formObserver = ObserverManager.createObserver('forms', (mutations) => {
            const addedNodes = mutations.some(mutation =>
                Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || 
                     node.tagName === 'FORM' || node.querySelector('input, textarea, form'))
                )
            );

            if (addedNodes) {
                logger.log("DOM changed, scheduling fillFields...");
                FieldFiller.fillFields();
            }
        }, { debounceDelay: 500 });

        // Start observing
        if (document.body) {
            ObserverManager.startObserver('forms', document.body, {
                childList: true,
                subtree: true
            });
        } else {
            const bodyCheckInterval = setInterval(() => {
                if (document.body) {
                    clearInterval(bodyCheckInterval);
                    ObserverManager.startObserver('forms', document.body, {
                        childList: true,
                        subtree: true
                    });
                    logger.log("Body available, starting observer");
                }
            }, 100);
        }
    }
};

// Export for use in other modules
window.ExtensionCore = {
    ExtensionState,
    Utils,
    FieldDetector,
    FieldFiller,
    DataLoader,
    MessageHandler,
    ObserverManager,
    CoreInitializer,
    logger
};

// Auto-initialize
CoreInitializer.initialize();
