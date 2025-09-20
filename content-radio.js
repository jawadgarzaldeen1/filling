/**
 * Radio Button Handler for Social Filler Pro Extension
 * 
 * This module provides:
 * - Radio button selection enforcement
 * - Website-specific radio button handling
 * - Dynamic radio button detection
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

// ============================================================================
// RADIO BUTTON HANDLER CLASS
// ============================================================================

class RadioButtonHandler {
    constructor(logger) {
        this.logger = logger;
        this.isEnabled = true;
        this.enforcedSelections = new Map();
        this.observers = new Set();
    }

    /**
     * Initialize radio button handling
     */
    async initialize() {
        try {
            this.logger.info('Initializing radio button handler');
            
            // Load enforced selections from storage
            await this.loadEnforcedSelections();
            
            // Setup DOM observer for dynamic radio buttons
            this.setupDOMObserver();
            
            // Apply initial radio button selections
            await this.applyRadioButtonSelections();
            
            this.logger.info('Radio button handler initialized successfully');
        } catch (error) {
            this.logger.error('Error initializing radio button handler:', error);
        }
    }

    /**
     * Load enforced radio button selections from storage
     */
    async loadEnforcedSelections() {
        try {
            const result = await chrome.storage.sync.get('radioButtonSelections');
            const selections = result.radioButtonSelections || {};
            
            // Convert to Map for better performance
            this.enforcedSelections.clear();
            Object.entries(selections).forEach(([key, value]) => {
                this.enforcedSelections.set(key, value);
            });
            
            this.logger.debug(`Loaded ${this.enforcedSelections.size} enforced radio button selections`);
        } catch (error) {
            this.logger.error('Error loading enforced selections:', error);
        }
    }

    /**
     * Save enforced radio button selections to storage
     */
    async saveEnforcedSelections() {
        try {
            const selections = Object.fromEntries(this.enforcedSelections);
            await chrome.storage.sync.set({ radioButtonSelections: selections });
            this.logger.debug('Saved enforced radio button selections');
        } catch (error) {
            this.logger.error('Error saving enforced selections:', error);
        }
    }

    /**
     * Setup DOM observer for dynamic radio button changes
     */
    setupDOMObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'INPUT' && node.type === 'radio') {
                                shouldCheck = true;
                            } else if (node.querySelector && node.querySelector('input[type="radio"]')) {
                                shouldCheck = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldCheck) {
                this.logger.debug('New radio buttons detected, applying selections');
                setTimeout(() => {
                    this.applyRadioButtonSelections();
                }, 500);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.observers.add(observer);
        this.logger.debug('DOM observer setup for radio buttons');
    }

    /**
     * Apply radio button selections based on enforced rules
     */
    async applyRadioButtonSelections() {
        if (!this.isEnabled) {
            this.logger.debug('Radio button handling is disabled');
            return;
        }

        try {
            this.logger.info('Applying radio button selections');
            
            let totalApplied = 0;
            
            // Apply website-specific rules
            totalApplied += await this.applyWebsiteSpecificRules();
            
            // Apply general radio button rules
            totalApplied += await this.applyGeneralRules();
            
            if (totalApplied > 0) {
                this.logger.info(`Applied ${totalApplied} radio button selections`);
            } else {
                this.logger.debug('No radio button selections applied');
            }
            
        } catch (error) {
            this.logger.error('Error applying radio button selections:', error);
        }
    }

    /**
     * Apply website-specific radio button rules
     */
    async applyWebsiteSpecificRules() {
        const hostname = window.location.hostname;
        let appliedCount = 0;
        
        // Website-specific rules
        const websiteRules = {
            'allstatesusadirectory.com': {
                'input[name="agree"][value="yes"]': true,
                'input[name="terms"][value="accept"]': true
            },
            'hitwebdirectory.com': {
                'input[name="agreement"][value="1"]': true,
                'input[name="terms_accepted"][value="yes"]': true
            },
            'example.com': {
                'input[name="newsletter"][value="yes"]': true
            }
        };
        
        const rules = websiteRules[hostname];
        if (rules) {
            this.logger.debug(`Applying website-specific rules for ${hostname}`);
            
            for (const [selector, shouldSelect] of Object.entries(rules)) {
                if (shouldSelect) {
                    const applied = await this.selectRadioButton(selector);
                    if (applied) {
                        appliedCount++;
                    }
                }
            }
        }
        
        return appliedCount;
    }

    /**
     * Apply general radio button rules
     */
    async applyGeneralRules() {
        let appliedCount = 0;
        
        // Common patterns for agreement/terms radio buttons
        const commonPatterns = [
            'input[name*="agree"][value*="yes"]',
            'input[name*="terms"][value*="accept"]',
            'input[name*="accept"][value*="yes"]',
            'input[name*="consent"][value*="yes"]',
            'input[id*="agree"][value*="yes"]',
            'input[id*="terms"][value*="accept"]'
        ];
        
        for (const pattern of commonPatterns) {
            try {
                const elements = document.querySelectorAll(pattern);
                for (const element of elements) {
                    if (element.type === 'radio' && !element.checked) {
                        const applied = await this.selectRadioButton(element);
                        if (applied) {
                            appliedCount++;
                        }
                    }
                }
            } catch (error) {
                this.logger.warn(`Error applying pattern ${pattern}:`, error);
            }
        }
        
        return appliedCount;
    }

    /**
     * Select a radio button by selector or element
     */
    async selectRadioButton(selectorOrElement) {
        try {
            let element;
            
            if (typeof selectorOrElement === 'string') {
                element = document.querySelector(selectorOrElement);
            } else {
                element = selectorOrElement;
            }
            
            if (!element || element.type !== 'radio') {
                return false;
            }
            
            // Check if already selected
            if (element.checked) {
                return false;
            }
            
            // Select the radio button
            element.checked = true;
            
            // Trigger events
            this.triggerRadioButtonEvents(element);
            
            // Add visual feedback
            this.addVisualFeedback(element);
            
            this.logger.debug(`Selected radio button: ${this.getElementSelector(element)}`);
            return true;
            
        } catch (error) {
            this.logger.error('Error selecting radio button:', error);
            return false;
        }
    }

    /**
     * Trigger events for radio button selection
     */
    triggerRadioButtonEvents(element) {
        const events = ['change', 'click', 'input'];
        
        events.forEach(eventType => {
            const event = new Event(eventType, { 
                bubbles: true, 
                cancelable: true 
            });
            element.dispatchEvent(event);
        });
    }

    /**
     * Add visual feedback to selected radio button
     */
    addVisualFeedback(element) {
        const originalBorder = element.style.border;
        const originalBoxShadow = element.style.boxShadow;
        
        // Apply visual feedback
        element.style.border = '2px solid #4CAF50';
        element.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';
        element.style.transition = 'all 0.3s ease';
        
        // Remove visual feedback after delay
        setTimeout(() => {
            element.style.border = originalBorder;
            element.style.boxShadow = originalBoxShadow;
        }, 2000);
    }

    /**
     * Get CSS selector for element
     */
    getElementSelector(element) {
        if (element.id) return `#${element.id}`;
        if (element.name && element.value) return `input[name="${element.name}"][value="${element.value}"]`;
        if (element.name) return `input[name="${element.name}"]`;
        return element.tagName.toLowerCase();
    }

    /**
     * Add enforced selection rule
     */
    async addEnforcedSelection(selector, shouldSelect = true) {
        try {
            this.enforcedSelections.set(selector, shouldSelect);
            await this.saveEnforcedSelections();
            this.logger.info(`Added enforced selection rule: ${selector} = ${shouldSelect}`);
        } catch (error) {
            this.logger.error('Error adding enforced selection:', error);
        }
    }

    /**
     * Remove enforced selection rule
     */
    async removeEnforcedSelection(selector) {
        try {
            const removed = this.enforcedSelections.delete(selector);
            if (removed) {
                await this.saveEnforcedSelections();
                this.logger.info(`Removed enforced selection rule: ${selector}`);
            }
        } catch (error) {
            this.logger.error('Error removing enforced selection:', error);
        }
    }

    /**
     * Enable or disable radio button handling
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.logger.info(`Radio button handling ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            enforcedSelections: this.enforcedSelections.size,
            observers: this.observers.size,
            version: '7.0'
        };
    }

    /**
     * Cleanup observers
     */
    cleanup() {
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
        this.logger.debug('Radio button handler cleanup complete');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize radio button handler when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait for main content script to initialize
        setTimeout(() => {
            if (window.contentScript && window.contentScript.logger) {
                window.radioButtonHandler = new RadioButtonHandler(window.contentScript.logger);
                window.radioButtonHandler.initialize();
            }
        }, 1000);
    });
} else {
    // DOM already loaded
    setTimeout(() => {
        if (window.contentScript && window.contentScript.logger) {
            window.radioButtonHandler = new RadioButtonHandler(window.contentScript.logger);
            window.radioButtonHandler.initialize();
        }
    }, 1000);
}

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RadioButtonHandler
    };
}