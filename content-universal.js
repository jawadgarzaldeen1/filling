// Universal form filling functionality - works on any website
const UniversalFormFiller = {
    // Universal field patterns
    fieldPatterns: {
        title: {
            label: 'Title/Subject',
            keywords: ['title', 'subject', 'heading', 'name', 'ad_title', 'post_title', 'listing_title'],
            selectors: [
                'input[name*="title"]',
                'input[placeholder*="title"]',
                'input[name*="subject"]',
                'input[placeholder*="subject"]',
                'input[name*="heading"]',
                'input[id*="title"]',
                'input[class*="title"]'
            ]
        },
        description: {
            label: 'Description/Content',
            keywords: ['description', 'content', 'body', 'message', 'details', 'text'],
            selectors: [
                'textarea[name*="description"]',
                'textarea[placeholder*="description"]',
                'textarea[name*="content"]',
                'textarea[name*="body"]',
                'textarea[name*="message"]',
                'textarea[name*="details"]',
                '.mceContentBody',
                'div[contenteditable="true"]',
                'iframe[id*="mce"]'
            ]
        },
        price: {
            label: 'Price',
            keywords: ['price', 'cost', 'amount', 'fee'],
            selectors: [
                'input[name*="price"]',
                'input[placeholder*="price"]',
                'input[name*="cost"]',
                'input[name*="amount"]',
                'input[type="number"][name*="price"]'
            ]
        },
        phone: {
            label: 'Phone Number',
            keywords: ['phone', 'tel', 'mobile', 'contact'],
            selectors: [
                'input[type="tel"]',
                'input[name*="phone"]',
                'input[placeholder*="phone"]',
                'input[name*="mobile"]',
                'input[name*="contact"]'
            ],
            source: 'phone'
        },
        email: {
            label: 'Email Address',
            keywords: ['email', 'mail', '@'],
            selectors: [
                'input[type="email"]',
                'input[name*="email"]',
                'input[placeholder*="email"]',
                'input[name*="mail"]'
            ],
            source: 'email'
        },
        website: {
            label: 'Website URL',
            keywords: ['website', 'url', 'site', 'web'],
            selectors: [
                'input[type="url"]',
                'input[name*="website"]',
                'input[placeholder*="website"]',
                'input[name*="url"]',
                'input[name*="site"]'
            ],
            source: 'website'
        },
        facebook: {
            label: 'Facebook URL',
            keywords: ['facebook', 'fb'],
            selectors: [
                'input[name*="facebook"]',
                'input[placeholder*="facebook"]',
                'input[name*="fb"]'
            ],
            source: 'facebook'
        },
        instagram: {
            label: 'Instagram URL',
            keywords: ['instagram', 'insta', 'ig'],
            selectors: [
                'input[name*="instagram"]',
                'input[placeholder*="instagram"]',
                'input[name*="insta"]'
            ],
            source: 'instagram'
        },
        twitter: {
            label: 'Twitter/X URL',
            keywords: ['twitter', 'x.com'],
            selectors: [
                'input[name*="twitter"]',
                'input[placeholder*="twitter"]',
                'input[name*="x"]'
            ],
            source: 'twitter'
        },
        youtube: {
            label: 'YouTube URL',
            keywords: ['youtube', 'yt'],
            selectors: [
                'input[name*="youtube"]',
                'input[placeholder*="youtube"]',
                'input[name*="yt"]'
            ],
            source: 'youtube'
        },
        address: {
            label: 'Address',
            keywords: ['address', 'location', 'street'],
            selectors: [
                'input[name*="address"]',
                'input[placeholder*="address"]',
                'input[name*="location"]',
                'input[name*="street"]'
            ]
        },
        city: {
            label: 'City',
            keywords: ['city', 'town'],
            selectors: [
                'input[name*="city"]',
                'input[placeholder*="city"]',
                'input[name*="town"]'
            ]
        },
        zipcode: {
            label: 'ZIP Code',
            keywords: ['zip', 'postal', 'postcode'],
            selectors: [
                'input[name*="zip"]',
                'input[placeholder*="zip"]',
                'input[name*="postal"]',
                'input[name*="postcode"]'
            ]
        },
        company: {
            label: 'Company/Business Name',
            keywords: ['company', 'business', 'organization'],
            selectors: [
                'input[name*="company"]',
                'input[placeholder*="company"]',
                'input[name*="business"]',
                'input[name*="organization"]'
            ]
        }
    },

    findUniversalField(fieldConfig) {
        // Try exact selectors first
        for (const selector of fieldConfig.selectors) {
            try {
                const field = document.querySelector(selector);
                if (field && window.ExtensionCore.Utils.isElementVisible(field)) {
                    return field;
                }
            } catch (e) {
                // Invalid selector, continue
            }
        }
        
        // Fallback to keyword matching in attributes
        const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, select');
        for (const input of allInputs) {
            if (!window.ExtensionCore.Utils.isElementVisible(input)) continue;
            
            // Get searchable text from various attributes
            const searchText = [
                input.name || '',
                input.id || '',
                input.placeholder || '',
                input.className || '',
                input.getAttribute('aria-label') || '',
                input.getAttribute('data-testid') || '',
                input.getAttribute('data-name') || ''
            ].join(' ').toLowerCase();
            
            // Also check parent labels
            let labelText = '';
            if (input.id) {
                const labels = document.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`);
                labels.forEach(label => labelText += ' ' + (label.textContent || ''));
            }
            const parentLabel = input.closest('label');
            if (parentLabel) {
                labelText += ' ' + (parentLabel.textContent || '');
            }
            
            const fullSearchText = (searchText + ' ' + labelText.toLowerCase()).trim();
            
            // Check if any keyword matches
            for (const keyword of fieldConfig.keywords) {
                if (fullSearchText.includes(keyword.toLowerCase())) {
                    window.ExtensionCore.logger.log(`Found field for ${fieldConfig.label} using keyword "${keyword}":`, input);
                    return input;
                }
            }
        }
        
        return null;
    },

    fillRichTextEditor(field, value) {
        try {
            if (field.classList.contains('mceContentBody') || field.contentEditable === 'true') {
                field.innerHTML = value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            return false;
        } catch (error) {
            window.ExtensionCore.logger.error('Error filling rich text editor:', error);
            return false;
        }
    },

    fillTinyMCEIframe(iframe, value) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const body = iframeDoc.body;
            if (body) {
                body.innerHTML = value;
                body.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            return false;
        } catch (error) {
            window.ExtensionCore.logger.error('Error filling TinyMCE iframe:', error);
            return false;
        }
    },

    fillSelectField(field, value) {
        try {
            const options = Array.from(field.options);
            const matchingOption = options.find(option => 
                option.value.toLowerCase() === value.toLowerCase() ||
                option.text.toLowerCase().includes(value.toLowerCase())
            );
            
            if (matchingOption) {
                field.value = matchingOption.value;
                field.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            return false;
        } catch (error) {
            window.ExtensionCore.logger.error('Error filling select field:', error);
            return false;
        }
    },

    fillUniversalField(field, value, fieldType) {
        try {
            if (field.disabled || field.readOnly) {
                window.ExtensionCore.logger.warn(`Field for ${fieldType} is disabled/readonly:`, field);
                return false;
            }
            
            if (fieldType === 'description') {
                // Handle rich text editors
                if (field.classList.contains('mceContentBody') || field.contentEditable === 'true') {
                    return this.fillRichTextEditor(field, value);
                } else if (field.tagName.toLowerCase() === 'iframe') {
                    return this.fillTinyMCEIframe(field, value);
                }
            }
            
            if (field.tagName.toLowerCase() === 'select') {
                return this.fillSelectField(field, value);
            }
            
            // Handle regular fields
            return window.ExtensionCore.FieldFiller.fillSingleField(field, value);
        } catch (error) {
            window.ExtensionCore.logger.error(`Error filling universal field ${fieldType}:`, error);
            return false;
        }
    },

    async fillAllForms() {
        if (!window.ExtensionCore.ExtensionState.contextValid) {
            window.ExtensionCore.logger.warn("Context invalid, skipping universal form fill");
            return;
        }
        
        const universalFormData = window.ExtensionCore.ExtensionState.universalFormData;
        if (Object.keys(universalFormData).length === 0) {
            window.ExtensionCore.logger.log("No universal form data to fill");
            return;
        }
        
        window.ExtensionCore.logger.log("Starting universal form fill on:", window.location.hostname);
        let filledCount = 0;
        
        // Try to fill each field type
        Object.entries(this.fieldPatterns).forEach(([fieldKey, fieldConfig]) => {
            let value = universalFormData[fieldKey];
            
            // If no direct value, try to get from social links
            if (!value && fieldConfig.source && window.ExtensionCore.ExtensionState.socialLinksData[fieldConfig.source]) {
                value = window.ExtensionCore.ExtensionState.socialLinksData[fieldConfig.source];
            }
            
            if (!value) return;
            
            const field = this.findUniversalField(fieldConfig);
            if (field) {
                const success = this.fillUniversalField(field, value, fieldKey);
                if (success) {
                    filledCount++;
                    window.ExtensionCore.logger.log(`✓ Filled ${fieldKey}: ${fieldConfig.label}`);
                }
            } else {
                window.ExtensionCore.logger.log(`- No field found for ${fieldKey}: ${fieldConfig.label}`);
            }
        });
        
        if (filledCount > 0) {
            window.ExtensionCore.logger.log(`Successfully filled ${filledCount} fields on ${window.location.hostname}`);
        } else {
            window.ExtensionCore.logger.log("No suitable fields found to fill on this page");
        }
    },

    hasDetectableForms() {
        const forms = document.querySelectorAll('form');
        if (forms.length === 0) return false;
        
        // Check if any forms have input fields we can potentially fill
        const fillableInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea');
        return fillableInputs.length > 0;
    }
};

// Enhanced observer for universal forms
const UniversalFormObserver = {
    setup() {
        const observer = window.ExtensionCore.ObserverManager.createObserver('universalForms', (mutations) => {
            const relevantChanges = mutations.some(mutation =>
                Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    (node.tagName === 'FORM' || 
                     node.tagName === 'INPUT' || 
                     node.tagName === 'TEXTAREA' || 
                     node.tagName === 'SELECT' ||
                     node.classList?.contains('mceContentBody') ||
                     node.contentEditable === 'true' ||
                     node.querySelector('form, input, textarea, select, .mceContentBody, [contenteditable="true"]'))
                )
            );

            if (relevantChanges) {
                window.ExtensionCore.logger.log("Form elements detected in DOM, scheduling fill...");
                window.ExtensionCore.FieldFiller.fillFields(); // Fill social links
                UniversalFormFiller.fillAllForms(); // Fill universal forms
            }
        }, { debounceDelay: 800 });

        // Start observing
        if (document.body) {
            window.ExtensionCore.ObserverManager.startObserver('universalForms', document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'id', 'name', 'contenteditable']
            });
        } else {
            const bodyCheckInterval = setInterval(() => {
                if (document.body) {
                    clearInterval(bodyCheckInterval);
                    window.ExtensionCore.ObserverManager.startObserver('universalForms', document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['class', 'id', 'name', 'contenteditable']
                    });
                    window.ExtensionCore.logger.log("Universal form observer started (delayed)");
                }
            }, 100);
        }
    }
};

// Initialize universal form filling
const UniversalFormInitializer = {
    async initialize() {
        // Wait for core to be available
        if (!window.ExtensionCore) {
            setTimeout(() => this.initialize(), 100);
            return;
        }

        // Load universal form data
        await window.ExtensionCore.DataLoader.loadUniversalFormData();
        
        // Setup observer
        UniversalFormObserver.setup();
        
        // Fill forms if this page has any
        if (UniversalFormFiller.hasDetectableForms()) {
            window.ExtensionCore.logger.log("Detectable forms found, scheduling fill...");
            
            // Wait for social links to load first, then fill universal forms
            setTimeout(() => {
                UniversalFormFiller.fillAllForms();
            }, 1500);
        } else {
            window.ExtensionCore.logger.log("No detectable forms on this page");
        }
        
        window.ExtensionCore.logger.log("Universal form filling system initialized");
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        UniversalFormInitializer.initialize();
    });
} else {
    UniversalFormInitializer.initialize();
}

// Export for global access
window.UniversalFormFiller = UniversalFormFiller;
