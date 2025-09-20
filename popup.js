const logger = {
    log: (...args) => console.log('[FILLER]', ...args),
    warn: (...args) => console.warn('[FILLER]', ...args),
    error: (...args) => console.error('[FILLER]', ...args)
};

// Utility function to prevent rapid firing of the save function
function debounce(func, wait) {
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

// Show status message with different types
function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block'; // Make sure it's visible
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
            status.style.display = 'none';
        }, 3000);
    }
}

// Validate URL format
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// Convert comma-separated string to array
function stringToArray(str) {
    if (!str) return []; // Handle empty string
    return str.split(',').map(s => s.trim()).filter(s => s);
}

// Convert array to comma-separated string
function arrayToString(arr) {
    if (!Array.isArray(arr)) return ''; // Handle non-array input
    return arr.join(', ');
}

// Load and display services
async function loadServices() {
    try {
        const { services = {} } = await chrome.storage.sync.get('services');
        const servicesList = document.getElementById('services-list');
        if (servicesList) {
            servicesList.innerHTML = '';
            Object.entries(services).forEach(([name, config]) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${name}</span>
                    <div class="service-actions">
                        <button class="edit-service" data-service="${name}">Edit</button>
                        <button class="delete-service" data-service="${name}">Delete</button>
                    </div>
                `;
                servicesList.appendChild(li);
            });
        }
        return services;
    } catch (error) {
        logger.error('Error loading services:', error);
        showStatus('Failed to load services', 'error');
        return {};
    }
}

// Load service data into editor
function loadServiceIntoEditor(serviceName, serviceConfig) {
    document.getElementById('serviceName').value = serviceName;
    document.getElementById('serviceKeywords').value = arrayToString(serviceConfig.keywords || []);

    // Handle patterns which could be RegExp objects or pattern objects
    let patternsString = '';
    if (serviceConfig.patterns && Array.isArray(serviceConfig.patterns)) {
        patternsString = serviceConfig.patterns.map(p => {
            if (p instanceof RegExp) {
                return p.source;
            } else if (p && typeof p === 'object' && p.source) {
                return p.source;
            }
            return p?.toString() || '';
        }).join('\n');
    }
    document.getElementById('servicePatterns').value = patternsString;

    document.getElementById('serviceExclude').value = arrayToString(serviceConfig.exclude || []);
    document.getElementById('serviceWeight').value = serviceConfig.weight || 1;
    document.getElementById('serviceName').focus();
}

// Save service configuration
async function saveService() {
    try {
        const name = document.getElementById('serviceName').value.trim().toLowerCase();
        if (!name) {
            showStatus('Service name is required', 'error');
            return;
        }

        const keywords = stringToArray(document.getElementById('serviceKeywords').value);
        if (keywords.length === 0) {
            showStatus('At least one keyword is required', 'error');
            return;
        }

        const patternsText = document.getElementById('servicePatterns').value.trim();
        if (!patternsText) {
            showStatus('At least one URL pattern is required', 'error');
            return;
        }

        // Convert pattern strings to RegExp objects, validating each
        const patterns = [];
        const patternLines = patternsText.split('\n').filter(line => line.trim());
        
        for (const line of patternLines) {
            const patternStr = line.trim();
            if (!patternStr) continue;
            
            try {
                // Check if pattern is already in regex format
                const match = patternStr.match(/^\/(.+)\/([gimyus]*)$/);
                const pattern = match 
                    ? { source: match[1], flags: match[2] || 'i' }
                    : { source: patternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags: 'i' };
                    
                // Validate pattern by trying to create RegExp
                new RegExp(pattern.source, pattern.flags);
                patterns.push(pattern);
            } catch (e) {
                showStatus(`Invalid pattern: "${patternStr}". Please check the syntax.`, 'error');
                logger.error(`Invalid pattern: ${patternStr}`, e);
                return;
            }
        }

        if (patterns.length === 0) {
            showStatus('At least one valid URL pattern is required', 'error');
            return;
        }

        const exclude = stringToArray(document.getElementById('serviceExclude').value);
        const weight = parseFloat(document.getElementById('serviceWeight').value) || 1;

        // Convert RegExp back to string/flags object for storage
        const storablePatterns = patterns.map(p => ({ source: p.source, flags: p.flags }));

        const serviceConfig = {
            keywords,
            patterns: storablePatterns, // Store the object array
            exclude,
            weight
        };

        const { services = {} } = await chrome.storage.sync.get('services');
        services[name] = serviceConfig; // Store the config with storable patterns

        await chrome.storage.sync.set({ services });

        showStatus('Service saved successfully');
        await loadServices(); // Reload list to reflect changes
        clearServiceForm();
    } catch (error) {
        logger.error('Error saving service:', error);
        showStatus('Failed to save service', 'error');
    }
}

// Clear service form
function clearServiceForm() {
    document.getElementById('serviceName').value = '';
    document.getElementById('serviceKeywords').value = '';
    document.getElementById('servicePatterns').value = '';
    document.getElementById('serviceExclude').value = '';
    document.getElementById('serviceWeight').value = '1';
}

// Delete a link
async function deleteLink(service) {
    try {
        const { socialLinks = {} } = await chrome.storage.sync.get('socialLinks');
        if (socialLinks[service]) {
            delete socialLinks[service];
            await chrome.storage.sync.set({ socialLinks });
            showStatus(`Deleted ${service} link`);
            await loadLinks();
        }
    } catch (error) {
        logger.error('Error deleting link:', error);
        showStatus('Failed to delete link', 'error');
    }
}

// Load saved social links
async function loadLinks() {
    try {
        const { socialLinks = {} } = await chrome.storage.sync.get('socialLinks');
        const linksContainer = document.getElementById('links-container');
        if (linksContainer) {
            linksContainer.innerHTML = '';
            Object.entries(socialLinks).forEach(([service, url]) => {
                const div = document.createElement('div');
                div.className = 'link-item';
                div.innerHTML = `
                    <input type="text" value="${url}" data-service="${service}" placeholder="Enter URL">
                    <button class="delete-link" data-service="${service}">Delete</button>
                `;
                linksContainer.appendChild(div);
            });
        }
        return socialLinks;
    } catch (error) {
        logger.error('Error loading links:', error);
        showStatus('Failed to load links', 'error');
        return {};
    }
}

// Load social links with service integration
async function loadSocialLinks(servicesMap) { // Accept the map directly
    const container = document.getElementById('fieldsContainer');
    if (!container) {
        // Optionally log an error or handle gracefully
        logger.error("Element with ID 'fieldsContainer' not found.");
        return;
    }

    container.innerHTML = ''; // Clear any existing content

    try {
        const { socialLinks = {} } = await chrome.storage.sync.get('socialLinks');
        const serviceNames = Object.keys(servicesMap); // Get names from the map

        serviceNames.forEach(service => {
            const div = document.createElement('div');
            div.className = 'field-item';
            // Generate unique ID for the input to associate label
            const inputId = `service-input-${service}`;
            
            // Added HTML escape for service name
            const serviceDisplay = service.charAt(0).toUpperCase() + service.slice(1);
            const escapedService = service.replace(/[&<>"']/g, char => {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[char];
            });
            
            div.innerHTML = `
                <label for="${inputId}">
                    ${serviceDisplay}:
                </label>
                <input type="url"
                       id="${inputId}"
                       data-service="${escapedService}"
                       value="${socialLinks[service] ? socialLinks[service].replace(/"/g, '&quot;') : ''}"
                       placeholder="https://${service}.com/yourprofile">
            `;
            container.appendChild(div);
        });
    } catch (error) {
        logger.error('Error loading social links:', error);
        showStatus('Failed to load social links', 'error');
    }
}

// Save social links with validation
async function saveLinks() {
    try {
        const socialLinks = {};
        // Use a more specific selector targeting only the inputs within the container
        const inputs = document.querySelectorAll('#fieldsContainer input[data-service]');

        // Validate URLs before saving
        let isValid = true; // Flag to track validation status
        for (const input of inputs) {
            const service = input.dataset.service;
            const value = input.value.trim();
            if (value) {
                // Basic URL structure check (consider a more robust regex if needed)
                if (!/^https?:\/\/.+/.test(value)) {
                    showStatus(`Invalid URL format for ${service}. Must start with http:// or https://`, 'error');
                    input.focus(); // Focus the problematic input
                    isValid = false;
                    break; // Stop validation on first error
                }
                socialLinks[service] = value;
            } else {
                // If the input is empty, remove the link from storage if it exists
                delete socialLinks[service];
            }
        }

        if (!isValid) {
            return; // Don't save if validation failed
        }

        // Get current links to merge, ensuring empty fields remove old values
        const currentData = await chrome.storage.sync.get('socialLinks');
        const updatedLinks = { ...(currentData.socialLinks || {}), ...socialLinks };

        // Explicitly remove keys for services that now have empty inputs
        inputs.forEach(input => {
            if (!input.value.trim()) {
                delete updatedLinks[input.dataset.service];
            }
        });

        await chrome.storage.sync.set({ socialLinks: updatedLinks });
        showStatus('Links saved! Reload pages to apply');
    } catch (error) {
        logger.error('Error saving links:', error);
        showStatus('Failed to save links', 'error');
    }
}

// Reset all links and services
async function resetAll() {
    if (confirm('Are you sure you want to clear ALL saved links AND revert services to default? This cannot be undone.')) {
        try {
            // Clear links
            await chrome.storage.sync.remove('socialLinks');

            // Reset services requires fetching defaults from background
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type: "RESET_SERVICES_TO_DEFAULT" }, response => {
                    if (response?.success) {
                        resolve();
                    } else {
                        reject(new Error("Failed to reset services"));
                    }
                });
            });

            // Reload UI
            await initializePopup(); // Re-run initialization

            showStatus('All links cleared and services reset to default');
        } catch (error) {
            logger.error('Error resetting data:', error);
            showStatus('Failed to reset data', 'error');
        }
    }
}

// Add new link field with service selection
function addLinkField() {
    const selector = document.getElementById('serviceSelector');
    if (!selector || selector.value === 'custom') {
        showStatus('Please select a service first', 'error');
        return;
    }

    const service = selector.value;
    const container = document.getElementById('fieldsContainer');
    if (!container) return;

    if (document.querySelector(`#fieldsContainer input[data-service="${service}"]`)) {
        showStatus('This service already has a field', 'error');
        return;
    }

    const savedLinks = JSON.parse(localStorage.getItem('savedLinks') || '{}');
    const savedValue = savedLinks[service] || '';
    const inputId = `service-input-${service}`;

    const div = document.createElement('div');
    div.className = 'field-item';
    div.innerHTML = `
        <label for="${inputId}">
            ${service.charAt(0).toUpperCase() + service.slice(1)}:
        </label>
        <input
            type="url"
            id="${inputId}"
            data-service="${service}"
            placeholder="https://${service}.com/yourprofile"
            value="${savedValue}"
        >
    `;

    container.appendChild(div);

    const input = document.getElementById(inputId);
    input?.focus();

    input?.addEventListener('input', () => {
        const updatedLinks = JSON.parse(localStorage.getItem('savedLinks') || '{}');
        updatedLinks[service] = input.value;
        localStorage.setItem('savedLinks', JSON.stringify(updatedLinks));
    });
}

document.addEventListener('DOMContentLoaded', function() {
    function setupVisibilityToggle(buttonElement) {
        const targetId = buttonElement.getAttribute('data-target');
        const targetDiv = document.getElementById(targetId);

        if (targetDiv) {
            buttonElement.addEventListener('click', function() {
                // Toggle visibility
                if (targetDiv.style.display === 'none') {
                    targetDiv.style.display = 'block';
                } else {
                    targetDiv.style.display = 'none';
                }

                // Change button background color on click
                buttonElement.style.backgroundColor = 'lightblue';

                // Revert color after a short delay
                setTimeout(function() {
                    buttonElement.style.backgroundColor = '';
                }, 200);
            });
        } else {
            console.error(`Target div with id "${targetId}" not found for button:`, buttonElement);
        }
    }

    // Find all elements with the class 'toggle-button' and set up the toggle functionality
    const toggleButtons = document.querySelectorAll('.toggle-button');
    toggleButtons.forEach(setupVisibilityToggle);
});


// Load saved passwords
async function loadPasswords() {
    try {
        const { fillPassword } = await chrome.storage.sync.get('fillPassword');
        const passwordInput = document.getElementById('passwordValue');
        if (passwordInput) {
            passwordInput.value = fillPassword || '';
        }
    } catch (error) {
        logger.error('Error loading password:', error);
        showStatus('Failed to load password', 'error');
    }
}

// Save password
async function savePassword() {
    try {
        const password = document.getElementById('passwordValue').value;
        if (!password) {
            showStatus('Please enter a password', 'error');
            return;
        }

        await chrome.storage.sync.set({ fillPassword: password });
        showStatus('Password saved successfully');
        clearPasswordForm();
    } catch (error) {
        logger.error('Error saving password:', error);
        showStatus('Failed to save password', 'error');
    }
}

// Clear password form
function clearPasswordForm() {
    document.getElementById('passwordValue').value = '';
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('passwordValue');
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
}

// Setup all event listeners
function setupEventListeners() {
    // Save button for social links
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        saveButton.addEventListener('click', saveLinks);
    }

    // Reset button
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', resetAll);
    }

    // Add field button
    const addFieldButton = document.getElementById('addField');
    if (addFieldButton) {
        addFieldButton.addEventListener('click', addLinkField);
    }

    // Save service button
    const saveServiceButton = document.getElementById('saveService');
    if (saveServiceButton) {
        saveServiceButton.addEventListener('click', saveService);
    }

    // Save password button
    const savePasswordButton = document.getElementById('savePassword');
    if (savePasswordButton) {
        savePasswordButton.addEventListener('click', savePassword);
    }

    // Toggle password visibility button
    const togglePasswordButton = document.getElementById('togglePassword');
    if (togglePasswordButton) {
        togglePasswordButton.addEventListener('click', togglePasswordVisibility);
    }

    // Event delegation for delete buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-link')) {
            const service = e.target.dataset.service;
            if (service) {
                deleteLink(service);
            } else {
                e.target.parentElement.remove();
            }
        }
    });

    // Service list event delegation
    const servicesList = document.getElementById('services-list');
    if (servicesList) {
        servicesList.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.classList.contains('edit-service')) {
                const serviceName = target.dataset.service;
                const { services = {} } = await chrome.storage.sync.get('services');
                if (services[serviceName]) {
                    loadServiceIntoEditor(serviceName, services[serviceName]);
                }
            } else if (target.classList.contains('delete-service')) {
                if (confirm(`Are you sure you want to delete the service "${target.dataset.service}"?`)) {
                    try {
                        const { services = {} } = await chrome.storage.sync.get('services');
                        delete services[target.dataset.service];
                        await chrome.storage.sync.set({ services });
                        await loadServices();
                        showStatus('Service deleted successfully');
                    } catch (error) {
                        logger.error('Error deleting service:', error);
                        showStatus('Failed to delete service', 'error');
                    }
                }
            }
        });
    }
}

// Initialize popup logic separated for clarity and re-use in reset
async function initializePopup() {
    try {
        // Get services from background script
        const { services } = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: "GET_SERVICES" }, response => {
                if (chrome.runtime.lastError) {
                    // Log the specific error
                    logger.error("Error getting services:", chrome.runtime.lastError.message);
                    reject(new Error(`Failed to get services: ${chrome.runtime.lastError.message}`));
                } else if (response?.services) {
                    // Convert stored patterns back to RegExp objects
                    Object.values(response.services).forEach(config => {
                        if (config.patterns && Array.isArray(config.patterns)) {
                            try {
                                // Ensure p exists and has source before creating RegExp
                                config.patterns = config.patterns
                                    .filter(p => p && typeof p.source === 'string') // Add filter for safety
                                    .map(p => new RegExp(p.source, p.flags || '')); // Use stored flags

                            } catch (e) {
                                logger.error("Error converting stored pattern to RegExp:", config, e);
                                config.patterns = []; // Default to empty on error
                            }
                        } else {
                            config.patterns = []; // Ensure patterns array exists
                        }
                        if (!config.keywords) config.keywords = []; // Ensure keywords array exists
                    });
                    resolve(response);
                } else {
                    logger.warn("No services data received from background, resolving with empty.");
                    resolve({ services: {} }); // Default to empty if no services found
                }
            });
        });

        if (!services) {
            throw new Error("Failed to load services from background.js");
        }

        const serviceNames = Object.keys(services);

        // Populate service selector dropdown
        const serviceSelector = document.getElementById('serviceSelector');
        if (serviceSelector) {
            const currentSelection = serviceSelector.value; // Preserve selection if possible
            serviceSelector.innerHTML = '<option value="custom">Select a service...</option>'; // Clear existing options
            serviceNames.sort().forEach(service => { // Sort alphabetically
                const option = document.createElement('option');
                option.value = service;
                option.textContent = service.charAt(0).toUpperCase() + service.slice(1);
                serviceSelector.appendChild(option);
            });
            // Restore previous selection if it still exists
            if (serviceNames.includes(currentSelection)) {
                serviceSelector.value = currentSelection;
            }
        }

        // Load and display services list
        await loadServices(); // This now expects services from storage directly

        // Load and display social links using the loaded services map
        await loadSocialLinks(services);

        // Load saved passwords
        await loadPasswords();

        // Set up event listeners (ensure this doesn't add duplicate listeners if called again)
        // Consider removing old listeners before adding new ones if re-initialization is frequent
        // For simplicity here, we assume setupEventListeners is safe to call multiple times or DOMContentLoaded handles it.

    } catch (error) {
        logger.error('Initialization error:', error);
        showStatus('Failed to initialize extension. Please reload popup.', 'error');
        // Disable relevant controls if init fails
        const controls = document.querySelectorAll('button, input, select, textarea');
        controls.forEach(c => c.disabled = true);
        document.getElementById('status').className = 'status error'; // Ensure error style sticks
    }
}

function loadSavedFields() {
    const savedLinks = JSON.parse(localStorage.getItem('savedLinks') || '{}');
    const selector = document.getElementById('serviceSelector');

    for (const service in savedLinks) {
        if (savedLinks.hasOwnProperty(service)) {
            // Temporarily set the selector value to reuse addLinkField
            if (selector) selector.value = service;
            addLinkField();
        }
    }

    // Reset selector after loading
    if (selector) selector.value = '';
}


document.addEventListener('DOMContentLoaded', async () => {
    await initializePopup();
    setupEventListeners();
});

document.addEventListener('DOMContentLoaded', () => {
    loadSavedFields();

    const addButton = document.getElementById('addServiceButton');
    if (addButton) {
        addButton.addEventListener('click', addLinkField);
    }
});

// SIMPLE INTEGRATION GUIDE FOR YOUR EXISTING popup.js
// Just add this code at the end of your popup.js file

// Add universal form section HTML to your popup after the password section
function addUniversalFormSection() {
    const passwordSection = document.querySelector('.section');
    if (!passwordSection) return;
    
    const universalSection = document.createElement('div');
    universalSection.className = 'section';
    universalSection.innerHTML = `
        <h3>Universal Form Data</h3>
        <p style="font-size: 12px; color: #666; margin-bottom: 15px;">
            Fill out your common information once - works on ANY website!
        </p>
        <div class="field-item">
            <label>Title/Subject:</label>
            <input type="text" id="universal-title" placeholder="Your business/service name">
        </div>
        <div class="field-item">
            <label>Description:</label>
            <textarea id="universal-description" placeholder="Describe your business/service" rows="3"></textarea>
        </div>
        <div class="field-item">
            <label>Phone:</label>
            <input type="tel" id="universal-phone" placeholder="Your phone number">
        </div>
        <div class="field-item">
            <label>Email:</label>
            <input type="email" id="universal-email" placeholder="Your email address">
        </div>
        <div class="field-item">
            <label>Website:</label>
            <input type="url" id="universal-website" placeholder="Your website URL">
        </div>
        <div class="field-item">
            <label>Address:</label>
            <input type="text" id="universal-address" placeholder="Your address">
        </div>
        <div class="field-item">
            <label>City:</label>
            <input type="text" id="universal-city" placeholder="Your city">
        </div>
        <div class="field-item">
            <label>ZIP Code:</label>
            <input type="text" id="universal-zipcode" placeholder="Your ZIP code">
        </div>
        <div class="field-item">
            <label>Company:</label>
            <input type="text" id="universal-company" placeholder="Your company name">
        </div>
        <div class="field-item">
            <label>Price:</label>
            <input type="text" id="universal-price" placeholder="Your price/rate">
        </div>
        <button id="saveUniversalData" style="width: 100%; margin-top: 10px;">Save Universal Data</button>
        <button id="autoFillFromSocial" style="width: 100%; margin-top: 5px; background: #28a745;">Auto-Fill from Social Links</button>
    `;
    
    // Insert before the password section
    passwordSection.parentNode.insertBefore(universalSection, passwordSection);
}

// Load universal data into the form
async function loadUniversalData() {
    try {
        const { universalFormData = {} } = await chrome.storage.sync.get('universalFormData');
        
        // Fill the form fields
        const fields = ['title', 'description', 'phone', 'email', 'website', 'address', 'city', 'zipcode', 'company', 'price'];
        fields.forEach(field => {
            const element = document.getElementById(`universal-${field}`);
            if (element && universalFormData[field]) {
                element.value = universalFormData[field];
            }
        });
        
        logger.log('Universal data loaded:', universalFormData);
    } catch (error) {
        logger.error('Error loading universal data:', error);
    }
}

// Save universal data
async function saveUniversalData() {
    try {
        const universalFormData = {};
        const fields = ['title', 'description', 'phone', 'email', 'website', 'address', 'city', 'zipcode', 'company', 'price'];
        
        fields.forEach(field => {
            const element = document.getElementById(`universal-${field}`);
            if (element && element.value.trim()) {
                universalFormData[field] = element.value.trim();
            }
        });
        
        await chrome.storage.sync.set({ universalFormData });
        showStatus('Universal data saved! Will auto-fill on any website.');
        
        // Notify all open tabs
        try {
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'UNIVERSAL_FORM_DATA_UPDATED',
                    data: universalFormData
                }).catch(() => {}); // Ignore errors
            });
        } catch (error) {
            // Tabs API might not be available, that's OK
        }
        
    } catch (error) {
        logger.error('Error saving universal data:', error);
        showStatus('Failed to save universal data', 'error');
    }
}

// Auto-fill from existing social links
async function autoFillFromSocial() {
    try {
        const { socialLinks = {} } = await chrome.storage.sync.get('socialLinks');
        
        // Map social links to universal fields
        const mappings = {
            'universal-website': socialLinks.website,
            'universal-email': socialLinks.email,
            'universal-phone': socialLinks.phone
        };
        
        Object.entries(mappings).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element && value && !element.value) {
                element.value = value;
                element.style.backgroundColor = '#E8F5E8';
            }
        });
        
        showStatus('Auto-filled from social links');
    } catch (error) {
        logger.error('Error auto-filling:', error);
    }
}

// Enhanced reset function
async function resetAllUniversal() {
    if (confirm('Clear ALL data including social links, universal form data, passwords, and reset services?')) {
        try {
            await chrome.storage.sync.clear();
            
            // Reset services
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type: "RESET_SERVICES_TO_DEFAULT" }, response => {
                    if (response?.success) resolve();
                    else reject(new Error("Failed to reset"));
                });
            });
            
            // Reload the popup
            location.reload();
            
        } catch (error) {
            logger.error('Reset error:', error);
            showStatus('Failed to reset', 'error');
        }
    }
}

// Initialize everything when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
    // Run your existing initialization
    await initializePopup();
    setupEventListeners();
    
    // Add universal form section
    addUniversalFormSection();
    
    // Load universal data
    await loadUniversalData();
    
    // Add event listeners for new buttons
    const saveUniversalButton = document.getElementById('saveUniversalData');
    if (saveUniversalButton) {
        saveUniversalButton.addEventListener('click', saveUniversalData);
    }
    
    const autoFillButton = document.getElementById('autoFillFromSocial');
    if (autoFillButton) {
        autoFillButton.addEventListener('click', autoFillFromSocial);
    }
    
    // Replace the reset button functionality
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.removeEventListener('click', resetAll);
        resetButton.addEventListener('click', resetAllUniversal);
    }
    
    // Enhanced save button
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        const originalClick = saveButton.onclick;
        saveButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await saveLinks(); // Your existing save
            await saveUniversalData(); // Also save universal data
        });
    }
    
    logger.log('Universal form system added to popup');
});

// That's it! Just add this to the end of your popup.js file.
// Add this to your popup.js - Google Sheets Data Parser

// Smart parser for your Google Sheets format
function parseGoogleSheetsData(rawData) {
    const parsedData = {
        universalFormData: {},
        socialLinks: {},
        passwords: {},
        metadata: {}
    };
    
    // Clean and split the data into lines
    const lines = rawData.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    
    // Patterns to match different data types
    const patterns = {
        // Business info patterns
        businessName: /\*\*Business name:\*\*(.+?)(?:\*\*|$)/i,
        phone: /Phone #(.+?)(?:\*\*|$)/i,
        address: /\*\*Address:\*\*(.+?)(?:\*\*|$)/i,
        city: /\*\*City:\*\*(.+?)(?:\*\*|$)/i,
        state: /\*\*State:\*\*(.+?)(?:\*\*|$)/i,
        zip: /\*\*Zip:\*\*(.+?)(?:\*\*|$)/i,
        hours: /Hours:(.+?)(?:\*\*|$)/i,
        username: /\*\*Username:\*\*(.+?)(?:\*\*|$)/i,
        contractSigner: /\*\*Contract signer name:\*\*(.+?)(?:\*\*|$)/i,
        
        // URLs and social media
        website: /Website:(https?:\/\/[^\s\*]+)/i,
        facebook: /(https?:\/\/(?:www\.)?facebook\.com[^\s\*]+)/i,
        instagram: /(https?:\/\/(?:www\.)?instagram\.com[^\s\*]+)/i,
        youtube: /(https?:\/\/(?:www\.)?youtube\.com[^\s\*]+)/i,
        pinterest: /(https?:\/\/(?:www\.)?pinterest\.com[^\s\*]+)/i,
        twitter: /(https?:\/\/(?:x\.com|twitter\.com)[^\s\*]+)/i,
        
        // Email and password
        email: /Email:([^\s\*]+@[^\s\*]+)/i,
        password: /\*\*PW:\*\*([^\*\s]+)/i,
        
        // Keywords (numbered list)
        keywords: /\*\*Keywords:\*\*(.+?)(?:\*\*|$)/i
    };
    
    // Join all lines into one text for pattern matching
    const fullText = lines.join(' ');
    
    // Extract basic business information
    const businessNameMatch = fullText.match(patterns.businessName);
    if (businessNameMatch) {
        parsedData.universalFormData.title = businessNameMatch[1].trim();
        parsedData.universalFormData.company = businessNameMatch[1].trim();
    }
    
    const phoneMatch = fullText.match(patterns.phone);
    if (phoneMatch) {
        parsedData.universalFormData.phone = phoneMatch[1].trim();
    }
    
    const addressMatch = fullText.match(patterns.address);
    if (addressMatch) {
        parsedData.universalFormData.address = addressMatch[1].split('Website:')[0].trim();
    }
    
    const cityMatch = fullText.match(patterns.city);
    if (cityMatch) {
        parsedData.universalFormData.city = cityMatch[1].split('Email:')[0].trim();
    }
    
    const zipMatch = fullText.match(patterns.zip);
    if (zipMatch) {
        parsedData.universalFormData.zipcode = zipMatch[1].split('Hours:')[0].trim();
    }
    
    // Extract social media links
    const websiteMatch = fullText.match(patterns.website);
    if (websiteMatch) {
        parsedData.socialLinks.website = websiteMatch[1];
        parsedData.universalFormData.website = websiteMatch[1];
    }
    
    const facebookMatch = fullText.match(patterns.facebook);
    if (facebookMatch) {
        parsedData.socialLinks.facebook = facebookMatch[1];
    }
    
    const instagramMatch = fullText.match(patterns.instagram);
    if (instagramMatch) {
        parsedData.socialLinks.instagram = instagramMatch[1];
    }
    
    const youtubeMatch = fullText.match(patterns.youtube);
    if (youtubeMatch) {
        parsedData.socialLinks.youtube = youtubeMatch[1];
    }
    
    const pinterestMatch = fullText.match(patterns.pinterest);
    if (pinterestMatch) {
        parsedData.socialLinks.pinterest = pinterestMatch[1];
    }
    
    const twitterMatch = fullText.match(patterns.twitter);
    if (twitterMatch) {
        parsedData.socialLinks.twitter = twitterMatch[1];
    }
    
    // Extract email
    const emailMatch = fullText.match(patterns.email);
    if (emailMatch) {
        parsedData.universalFormData.email = emailMatch[1];
    }
    
    // Extract password
    const passwordMatch = fullText.match(patterns.password);
    if (passwordMatch) {
        parsedData.passwords.main = passwordMatch[1];
    }
    
    // Extract metadata
    const usernameMatch = fullText.match(patterns.username);
    if (usernameMatch) {
        parsedData.metadata.username = usernameMatch[1].trim();
    }
    
    const contractSignerMatch = fullText.match(patterns.contractSigner);
    if (contractSignerMatch) {
        parsedData.metadata.contractSigner = contractSignerMatch[1].trim();
    }
    
    // Extract keywords from numbered list
    const keywordLines = lines.filter(line => /^\*\*\d+\*\*/.test(line));
    if (keywordLines.length > 0) {
        const keywords = keywordLines.map(line => {
            return line.replace(/^\*\*\d+\*\*/, '').replace(/,.*$/, '').trim();
        }).filter(keyword => keyword && !keyword.startsWith('http'));
        
        if (keywords.length > 0) {
            parsedData.universalFormData.keywords = keywords.join(', ');
        }
    }
    
    // Extract description (the long paragraph)
    const descriptionLines = lines.filter(line => {
        return line.length > 100 && 
               !line.includes('**') && 
               !line.startsWith('http') &&
               !line.includes('@') &&
               line.includes('cleaning');
    });
    
    if (descriptionLines.length > 0) {
        parsedData.universalFormData.description = descriptionLines[0];
    }
    
    return parsedData;
}

// Function to import and apply Google Sheets data
async function importGoogleSheetsData(rawData) {
    try {
        const parsedData = parseGoogleSheetsData(rawData);
        
        // Save universal form data
        if (Object.keys(parsedData.universalFormData).length > 0) {
            await chrome.storage.sync.set({ universalFormData: parsedData.universalFormData });
            
            // Update UI fields if they exist
            Object.entries(parsedData.universalFormData).forEach(([key, value]) => {
                const field = document.getElementById(`universal-${key}`);
                if (field) {
                    field.value = value;
                    field.style.backgroundColor = '#E8F5E8';
                }
            });
        }
        
        // Save social links
        if (Object.keys(parsedData.socialLinks).length > 0) {
            const { socialLinks: existingLinks = {} } = await chrome.storage.sync.get('socialLinks');
            const updatedLinks = { ...existingLinks, ...parsedData.socialLinks };
            await chrome.storage.sync.set({ socialLinks: updatedLinks });
            
            // Update social links UI
            Object.entries(parsedData.socialLinks).forEach(([platform, url]) => {
                const field = document.querySelector(`input[data-service="${platform}"]`);
                if (field) {
                    field.value = url;
                    field.style.backgroundColor = '#E8F5E8';
                }
            });
        }
        
        // Save password if exists
        if (parsedData.passwords.main) {
            await chrome.storage.sync.set({ fillPassword: parsedData.passwords.main });
            const passwordField = document.getElementById('passwordValue');
            if (passwordField) {
                passwordField.value = parsedData.passwords.main;
                passwordField.style.backgroundColor = '#E8F5E8';
            }
        }
        
        showStatus(`Successfully imported data: ${Object.keys(parsedData.universalFormData).length} form fields, ${Object.keys(parsedData.socialLinks).length} social links`);
        
        // Notify content scripts
        try {
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'UNIVERSAL_FORM_DATA_UPDATED',
                    data: parsedData.universalFormData
                }).catch(() => {});
                
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SERVICES_UPDATED'
                }).catch(() => {});
            });
        } catch (error) {
            // Tabs API not available, that's OK
        }
        
        return parsedData;
        
    } catch (error) {
        logger.error('Error importing Google Sheets data:', error);
        showStatus('Failed to import data - please check format', 'error');
        throw error;
    }
}

// Add Google Sheets import UI to popup
function addGoogleSheetsImporter() {
    const importSection = document.createElement('div');
    importSection.className = 'section';
    importSection.innerHTML = `
        <h3>📊 Import from Google Sheets</h3>
        <p style="font-size: 12px; color: #666; margin-bottom: 15px;">
            Copy your Google Sheets data and paste it here to auto-fill all fields.
        </p>
        <textarea id="sheetsImportData" placeholder="Paste your Google Sheets data here..." rows="6" style="width: 100%; margin-bottom: 10px; font-size: 11px;"></textarea>
        <button id="importSheetsData" style="width: 100%; background: #4CAF50;">Import & Fill All Data</button>
        <button id="clearImportData" style="width: 100%; background: #ff6b6b; margin-top: 5px;">Clear Import Box</button>
        <div style="margin-top: 10px; font-size: 11px; color: #666;">
            <strong>Supported fields:</strong> Business name, phone, address, city, zip, website, social links, email, password, keywords, description
        </div>
    `;
    
    // Insert at the top of the popup
    const firstSection = document.querySelector('.section');
    if (firstSection) {
        firstSection.parentNode.insertBefore(importSection, firstSection);
    }
}

// Event listeners for Google Sheets import
function setupGoogleSheetsImport() {
    const importButton = document.getElementById('importSheetsData');
    const clearButton = document.getElementById('clearImportData');
    const importTextarea = document.getElementById('sheetsImportData');
    
    if (importButton && importTextarea) {
        importButton.addEventListener('click', async () => {
            const rawData = importTextarea.value.trim();
            if (!rawData) {
                showStatus('Please paste your Google Sheets data first', 'error');
                return;
            }
            
            try {
                importButton.disabled = true;
                importButton.textContent = 'Importing...';
                
                await importGoogleSheetsData(rawData);
                
                // Clear the textarea after successful import
                importTextarea.value = '';
                
            } catch (error) {
                logger.error('Import failed:', error);
            } finally {
                importButton.disabled = false;
                importButton.textContent = 'Import & Fill All Data';
            }
        });
    }
    
    if (clearButton && importTextarea) {
        clearButton.addEventListener('click', () => {
            importTextarea.value = '';
            showStatus('Import box cleared');
        });
    }
}

// Enhanced initialization that includes Google Sheets import
document.addEventListener('DOMContentLoaded', async () => {
    // Run existing initialization
    await initializePopup();
    setupEventListeners();
    
    // Add universal form section (if using the previous universal code)
    if (typeof addUniversalFormSection === 'function') {
        addUniversalFormSection();
        await loadUniversalData();
    }
    
    // Add Google Sheets importer
    addGoogleSheetsImporter();
    setupGoogleSheetsImport();
    
    logger.log('Google Sheets import functionality added');
});

// Export function for testing
window.parseGoogleSheetsData = parseGoogleSheetsData;