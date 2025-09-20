
const logger = {
    log: (...args) => console.log('[FILLER]', new Date().toLocaleTimeString(), ...args),
    warn: (...args) => console.warn('[FILLER]', ...args),
    error: (...args) => console.error('[FILLER]', ...args)
};

let extensionContextValid = true;
let servicesConfig = {}; // Store loaded services config (name -> config)
let socialLinksData = {}; // Store loaded social links (name -> url)
let fillPasswordValue = null; // Store password value

// Helper function to check visibility (simplified)
function isElementVisible(element) {
    if (!element) return false; // Add null check
    // Basic check: offsetParent is not null
    return element.offsetParent !== null;
}

// Function to find the input field for a specific service
function findFieldForService(serviceName, serviceKeywords = []) {
    logger.log(`Attempting to find field for service: ${serviceName}`);
    const fields = [];

    // Helper to check if field matches keywords
    const matchesKeywords = (text, keywords) => {
        if (!text) return false;
        text = text.toLowerCase();
        return keywords.some(kw => text.includes(kw.toLowerCase()));
    };

    // Helper to score a field's relevance
    const scoreField = (field) => {
        if (!field) return -1000; // Add null check
        
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
        if (matchesKeywords(placeholder, allKeywords)) score += 60;
        if (matchesKeywords(ariaLabel, allKeywords)) score += 50;
        if (matchesKeywords(labelText, allKeywords)) score += 40;

        // Penalize password fields unless explicitly for passwords
        if (field.type === 'password' && serviceName.toLowerCase() !== 'password') {
            score -= 1000;
        }

        // Penalize hidden or disabled fields
        if (!isElementVisible(field) || field.disabled) {
            score -= 1000;
        }

        return score;
    };

    // Find all potential input fields
    const potentialFields = document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea');
    
    // Score and sort fields
    const scoredFields = Array.from(potentialFields)
        .map(field => ({ field, score: scoreField(field) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);

    // Return the highest scoring field, if any
    const bestMatch = scoredFields[0]?.field;
    if (bestMatch) {
        logger.log(`Found field for ${serviceName} with score ${scoredFields[0].score}`);
        return bestMatch;
    }

    logger.log(`No suitable field found for ${serviceName}`);
    return null;
}

// Main function to fill fields (Simplified)
async function fillFields() {
     if (!extensionContextValid) {
         logger.warn("Context invalid, skipping fill.");
         return;
     }
     if (Object.keys(socialLinksData).length === 0 && !fillPasswordValue) {
         logger.log("No social links or password data to fill.");
         return;
     }

    logger.log('Starting field filling process with data:', { links: socialLinksData, hasPassword: !!fillPasswordValue });

    // Fill social link fields
    for (const [serviceName, url] of Object.entries(socialLinksData)) {
         if (!url) continue; // Skip if URL is empty

         const serviceKeywords = servicesConfig[serviceName]?.keywords || [];
         const field = findFieldForService(serviceName, serviceKeywords);

         if (field && field.value !== url) { // Only fill if found and value is different
             logger.log(`Filling field for ${serviceName}`);
             fillSingleField(field, url);
         } else if (field && field.value === url) {
             logger.log(`Field for ${serviceName} already has the correct value.`);
             // Optional: Still apply visual feedback if desired
             // field.style.boxShadow = '0 0 5px lightgreen'; // Indicate already correct
         }
    }

    // Fill password fields if enabled and value exists
    if (fillPasswordValue) {
            const passwordFields = document.querySelectorAll('input[type="password"]');
         logger.log(`Found ${passwordFields.length} password fields.`);
         passwordFields.forEach(field => {
             if (isElementVisible(field) && field.value !== fillPasswordValue) {
                 logger.log("Filling password field:", field.id || field.name || "unnamed field");
                 fillSingleField(field, fillPasswordValue);
             } else if (isElementVisible(field) && field.value === fillPasswordValue) {
                 logger.log("Password field already has the correct value:", field.id || field.name || "unnamed field");
             }
         });
    }

    logger.log('Field filling attempt finished.');
}

// Function to fill a single field with a value
function fillSingleField(field, value) {
    if (!field || !isElementVisible(field)) { // Add null check
        logger.warn('Attempted to fill non-visible or null field');
        return false;
    }
    try {
        // Check if field is disabled
        if (field.disabled) {
            logger.warn('Attempted to fill disabled field:', field);
            return false;
        }

        // Set the value
        field.value = value;
        
        // Dispatch events common frameworks might listen for
        field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        // Some frameworks might need focus/blur
        field.focus();
        field.blur();

        // Add visual feedback (optional)
        field.style.boxShadow = '0 0 5px green';
        setTimeout(() => { field.style.boxShadow = ''; }, 2000); // Remove feedback after 2s
        
        logger.log('Field filled successfully:', {
            type: 'FIELD_FILLED',
            field: {
                id: field.id || "no-id",
                name: field.name || "no-name",
                type: field.type || "unknown-type",
                // Avoid logging the actual password value
                value: field.type === 'password' ? '********' : value
            }
        });
        
        return true;
    } catch (error) {
        logger.error('Error filling field:', error, field);
        return false;
    }
}

// Load data from storage and trigger initial fill
async function loadDataAndFill() {
     logger.log("Loading initial data...");
     try {
         // Get services configuration
         const servicesResponse = await new Promise((resolve) => {
             chrome.runtime.sendMessage({ type: "GET_SERVICES" }, resolve);
         });
         if (servicesResponse?.services) {
             servicesConfig = servicesResponse.services;
             // Convert stored patterns back to RegExp objects
             Object.values(servicesConfig).forEach(config => {
                 if (config.patterns && Array.isArray(config.patterns)) {
                     config.patterns = config.patterns.map(p => {
                         if (!p || !p.source) return null; // Add null check
                         try {
                             return new RegExp(p.source, p.flags || 'i');
                         } catch (e) {
                             logger.error("Error converting pattern:", p, e);
                             return null;
                         }
                     }).filter(Boolean); // Remove any null patterns
                 }
             });
         }

         // Get social links
         const linksResponse = await chrome.storage.sync.get('socialLinks');
         socialLinksData = linksResponse?.socialLinks || {};
         logger.log("Social links loaded:", socialLinksData);

         // Get password setting
         const passwordResponse = await chrome.storage.sync.get('fillPassword');
         fillPasswordValue = passwordResponse?.fillPassword || null;
         logger.log("Password setting loaded:", fillPasswordValue ? 'Password present' : 'No password');

         // Trigger initial fill after loading all data
         fillFields();

     } catch (error) {
         logger.error("Error loading data from storage:", error);
     }
}

// --- Message Handling & Observer ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CONTEXT_INVALID') {
        extensionContextValid = false;
        logger.warn('Context invalidated by background worker. Reload page recommended.');
        // Optionally disable observer or further actions
        optimizedObserver.stop();
    } else if (message.type === 'SERVICES_UPDATED') {
        logger.log('Services configuration updated, reloading data...');
        // Reload all data as services might affect field finding or available links
        loadDataAndFill(); // Reload data and trigger fill
    }
     // Add response capabilities if needed for other messages
     // sendResponse({}); // Example response
     return true; // Indicate async response possible if needed later
});

// Optimized observer with debouncing
const optimizedObserver = (() => {
    let debounceTimeout;
    const DEBOUNCE_DELAY = 500; // ms
    
    const observer = new MutationObserver(mutations => {
        // Check if relevant nodes were added
        const addedNodes = mutations.some(mutation =>
            Array.from(mutation.addedNodes).some(node =>
                node.nodeType === Node.ELEMENT_NODE &&
                (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'FORM' || node.querySelector('input, textarea, form'))
            )
        );

        if (addedNodes) {
            logger.log("DOM changed, scheduling fillFields...");
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                logger.log("Debounced fillFields executing.");
                fillFields();
            }, DEBOUNCE_DELAY);
        }
    });

    return {
        start: () => {
            logger.log("Starting MutationObserver.");
            // First check if document.body exists
            if (document.body) {
                // Observe the body for additions relevant to forms/inputs
                observer.observe(document.body, {
                    childList: true,
                    subtree: true // Need subtree to catch inputs added deep in the DOM
                });
            } else {
                logger.warn("Document body not available yet, cannot start observer");
                // Maybe add retry logic or wait for body
                const bodyCheckInterval = setInterval(() => {
                    if (document.body) {
                        clearInterval(bodyCheckInterval);
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                        logger.log("Body available, starting observer");
                    }
                }, 100);
            }
        },
        stop: () => {
            logger.log("Stopping MutationObserver.");
            observer.disconnect();
            clearTimeout(debounceTimeout); // Clear any pending execution
        }
    };
})();

// --- Initialization ---

// Initial load of data and start observing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadDataAndFill();
        optimizedObserver.start();
    });
} else {
    // Already loaded
    loadDataAndFill();
    optimizedObserver.start();
}

// content.js  (Manifest V3)

(() => {
  const selector = 'input[type="radio"][name="productType"][value="001"]';
  let internalUpdate = false;      // stops feedback loops

  /** Ensure our target radio is present and checked */
  function enforceChoice() {
    const radio = document.querySelector(selector);
    if (radio && !radio.checked) {
      internalUpdate = true;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      internalUpdate = false;
      console.debug('[RadioGuard] Forced selection → 001');
    }
  }

  /* 1️⃣  FIRST PASS – as soon as the DOM is parsed */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceChoice, { once: true });
  
  } else {
    enforceChoice();
    console.log("g")
  }

  /* 2️⃣  WATCH CHANGE EVENTS on the whole document (capture phase)        */
  /*     If *any* radio in the group changes and it isn’t ours, fix it.    */
  document.addEventListener(
    'change',
    (e) => {
      if (internalUpdate) return;                       // ignore our own synthetic change
      const t = e.target;
      if (t.matches?.('input[type="radio"][name="productType"]') && t.value !== '001') {
        enforceChoice();
      }
    },
    true  // capture so we run before site handlers that listen in bubble phase
  );

  /* 3️⃣  MUTATION OBSERVER limited to .itemform-block nodes               */
  const observer = new MutationObserver(enforceChoice);
  document.querySelectorAll('.itemform-block').forEach((block) =>
    observer.observe(block, {
      childList: true,
      subtree: true,
      attributes: true          // catches attribute flips like `checked`
    })
  );

  /* 🔒  Clean-up when navigating away */
  window.addEventListener('beforeunload', () => observer.disconnect());
})();

logger.log("Content script initialized.");

// Add this to your content.js file - Universal form filling that works on any website

// Universal field patterns (same as in popup.js)
const universalFieldPatterns = {
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
};

// Universal form data storage
let universalFormData = {};

// Load universal form data from storage
async function loadUniversalFormData() {
    try {
        const response = await chrome.storage.sync.get('universalFormData');
        universalFormData = response?.universalFormData || {};
        logger.log("Universal form data loaded:", universalFormData);
    } catch (error) {
        logger.error("Error loading universal form data:", error);
    }
}

// Smart field detection that works on any website
function findUniversalField(fieldConfig) {
    // Try exact selectors first
    for (const selector of fieldConfig.selectors) {
        try {
            const field = document.querySelector(selector);
            if (field && isElementVisible(field)) {
                return field;
            }
        } catch (e) {
            // Invalid selector, continue
        }
    }
    
    // Fallback to keyword matching in attributes
    const allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, select');
    for (const input of allInputs) {
        if (!isElementVisible(input)) continue;
        
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
                logger.log(`Found field for ${fieldConfig.label} using keyword "${keyword}":`, input);
                return input;
            }
        }
    }
    
    return null;
}

// Universal form filler that works on any website
const universalFormFiller = {
    async fillAllForms() {
        if (!extensionContextValid) {
            logger.warn("Context invalid, skipping universal form fill");
            return;
        }
        
        // Load data if not already loaded
        if (Object.keys(universalFormData).length === 0) {
            await loadUniversalFormData();
        }
        
        if (Object.keys(universalFormData).length === 0) {
            logger.log("No universal form data to fill");
            return;
        }
        
        logger.log("Starting universal form fill on:", window.location.hostname);
        let filledCount = 0;
        
        // Try to fill each field type
        Object.entries(universalFieldPatterns).forEach(([fieldKey, fieldConfig]) => {
            let value = universalFormData[fieldKey];
            
            // If no direct value, try to get from social links
            if (!value && fieldConfig.source && socialLinksData[fieldConfig.source]) {
                value = socialLinksData[fieldConfig.source];
            }
            
            if (!value) return;
            
            const field = findUniversalField(fieldConfig);
            if (field) {
                const success = this.fillUniversalField(field, value, fieldKey);
                if (success) {
                    filledCount++;
                    logger.log(`✓ Filled ${fieldKey}: ${fieldConfig.label}`);
                }
            } else {
                logger.log(`- No field found for ${fieldKey}: ${fieldConfig.label}`);
            }
        });
        
        if (filledCount > 0) {
            logger.log(`Successfully filled ${filledCount} fields on ${window.location.hostname}`);
        } else {
            logger.log("No suitable fields found to fill on this page");
        }
    },
    
    fillUniversalField(field, value, fieldType) {
        try {
            if (field.disabled || field.readOnly) {
                logger.warn(`Field for ${fieldType} is disabled/readonly:`, field);
                return false;
            }
            
            if (fieldType === 'description') {
                // Handle rich text editors
                if (field.classList.contains('mceContentBody') || field.contentEditable === 'true') {
                    return fillRichTextEditor(field, value);
                } else if (field.tagName.toLowerCase() === 'iframe') {
                    return fillTinyMCEIframe(field, value);
                }
            }
            
            if (field.tagName.toLowerCase() === 'select') {
                return fillSelectField(field, value);
            }
            
            // Handle regular fields
            return fillSingleField(field, value);
        } catch (error) {
            logger.error(`Error filling universal field ${fieldType}:`, error);
            return false;
        }
    },
    
    // Check if current page has any fillable forms
    hasDetectableForms() {
        const forms = document.querySelectorAll('form');
        if (forms.length === 0) return false;
        
        // Check if any forms have input fields we can potentially fill
        const fillableInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea');
        return fillableInputs.length > 0;
    }
};

// Enhanced message handler for universal forms
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle universal form data updates
    if (message.type === 'UNIVERSAL_FORM_DATA_UPDATED') {
        logger.log('Universal form data updated');
        universalFormData = message.data || {};
        setTimeout(() => {
            universalFormFiller.fillAllForms();
        }, 500);
        return true;
    }
    
    // Handle existing message types
    if (message.type === 'CONTEXT_INVALID') {
        extensionContextValid = false;
        logger.warn('Context invalidated by background worker. Reload page recommended.');
        optimizedObserver.stop();
    } else if (message.type === 'SERVICES_UPDATED') {
        logger.log('Services configuration updated, reloading data...');
        loadDataAndFill();
    }
    
    return true;
});

// Enhanced data loading function that includes universal forms
async function loadDataAndFillUniversal() {
    logger.log("Loading universal data...");
    
    try {
        // Load existing data (social links, services, password)
        await loadDataAndFill();
        
        // Load universal form data
        await loadUniversalFormData();
        
        // Fill forms if this page has any
        if (universalFormFiller.hasDetectableForms()) {
            logger.log("Detectable forms found, scheduling fill...");
            
            // Wait for social links to load first, then fill universal forms
            setTimeout(() => {
                universalFormFiller.fillAllForms();
            }, 1500);
        } else {
            logger.log("No detectable forms on this page");
        }
        
    } catch (error) {
        logger.error("Error in universal data loading:", error);
    }
}

// Enhanced observer that watches for any form changes
const universalFormObserver = (() => {
    let debounceTimeout;
    const DEBOUNCE_DELAY = 800;
    
    const observer = new MutationObserver(mutations => {
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
            logger.log("Form elements detected in DOM, scheduling fill...");
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                fillFields(); // Fill social links
                universalFormFiller.fillAllForms(); // Fill universal forms
            }, DEBOUNCE_DELAY);
        }
    });

    return {
        start: () => {
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'id', 'name', 'contenteditable']
                });
                logger.log("Universal form observer started");
            } else {
                const bodyCheckInterval = setInterval(() => {
                    if (document.body) {
                        clearInterval(bodyCheckInterval);
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true,
                            attributes: true,
                            attributeFilter: ['class', 'id', 'name', 'contenteditable']
                        });
                        logger.log("Universal form observer started (delayed)");
                    }
                }, 100);
            }
        },
        stop: () => {
            observer.disconnect();
            clearTimeout(debounceTimeout);
            logger.log("Universal form observer stopped");
        }
    };
})();

// Initialize universal form filling
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadDataAndFillUniversal();
        universalFormObserver.start();
    });
} else {
    loadDataAndFillUniversal();
    universalFormObserver.start();
}

logger.log("Universal form filling system initialized for any website");