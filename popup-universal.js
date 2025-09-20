/**
 * Universal Popup Module for Social Filler Pro Extension
 * 
 * This module provides:
 * - Universal form data management
 * - Google Sheets import functionality
 * - Description auto-fill integration
 * - Duplicate prevention integration
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

// ============================================================================
// UNIVERSAL FORM MANAGER
// ============================================================================

class UniversalFormManager {
    constructor(logger) {
        this.logger = logger;
        this.universalFormData = {};
    }

    /**
     * Load universal form data from storage
     */
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

    /**
     * Save universal form data to storage
     */
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

    /**
     * Load universal form data into UI
     */
    async loadUniversalFormUI() {
        try {
            await this.loadUniversalFormData();
            
            // Map data to UI fields
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
                if (field && this.universalFormData[dataKey]) {
                    field.value = this.universalFormData[dataKey];
                }
            });

            this.logger.debug('Universal form UI loaded');
        } catch (error) {
            this.logger.error('Error loading universal form UI:', error);
        }
    }

    /**
     * Save universal form data from UI
     */
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
                    if (value) {
                        this.universalFormData[dataKey] = value;
                    } else {
                        delete this.universalFormData[dataKey];
                    }
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

    /**
     * Clear universal form data
     */
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

    /**
     * Get universal form data
     */
    getUniversalFormData() {
        return { ...this.universalFormData };
    }

    /**
     * Set universal form data
     */
    setUniversalFormData(data) {
        this.universalFormData = { ...data };
    }
}

// ============================================================================
// GOOGLE SHEETS PARSER
// ============================================================================

class GoogleSheetsParser {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Parse Google Sheets data
     */
    parseGoogleSheetsData(rawData) {
        try {
            // Use enhanced parser if available, fallback to optimized parser, then basic implementation
            if (window.EnhancedSheetsParser) {
                return window.EnhancedSheetsParser.parseGoogleSheetsData(rawData);
            }
            if (window.OptimizedSheetsParser) {
                return window.OptimizedSheetsParser.parseGoogleSheetsData(rawData);
            }
            
            // Fallback to basic implementation
            return this.basicParseGoogleSheetsData(rawData);
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

    /**
     * Basic Google Sheets data parser
     */
    basicParseGoogleSheetsData(rawData) {
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
}

// ============================================================================
// GOOGLE SHEETS IMPORTER
// ============================================================================

class GoogleSheetsImporter {
    constructor(logger, universalFormManager, socialLinksManager) {
        this.logger = logger;
        this.universalFormManager = universalFormManager;
        this.socialLinksManager = socialLinksManager;
        this.parser = new GoogleSheetsParser(logger);
    }

    /**
     * Import Google Sheets data
     */
    async importGoogleSheetsData(rawData) {
        try {
            this.logger.info('Starting Google Sheets import...');
            
            // Parse the data
            const parsedData = this.parser.parseGoogleSheetsData(rawData);
            this.logger.debug('Parsed data:', parsedData);
            
            // Handle parsing errors and warnings
            if (parsedData.errors && parsedData.errors.length > 0) {
                this.logger.error('Parsing errors:', parsedData.errors);
                PopupUtils.showStatus(`Import failed: ${parsedData.errors.join(', ')}`, 'error');
                return parsedData;
            }
            
            if (parsedData.warnings && parsedData.warnings.length > 0) {
                this.logger.warn('Parsing warnings:', parsedData.warnings);
            }
            
            let importedCount = 0;
            let errors = [];
            
            // Auto-generate description if missing
            if (!parsedData.universalFormData.description && window.EnhancedSheetsParser) {
                const generatedDesc = window.EnhancedSheetsParser.generateDescription(parsedData);
                if (generatedDesc) {
                    parsedData.universalFormData.description = generatedDesc;
                    this.logger.debug('Auto-generated description:', generatedDesc);
                }
            }
            
            // Save universal form data
            if (parsedData.universalFormData && Object.keys(parsedData.universalFormData).length > 0) {
                try {
                    this.universalFormManager.setUniversalFormData(parsedData.universalFormData);
                    await this.universalFormManager.saveUniversalFormData();
                    this.logger.debug('Saved universal form data:', parsedData.universalFormData);
                    
                    // Update UI fields if they exist
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
            
            // Save social links with duplicate prevention
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
            
            // Save password if exists
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
            
            // Show comprehensive status message
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
            
            // Show detailed info in console
            if (parsedData.stats) {
                this.logger.info(`Stats: ${parsedData.stats.fieldsExtracted} fields extracted in ${parsedData.stats.processingTime.toFixed(2)}ms`);
            }
            
            // Notify content scripts
            await this.notifyContentScripts(parsedData);
            
            return parsedData;
            
        } catch (error) {
            this.logger.error('Critical error during import:', error);
            PopupUtils.showStatus(`Import failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Notify content scripts about import
     */
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

    /**
     * Setup Google Sheets import UI
     */
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
                    // Update UI to show importing state
                    importButton.disabled = true;
                    importButton.innerHTML = '⏳ Importing...';
                    importButton.style.background = '#ff9800';
                    
                    this.showImportStatus('Parsing and importing data...', 'info');
                    
                    // Import the data
                    const result = await this.importGoogleSheetsData(rawData);
                    
                    // Show success
                    this.showImportStatus(`✅ Successfully imported data! Check the fields below.`, 'success');
                    
                    // Clear the textarea after successful import
                    setTimeout(() => {
                        importTextarea.value = '';
                        this.hideImportStatus();
                    }, 3000);
                    
                } catch (error) {
                    this.logger.error('Import failed:', error);
                    this.showImportStatus(`❌ Import failed: ${error.message}`, 'error');
                } finally {
                    // Reset button state
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
        
        // Add real-time validation
        if (importTextarea) {
            importTextarea.addEventListener('input', () => {
                const value = importTextarea.value.trim();
                if (value.length > 0) {
                    // Check if it looks like Google Sheets data
                    const hasLabels = /(\*\*.*?\*\*|Phone #|Website:|Email:)/i.test(value);
                    if (hasLabels) {
                        this.showImportStatus('✅ Data format looks good!', 'success');
                    } else {
                        this.showImportStatus('⚠️ Make sure your data includes field labels like "**Business name:**"', 'warning');
                    }
                } else {
                    this.hideImportStatus();
                }
            });
        }
    }

    /**
     * Show import status message
     */
    showImportStatus(message, type = 'info') {
        const importStatus = document.getElementById('importStatus');
        if (importStatus) {
            importStatus.textContent = message;
            importStatus.style.display = 'block';
            
            // Set colors based on type
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
    }

    /**
     * Hide import status message
     */
    hideImportStatus() {
        const importStatus = document.getElementById('importStatus');
        if (importStatus) {
            importStatus.style.display = 'none';
        }
    }
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

class IntegrationHelper {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Add description auto-fill button
     */
    addDescriptionAutoFillButton() {
        const descriptionField = document.getElementById('universal-description');
        if (!descriptionField) return;

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'description-auto-fill-container';
        buttonContainer.style.cssText = `
            display: flex;
            gap: 5px;
            margin-top: 5px;
            align-items: center;
        `;

        // Create auto-fill button
        const autoFillButton = document.createElement('button');
        autoFillButton.textContent = '✨ Auto-Generate';
        autoFillButton.className = 'auto-fill-btn';
        autoFillButton.style.cssText = `
            background: #4CAF50;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        `;

        autoFillButton.addEventListener('click', () => {
            if (window.DescriptionAutoFiller) {
                const description = window.DescriptionAutoFiller.generateDescriptionManually();
                if (description) {
                    PopupUtils.showStatus('Description auto-generated successfully!');
                } else {
                    PopupUtils.showStatus('Could not generate description. Please fill in business name and keywords first.', 'warning');
                }
            }
        });

        // Create template selector
        const templateSelect = document.createElement('select');
        templateSelect.className = 'template-select';
        templateSelect.style.cssText = `
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
        `;

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
                if (description) {
                    PopupUtils.showStatus(`Description generated using ${templateType} template!`);
                }
            }
        });

        // Add elements to container
        buttonContainer.appendChild(autoFillButton);
        buttonContainer.appendChild(templateSelect);

        // Insert after description field
        descriptionField.parentNode.insertBefore(buttonContainer, descriptionField.nextSibling);

        // Add hover effect
        autoFillButton.addEventListener('mouseenter', () => {
            autoFillButton.style.backgroundColor = '#45a049';
        });

        autoFillButton.addEventListener('mouseleave', () => {
            autoFillButton.style.backgroundColor = '#4CAF50';
        });
    }

    /**
     * Add duplicate cleanup button
     */
    addDuplicateCleanupButton() {
        // Add duplicate cleanup button to the main button group
        const buttonGroup = document.querySelector('.button-group');
        if (!buttonGroup) return;

        const cleanupButton = document.createElement('button');
        cleanupButton.textContent = '🧹 Clean Duplicates';
        cleanupButton.className = 'cleanup-duplicates-btn';
        cleanupButton.style.cssText = `
            background: #ff9800;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
            margin-left: 5px;
        `;

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
// INITIALIZATION
// ============================================================================

// Initialize universal popup module when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for main popup to initialize
    setTimeout(() => {
        if (window.popupInitializer && window.popupInitializer.logger) {
            const logger = window.popupInitializer.logger;
            
            // Initialize universal form manager
            window.universalFormManager = new UniversalFormManager(logger);
            
            // Initialize Google Sheets importer
            window.googleSheetsImporter = new GoogleSheetsImporter(
                logger,
                window.universalFormManager,
                window.popupInitializer.socialLinksManager
            );
            
            // Initialize integration helper
            window.integrationHelper = new IntegrationHelper(logger);
            
            // Setup Google Sheets import
            window.googleSheetsImporter.setupGoogleSheetsImport();
            
            // Load universal form data
            window.universalFormManager.loadUniversalFormUI();
            
            // Initialize description auto-filler integration
            if (window.DescriptionAutoFiller) {
                window.DescriptionAutoFiller.initialize();
                window.integrationHelper.addDescriptionAutoFillButton();
            }
            
            // Initialize duplicate prevention integration
            if (window.DuplicatePrevention) {
                window.DuplicatePrevention.initialize();
                window.integrationHelper.addDuplicateCleanupButton();
            }
            
            logger.info('Universal popup module initialized successfully');
        }
    }, 1000);
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        UniversalFormManager,
        GoogleSheetsParser,
        GoogleSheetsImporter,
        IntegrationHelper
    };
}
