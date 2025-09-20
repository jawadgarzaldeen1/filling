// Core popup functionality - optimized and modular
const PopupLogger = {
    log: (...args) => console.log('[FILLER]', ...args),
    warn: (...args) => console.warn('[FILLER]', ...args),
    error: (...args) => console.error('[FILLER]', ...args)
};

// Utility functions
const PopupUtils = {
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

    showStatus(message, type = 'success') {
        const status = document.getElementById('status');
        if (status) {
            status.textContent = message;
            status.className = `status ${type}`;
            status.style.display = 'block';
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
                status.style.display = 'none';
            }, 3000);
        }
    },

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    stringToArray(str) {
        if (!str) return [];
        return str.split(',').map(s => s.trim()).filter(s => s);
    },

    arrayToString(arr) {
        if (!Array.isArray(arr)) return '';
        return arr.join(', ');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Service management
const ServiceManager = {
    async loadServices() {
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
            PopupLogger.error('Error loading services:', error);
            PopupUtils.showStatus('Failed to load services', 'error');
            return {};
        }
    },

    loadServiceIntoEditor(serviceName, serviceConfig) {
        document.getElementById('serviceName').value = serviceName;
        document.getElementById('serviceKeywords').value = PopupUtils.arrayToString(serviceConfig.keywords || []);

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

        document.getElementById('serviceExclude').value = PopupUtils.arrayToString(serviceConfig.exclude || []);
        document.getElementById('serviceWeight').value = serviceConfig.weight || 1;
        document.getElementById('serviceName').focus();
    },

    async saveService() {
        try {
            const name = document.getElementById('serviceName').value.trim().toLowerCase();
            if (!name) {
                PopupUtils.showStatus('Service name is required', 'error');
                return;
            }

            const keywords = PopupUtils.stringToArray(document.getElementById('serviceKeywords').value);
            if (keywords.length === 0) {
                PopupUtils.showStatus('At least one keyword is required', 'error');
                return;
            }

            const patternsText = document.getElementById('servicePatterns').value.trim();
            if (!patternsText) {
                PopupUtils.showStatus('At least one URL pattern is required', 'error');
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
                    PopupUtils.showStatus(`Invalid pattern: "${patternStr}". Please check the syntax.`, 'error');
                    PopupLogger.error(`Invalid pattern: ${patternStr}`, e);
                    return;
                }
            }

            if (patterns.length === 0) {
                PopupUtils.showStatus('At least one valid URL pattern is required', 'error');
                return;
            }

            const exclude = PopupUtils.stringToArray(document.getElementById('serviceExclude').value);
            const weight = parseFloat(document.getElementById('serviceWeight').value) || 1;

            // Convert RegExp back to string/flags object for storage
            const storablePatterns = patterns.map(p => ({ source: p.source, flags: p.flags }));

            const serviceConfig = {
                keywords,
                patterns: storablePatterns,
                exclude,
                weight
            };

            const { services = {} } = await chrome.storage.sync.get('services');
            services[name] = serviceConfig;

            await chrome.storage.sync.set({ services });

            PopupUtils.showStatus('Service saved successfully');
            await this.loadServices();
            this.clearServiceForm();
        } catch (error) {
            PopupLogger.error('Error saving service:', error);
            PopupUtils.showStatus('Failed to save service', 'error');
        }
    },

    clearServiceForm() {
        document.getElementById('serviceName').value = '';
        document.getElementById('serviceKeywords').value = '';
        document.getElementById('servicePatterns').value = '';
        document.getElementById('serviceExclude').value = '';
        document.getElementById('serviceWeight').value = '1';
    },

    async deleteService(serviceName) {
        if (confirm(`Are you sure you want to delete the service "${serviceName}"?`)) {
            try {
                const { services = {} } = await chrome.storage.sync.get('services');
                delete services[serviceName];
                await chrome.storage.sync.set({ services });
                await this.loadServices();
                PopupUtils.showStatus('Service deleted successfully');
            } catch (error) {
                PopupLogger.error('Error deleting service:', error);
                PopupUtils.showStatus('Failed to delete service', 'error');
            }
        }
    }
};

// Social links management
const SocialLinksManager = {
    async loadSocialLinks(servicesMap) {
        const container = document.getElementById('fieldsContainer');
        if (!container) {
            PopupLogger.error("Element with ID 'fieldsContainer' not found.");
            return;
        }

        container.innerHTML = '';

        try {
            const { socialLinks = {} } = await chrome.storage.sync.get('socialLinks');
            const serviceNames = Object.keys(servicesMap);

            serviceNames.forEach(service => {
                const div = document.createElement('div');
                div.className = 'field-item';
                const inputId = `service-input-${service}`;
                
                const serviceDisplay = service.charAt(0).toUpperCase() + service.slice(1);
                const escapedService = PopupUtils.escapeHtml(service);
                
                div.innerHTML = `
                    <label for="${inputId}">
                        ${serviceDisplay}:
                    </label>
                    <input type="url"
                           id="${inputId}"
                           data-service="${escapedService}"
                           value="${socialLinks[service] ? PopupUtils.escapeHtml(socialLinks[service]) : ''}"
                           placeholder="https://${service}.com/yourprofile">
                `;
                container.appendChild(div);
            });
        } catch (error) {
            PopupLogger.error('Error loading social links:', error);
            PopupUtils.showStatus('Failed to load social links', 'error');
        }
    },

    async saveLinks() {
        try {
            const socialLinks = {};
            const inputs = document.querySelectorAll('#fieldsContainer input[data-service]');

            // Validate URLs before saving
            let isValid = true;
            for (const input of inputs) {
                const service = input.dataset.service;
                const value = input.value.trim();
                if (value) {
                    if (!/^https?:\/\/.+/.test(value)) {
                        PopupUtils.showStatus(`Invalid URL format for ${service}. Must start with http:// or https://`, 'error');
                        input.focus();
                        isValid = false;
                        break;
                    }
                    socialLinks[service] = value;
                } else {
                    delete socialLinks[service];
                }
            }

            if (!isValid) {
                return;
            }

            const currentData = await chrome.storage.sync.get('socialLinks');
            const updatedLinks = { ...(currentData.socialLinks || {}), ...socialLinks };

            // Explicitly remove keys for services that now have empty inputs
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    delete updatedLinks[input.dataset.service];
                }
            });

            await chrome.storage.sync.set({ socialLinks: updatedLinks });
            PopupUtils.showStatus('Links saved! Reload pages to apply');
        } catch (error) {
            PopupLogger.error('Error saving links:', error);
            PopupUtils.showStatus('Failed to save links', 'error');
        }
    },

    async deleteLink(service) {
        try {
            const { socialLinks = {} } = await chrome.storage.sync.get('socialLinks');
            if (socialLinks[service]) {
                delete socialLinks[service];
                await chrome.storage.sync.set({ socialLinks });
                PopupUtils.showStatus(`Deleted ${service} link`);
                await this.loadLinks();
            }
        } catch (error) {
            PopupLogger.error('Error deleting link:', error);
            PopupUtils.showStatus('Failed to delete link', 'error');
        }
    }
};

// Password management
const PasswordManager = {
    async loadPasswords() {
        try {
            const { fillPassword } = await chrome.storage.sync.get('fillPassword');
            const passwordInput = document.getElementById('passwordValue');
            if (passwordInput) {
                passwordInput.value = fillPassword || '';
            }
        } catch (error) {
            PopupLogger.error('Error loading password:', error);
            PopupUtils.showStatus('Failed to load password', 'error');
        }
    },

    async savePassword() {
        try {
            const password = document.getElementById('passwordValue').value;
            if (!password) {
                PopupUtils.showStatus('Please enter a password', 'error');
                return;
            }

            await chrome.storage.sync.set({ fillPassword: password });
            PopupUtils.showStatus('Password saved successfully');
            this.clearPasswordForm();
        } catch (error) {
            PopupLogger.error('Error saving password:', error);
            PopupUtils.showStatus('Failed to save password', 'error');
        }
    },

    clearPasswordForm() {
        document.getElementById('passwordValue').value = '';
    },

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('passwordValue');
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
    }
};

// Reset functionality
const ResetManager = {
    async resetAll() {
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
                await PopupInitializer.initializePopup();

                PopupUtils.showStatus('All links cleared and services reset to default');
            } catch (error) {
                PopupLogger.error('Error resetting data:', error);
                PopupUtils.showStatus('Failed to reset data', 'error');
            }
        }
    }
};

// Event handling
const EventManager = {
    setupEventListeners() {
        // Save button for social links
        const saveButton = document.getElementById('saveButton');
        if (saveButton) {
            saveButton.addEventListener('click', SocialLinksManager.saveLinks);
        }

        // Reset button
        const resetButton = document.getElementById('resetButton');
        if (resetButton) {
            resetButton.addEventListener('click', ResetManager.resetAll);
        }

        // Add field button
        const addFieldButton = document.getElementById('addField');
        if (addFieldButton) {
            addFieldButton.addEventListener('click', this.addLinkField);
        }

        // Save service button
        const saveServiceButton = document.getElementById('saveService');
        if (saveServiceButton) {
            saveServiceButton.addEventListener('click', ServiceManager.saveService);
        }

        // Save password button
        const savePasswordButton = document.getElementById('savePassword');
        if (savePasswordButton) {
            savePasswordButton.addEventListener('click', PasswordManager.savePassword);
        }

        // Toggle password visibility button
        const togglePasswordButton = document.getElementById('togglePassword');
        if (togglePasswordButton) {
            togglePasswordButton.addEventListener('click', PasswordManager.togglePasswordVisibility);
        }

        // Event delegation for delete buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-link')) {
                const service = e.target.dataset.service;
                if (service) {
                    SocialLinksManager.deleteLink(service);
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
                        ServiceManager.loadServiceIntoEditor(serviceName, services[serviceName]);
                    }
                } else if (target.classList.contains('delete-service')) {
                    await ServiceManager.deleteService(target.dataset.service);
                }
            });
        }

        // Toggle buttons
        this.setupToggleButtons();
    },

    setupToggleButtons() {
        const toggleButtons = document.querySelectorAll('.toggle-button');
        toggleButtons.forEach(button => {
            const targetId = button.getAttribute('data-target');
            const targetDiv = document.getElementById(targetId);

            if (targetDiv) {
                button.addEventListener('click', function() {
                    if (targetDiv.style.display === 'none') {
                        targetDiv.style.display = 'block';
                    } else {
                        targetDiv.style.display = 'none';
                    }

                    button.style.backgroundColor = 'lightblue';
                    setTimeout(function() {
                        button.style.backgroundColor = '';
                    }, 200);
                });
            }
        });
    },

    addLinkField() {
        const selector = document.getElementById('serviceSelector');
        if (!selector || selector.value === 'custom') {
            PopupUtils.showStatus('Please select a service first', 'error');
            return;
        }

        const service = selector.value;
        const container = document.getElementById('fieldsContainer');
        if (!container) return;

        if (document.querySelector(`#fieldsContainer input[data-service="${service}"]`)) {
            PopupUtils.showStatus('This service already has a field', 'error');
            return;
        }

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
                value=""
            >
        `;

        container.appendChild(div);

        const input = document.getElementById(inputId);
        input?.focus();
    }
};

// Main popup initializer
const PopupInitializer = {
    async initializePopup() {
        try {
            // Get services from background script
            const { services } = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type: "GET_SERVICES" }, response => {
                    if (chrome.runtime.lastError) {
                        PopupLogger.error("Error getting services:", chrome.runtime.lastError.message);
                        reject(new Error(`Failed to get services: ${chrome.runtime.lastError.message}`));
                    } else if (response?.services) {
                        // Convert stored patterns back to RegExp objects
                        Object.values(response.services).forEach(config => {
                            if (config.patterns && Array.isArray(config.patterns)) {
                                try {
                                    config.patterns = config.patterns
                                        .filter(p => p && typeof p.source === 'string')
                                        .map(p => new RegExp(p.source, p.flags || ''));
                                } catch (e) {
                                    PopupLogger.error("Error converting stored pattern to RegExp:", config, e);
                                    config.patterns = [];
                                }
                            } else {
                                config.patterns = [];
                            }
                            if (!config.keywords) config.keywords = [];
                        });
                        resolve(response);
                    } else {
                        PopupLogger.warn("No services data received from background, resolving with empty.");
                        resolve({ services: {} });
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
                const currentSelection = serviceSelector.value;
                serviceSelector.innerHTML = '<option value="custom">Select a service...</option>';
                serviceNames.sort().forEach(service => {
                    const option = document.createElement('option');
                    option.value = service;
                    option.textContent = service.charAt(0).toUpperCase() + service.slice(1);
                    serviceSelector.appendChild(option);
                });
                if (serviceNames.includes(currentSelection)) {
                    serviceSelector.value = currentSelection;
                }
            }

            // Load and display services list
            await ServiceManager.loadServices();

            // Load and display social links using the loaded services map
            await SocialLinksManager.loadSocialLinks(services);

            // Load saved passwords
            await PasswordManager.loadPasswords();

        } catch (error) {
            PopupLogger.error('Initialization error:', error);
            PopupUtils.showStatus('Failed to initialize extension. Please reload popup.', 'error');
            const controls = document.querySelectorAll('button, input, select, textarea');
            controls.forEach(c => c.disabled = true);
            document.getElementById('status').className = 'status error';
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await PopupInitializer.initializePopup();
    EventManager.setupEventListeners();
});

// Export for global access
window.PopupCore = {
    PopupLogger,
    PopupUtils,
    ServiceManager,
    SocialLinksManager,
    PasswordManager,
    ResetManager,
    EventManager,
    PopupInitializer
};
