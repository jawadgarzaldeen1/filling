// Comprehensive Duplicate Prevention System
const DuplicatePrevention = {
    // Configuration
    config: {
        strictMode: true, // If true, prevents duplicates completely. If false, warns but allows.
        caseSensitive: false, // Whether to consider case when checking duplicates
        trimWhitespace: true, // Whether to trim whitespace before comparison
        normalizeUrls: true, // Whether to normalize URLs before comparison
        similarityThreshold: 0.8 // Threshold for similarity-based duplicate detection (0-1)
    },

    // Initialize the duplicate prevention system
    initialize() {
        this.setupUniversalFormValidation();
        this.setupSocialLinksValidation();
        this.setupGoogleSheetsValidation();
        console.log('[DUPLICATE-PREVENTION] System initialized');
    },

    // Setup validation for universal form fields
    setupUniversalFormValidation() {
        const fieldsToValidate = [
            'universal-title', 'universal-company', 'universal-email',
            'universal-phone', 'universal-website', 'universal-keywords'
        ];

        fieldsToValidate.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                const debouncedValidation = this.debounce((event) => {
                    this.validateUniversalField(fieldId, event.target.value);
                }, 300);

                field.addEventListener('input', debouncedValidation);
                field.addEventListener('blur', (event) => {
                    this.validateUniversalField(fieldId, event.target.value);
                });
            }
        });
    },

    // Setup validation for social links
    setupSocialLinksValidation() {
        // This will be called when social links are being added/updated
        if (window.PopupCore && window.PopupCore.SocialLinksManager) {
            const originalAddMethod = window.PopupCore.SocialLinksManager.addSocialLink;
            const originalUpdateMethod = window.PopupCore.SocialLinksManager.updateSocialLink;

            // Override addSocialLink to include duplicate checking
            window.PopupCore.SocialLinksManager.addSocialLink = async (platform, url) => {
                const duplicateCheck = await this.checkSocialLinkDuplicate(platform, url);
                if (duplicateCheck.isDuplicate) {
                    if (this.config.strictMode) {
                        throw new Error(`Duplicate found: ${duplicateCheck.message}`);
                    } else {
                        console.warn(`[DUPLICATE-PREVENTION] Warning: ${duplicateCheck.message}`);
                    }
                }
                return originalAddMethod.call(window.PopupCore.SocialLinksManager, platform, url);
            };

            // Override updateSocialLink to include duplicate checking
            window.PopupCore.SocialLinksManager.updateSocialLink = async (id, updates) => {
                if (updates.platform || updates.url) {
                    const duplicateCheck = await this.checkSocialLinkUpdateDuplicate(id, updates);
                    if (duplicateCheck.isDuplicate) {
                        if (this.config.strictMode) {
                            throw new Error(`Duplicate found: ${duplicateCheck.message}`);
                        } else {
                            console.warn(`[DUPLICATE-PREVENTION] Warning: ${duplicateCheck.message}`);
                        }
                    }
                }
                return originalUpdateMethod.call(window.PopupCore.SocialLinksManager, id, updates);
            };
        }
    },

    // Setup validation for Google Sheets import
    setupGoogleSheetsValidation() {
        // This will be called during Google Sheets import
        if (window.GoogleSheetsParser) {
            const originalImportMethod = window.GoogleSheetsParser.importGoogleSheetsData;
            
            window.GoogleSheetsParser.importGoogleSheetsData = async (rawData) => {
                const result = await originalImportMethod.call(window.GoogleSheetsParser, rawData);
                
                // Check for duplicates in imported data
                await this.validateImportedData(result);
                
                return result;
            };
        }
    },

    // Validate universal form field for duplicates
    async validateUniversalField(fieldId, value) {
        if (!value || value.trim().length === 0) {
            this.clearFieldValidation(fieldId);
            return;
        }

        try {
            const normalizedValue = this.normalizeValue(value);
            const existingData = await this.getExistingUniversalData();
            
            // Check for exact duplicates
            const exactDuplicate = this.findExactDuplicate(normalizedValue, existingData, fieldId);
            if (exactDuplicate) {
                this.showFieldValidation(fieldId, `This ${this.getFieldDisplayName(fieldId)} already exists`, 'error');
                return;
            }

            // Check for similar values
            const similarValue = this.findSimilarValue(normalizedValue, existingData, fieldId);
            if (similarValue) {
                this.showFieldValidation(fieldId, `Similar ${this.getFieldDisplayName(fieldId)} found: "${similarValue}"`, 'warning');
                return;
            }

            this.clearFieldValidation(fieldId);
        } catch (error) {
            console.error('[DUPLICATE-PREVENTION] Error validating field:', error);
        }
    },

    // Check for social link duplicates
    async checkSocialLinkDuplicate(platform, url) {
        try {
            const existingLinks = await this.getExistingSocialLinks();
            const normalizedUrl = this.normalizeUrl(url);
            const normalizedPlatform = this.normalizeValue(platform);

            // Check for exact platform duplicate
            const platformDuplicate = existingLinks.find(link => 
                this.normalizeValue(link.platform) === normalizedPlatform
            );
            if (platformDuplicate) {
                return {
                    isDuplicate: true,
                    message: `Platform "${platform}" already exists with URL "${platformDuplicate.url}"`
                };
            }

            // Check for exact URL duplicate
            const urlDuplicate = existingLinks.find(link => 
                this.normalizeUrl(link.url) === normalizedUrl
            );
            if (urlDuplicate) {
                return {
                    isDuplicate: true,
                    message: `URL "${url}" already exists for platform "${urlDuplicate.platform}"`
                };
            }

            // Check for similar URLs
            const similarUrl = existingLinks.find(link => {
                const similarity = this.calculateUrlSimilarity(normalizedUrl, this.normalizeUrl(link.url));
                return similarity > this.config.similarityThreshold;
            });
            if (similarUrl) {
                return {
                    isDuplicate: true,
                    message: `Similar URL already exists: "${similarUrl.url}" for platform "${similarUrl.platform}"`
                };
            }

            return { isDuplicate: false };
        } catch (error) {
            console.error('[DUPLICATE-PREVENTION] Error checking social link duplicate:', error);
            return { isDuplicate: false };
        }
    },

    // Check for social link update duplicates
    async checkSocialLinkUpdateDuplicate(id, updates) {
        try {
            const existingLinks = await this.getExistingSocialLinks();
            const currentLink = existingLinks.find(link => link.id === id);
            if (!currentLink) {
                return { isDuplicate: false };
            }

            const updatedLink = { ...currentLink, ...updates };
            
            // Check against other links (excluding current one)
            const otherLinks = existingLinks.filter(link => link.id !== id);
            
            if (updates.platform) {
                const platformDuplicate = otherLinks.find(link => 
                    this.normalizeValue(link.platform) === this.normalizeValue(updatedLink.platform)
                );
                if (platformDuplicate) {
                    return {
                        isDuplicate: true,
                        message: `Platform "${updatedLink.platform}" already exists`
                    };
                }
            }

            if (updates.url) {
                const urlDuplicate = otherLinks.find(link => 
                    this.normalizeUrl(link.url) === this.normalizeUrl(updatedLink.url)
                );
                if (urlDuplicate) {
                    return {
                        isDuplicate: true,
                        message: `URL "${updatedLink.url}" already exists for platform "${urlDuplicate.platform}"`
                    };
                }
            }

            return { isDuplicate: false };
        } catch (error) {
            console.error('[DUPLICATE-PREVENTION] Error checking update duplicate:', error);
            return { isDuplicate: false };
        }
    },

    // Validate imported data for duplicates
    async validateImportedData(importedData) {
        try {
            const duplicates = [];
            const warnings = [];

            // Check universal form data
            if (importedData.universalFormData) {
                const existingData = await this.getExistingUniversalData();
                
                Object.entries(importedData.universalFormData).forEach(([field, value]) => {
                    if (value && value.trim().length > 0) {
                        const normalizedValue = this.normalizeValue(value);
                        const exactDuplicate = this.findExactDuplicate(normalizedValue, existingData, field);
                        
                        if (exactDuplicate) {
                            duplicates.push(`${field}: "${value}"`);
                        } else {
                            const similarValue = this.findSimilarValue(normalizedValue, existingData, field);
                            if (similarValue) {
                                warnings.push(`${field}: "${value}" (similar to "${similarValue}")`);
                            }
                        }
                    }
                });
            }

            // Check social links
            if (importedData.socialLinks) {
                const existingLinks = await this.getExistingSocialLinks();
                
                Object.entries(importedData.socialLinks).forEach(([platform, url]) => {
                    const duplicateCheck = this.checkSocialLinkDuplicate(platform, url);
                    if (duplicateCheck.isDuplicate) {
                        duplicates.push(`Social link ${platform}: "${url}"`);
                    }
                });
            }

            // Report findings
            if (duplicates.length > 0) {
                console.warn('[DUPLICATE-PREVENTION] Duplicates found in import:', duplicates);
                if (window.PopupCore && window.PopupCore.PopupUtils) {
                    window.PopupCore.PopupUtils.showStatus(
                        `Import completed with ${duplicates.length} duplicate(s) found`, 
                        'warning'
                    );
                }
            }

            if (warnings.length > 0) {
                console.info('[DUPLICATE-PREVENTION] Similar values found in import:', warnings);
            }

        } catch (error) {
            console.error('[DUPLICATE-PREVENTION] Error validating imported data:', error);
        }
    },

    // Utility methods
    normalizeValue(value) {
        if (!value) return '';
        let normalized = value.toString();
        
        if (this.config.trimWhitespace) {
            normalized = normalized.trim();
        }
        
        if (!this.config.caseSensitive) {
            normalized = normalized.toLowerCase();
        }
        
        return normalized;
    },

    normalizeUrl(url) {
        if (!url) return '';
        
        if (!this.config.normalizeUrls) {
            return this.normalizeValue(url);
        }

        try {
            const urlObj = new URL(url);
            return this.normalizeValue(urlObj.href);
        } catch {
            return this.normalizeValue(url);
        }
    },

    calculateUrlSimilarity(url1, url2) {
        // Simple similarity calculation based on common substrings
        const longer = url1.length > url2.length ? url1 : url2;
        const shorter = url1.length > url2.length ? url2 : url1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    },

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    },

    findExactDuplicate(value, existingData, fieldId) {
        const fieldKey = this.getFieldKey(fieldId);
        if (!fieldKey) return null;
        
        return existingData[fieldKey] === value;
    },

    findSimilarValue(value, existingData, fieldId) {
        const fieldKey = this.getFieldKey(fieldId);
        if (!fieldKey) return null;
        
        const existingValue = existingData[fieldKey];
        if (!existingValue) return null;
        
        const similarity = this.calculateUrlSimilarity(value, existingValue);
        return similarity > this.config.similarityThreshold ? existingValue : null;
    },

    getFieldKey(fieldId) {
        const mapping = {
            'universal-title': 'title',
            'universal-company': 'company',
            'universal-email': 'email',
            'universal-phone': 'phone',
            'universal-website': 'website',
            'universal-keywords': 'keywords'
        };
        return mapping[fieldId];
    },

    getFieldDisplayName(fieldId) {
        const mapping = {
            'universal-title': 'title',
            'universal-company': 'company name',
            'universal-email': 'email address',
            'universal-phone': 'phone number',
            'universal-website': 'website',
            'universal-keywords': 'keywords'
        };
        return mapping[fieldId] || 'value';
    },

    async getExistingUniversalData() {
        try {
            const { universalFormData = {} } = await chrome.storage.sync.get('universalFormData');
            const normalized = {};
            
            Object.entries(universalFormData).forEach(([key, value]) => {
                normalized[key] = this.normalizeValue(value);
            });
            
            return normalized;
        } catch (error) {
            console.error('[DUPLICATE-PREVENTION] Error getting existing universal data:', error);
            return {};
        }
    },

    async getExistingSocialLinks() {
        try {
            if (window.PopupCore && window.PopupCore.SocialLinksManager) {
                return await window.PopupCore.SocialLinksManager.getSocialLinks();
            }
            
            // Fallback to direct storage access
            const { socialLinks = [] } = await chrome.storage.sync.get('socialLinks');
            return Array.isArray(socialLinks) ? socialLinks : [];
        } catch (error) {
            console.error('[DUPLICATE-PREVENTION] Error getting existing social links:', error);
            return [];
        }
    },

    showFieldValidation(fieldId, message, type) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Remove existing validation
        this.clearFieldValidation(fieldId);

        // Add validation styling
        field.style.borderColor = type === 'error' ? '#ff6b6b' : '#ffa726';
        field.style.backgroundColor = type === 'error' ? '#ffebee' : '#fff3e0';

        // Create validation message
        const validationDiv = document.createElement('div');
        validationDiv.className = `validation-message ${type}`;
        validationDiv.textContent = message;
        validationDiv.style.cssText = `
            font-size: 11px;
            color: ${type === 'error' ? '#d32f2f' : '#f57c00'};
            margin-top: 2px;
            padding: 2px 5px;
            background: ${type === 'error' ? '#ffebee' : '#fff3e0'};
            border-radius: 3px;
            border-left: 3px solid ${type === 'error' ? '#d32f2f' : '#f57c00'};
        `;

        field.parentNode.insertBefore(validationDiv, field.nextSibling);
    },

    clearFieldValidation(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Remove styling
        field.style.borderColor = '';
        field.style.backgroundColor = '';

        // Remove validation message
        const existingMessage = field.parentNode.querySelector('.validation-message');
        if (existingMessage) {
            existingMessage.remove();
        }
    },

    // Debounce function
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

    // Manual duplicate cleanup function
    async cleanupDuplicates() {
        try {
            let cleanedCount = 0;

            // Clean social links duplicates
            if (window.PopupCore && window.PopupCore.SocialLinksManager) {
                const removedCount = await window.PopupCore.SocialLinksManager.removeDuplicates();
                cleanedCount += removedCount;
            }

            // Clean universal form data duplicates (if any)
            const existingData = await this.getExistingUniversalData();
            const cleanedData = this.removeUniversalDuplicates(existingData);
            if (Object.keys(cleanedData).length !== Object.keys(existingData).length) {
                await chrome.storage.sync.set({ universalFormData: cleanedData });
                cleanedCount += Object.keys(existingData).length - Object.keys(cleanedData).length;
            }

            if (cleanedCount > 0) {
                console.log(`[DUPLICATE-PREVENTION] Cleaned ${cleanedCount} duplicate(s)`);
                if (window.PopupCore && window.PopupCore.PopupUtils) {
                    window.PopupCore.PopupUtils.showStatus(`Cleaned ${cleanedCount} duplicate(s)`);
                }
            } else {
                console.log('[DUPLICATE-PREVENTION] No duplicates found');
                if (window.PopupCore && window.PopupCore.PopupUtils) {
                    window.PopupCore.PopupUtils.showStatus('No duplicates found');
                }
            }

            return cleanedCount;
        } catch (error) {
            console.error('[DUPLICATE-PREVENTION] Error cleaning duplicates:', error);
            throw error;
        }
    },

    removeUniversalDuplicates(data) {
        // This is a placeholder for universal form data duplicate removal
        // In practice, universal form data typically doesn't have duplicates
        // since each field represents a single value
        return data;
    }
};

// Make it globally available
window.DuplicatePrevention = DuplicatePrevention;
