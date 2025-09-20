// Universal form functionality for popup
const UniversalFormManager = {
    addUniversalFormSection() {
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
    },

    async loadUniversalData() {
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
            
            window.PopupCore.PopupLogger.log('Universal data loaded:', universalFormData);
        } catch (error) {
            window.PopupCore.PopupLogger.error('Error loading universal data:', error);
        }
    },

    async saveUniversalData() {
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
            window.PopupCore.PopupUtils.showStatus('Universal data saved! Will auto-fill on any website.');
            
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
            window.PopupCore.PopupLogger.error('Error saving universal data:', error);
            window.PopupCore.PopupUtils.showStatus('Failed to save universal data', 'error');
        }
    },

    async autoFillFromSocial() {
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
            
            window.PopupCore.PopupUtils.showStatus('Auto-filled from social links');
        } catch (error) {
            window.PopupCore.PopupLogger.error('Error auto-filling:', error);
        }
    },

    setupEventListeners() {
        const saveUniversalButton = document.getElementById('saveUniversalData');
        if (saveUniversalButton) {
            saveUniversalButton.addEventListener('click', this.saveUniversalData);
        }
        
        const autoFillButton = document.getElementById('autoFillFromSocial');
        if (autoFillButton) {
            autoFillButton.addEventListener('click', this.autoFillFromSocial);
        }
    }
};

// Google Sheets data parser
const GoogleSheetsParser = {
    parseGoogleSheetsData(rawData) {
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
    },

    async importGoogleSheetsData(rawData) {
        try {
            const parsedData = this.parseGoogleSheetsData(rawData);
            
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
            
            window.PopupCore.PopupUtils.showStatus(`Successfully imported data: ${Object.keys(parsedData.universalFormData).length} form fields, ${Object.keys(parsedData.socialLinks).length} social links`);
            
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
            window.PopupCore.PopupLogger.error('Error importing Google Sheets data:', error);
            window.PopupCore.PopupUtils.showStatus('Failed to import data - please check format', 'error');
            throw error;
        }
    },

    addGoogleSheetsImporter() {
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
    },

    setupGoogleSheetsImport() {
        const importButton = document.getElementById('importSheetsData');
        const clearButton = document.getElementById('clearImportData');
        const importTextarea = document.getElementById('sheetsImportData');
        
        if (importButton && importTextarea) {
            importButton.addEventListener('click', async () => {
                const rawData = importTextarea.value.trim();
                if (!rawData) {
                    window.PopupCore.PopupUtils.showStatus('Please paste your Google Sheets data first', 'error');
                    return;
                }
                
                try {
                    importButton.disabled = true;
                    importButton.textContent = 'Importing...';
                    
                    await this.importGoogleSheetsData(rawData);
                    
                    // Clear the textarea after successful import
                    importTextarea.value = '';
                    
                } catch (error) {
                    window.PopupCore.PopupLogger.error('Import failed:', error);
                } finally {
                    importButton.disabled = false;
                    importButton.textContent = 'Import & Fill All Data';
                }
            });
        }
        
        if (clearButton && importTextarea) {
            clearButton.addEventListener('click', () => {
                importTextarea.value = '';
                window.PopupCore.PopupUtils.showStatus('Import box cleared');
            });
        }
    }
};

// Enhanced reset functionality
const EnhancedResetManager = {
    async resetAllUniversal() {
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
                window.PopupCore.PopupLogger.error('Reset error:', error);
                window.PopupCore.PopupUtils.showStatus('Failed to reset', 'error');
            }
        }
    }
};

// Initialize universal form functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for core to be available
    if (!window.PopupCore) {
        setTimeout(() => {
            document.dispatchEvent(new Event('DOMContentLoaded'));
        }, 100);
        return;
    }

    // Add universal form section
    UniversalFormManager.addUniversalFormSection();
    
    // Load universal data
    await UniversalFormManager.loadUniversalData();
    
    // Setup event listeners
    UniversalFormManager.setupEventListeners();
    
    // Add Google Sheets importer
    GoogleSheetsParser.addGoogleSheetsImporter();
    GoogleSheetsParser.setupGoogleSheetsImport();
    
    // Replace the reset button functionality
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.removeEventListener('click', window.PopupCore.ResetManager.resetAll);
        resetButton.addEventListener('click', EnhancedResetManager.resetAllUniversal);
    }
    
    // Enhanced save button
    const saveButton = document.getElementById('saveButton');
    if (saveButton) {
        const originalClick = saveButton.onclick;
        saveButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await window.PopupCore.SocialLinksManager.saveLinks();
            await UniversalFormManager.saveUniversalData();
        });
    }
    
    window.PopupCore.PopupLogger.log('Universal form system added to popup');
});

// Export for global access
window.UniversalFormManager = UniversalFormManager;
window.GoogleSheetsParser = GoogleSheetsParser;
window.EnhancedResetManager = EnhancedResetManager;
