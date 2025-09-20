// Optimized Google Sheets parser with advanced pattern matching
const OptimizedSheetsParser = {
    // Pre-compiled regex patterns for better performance
    patterns: {
        // Business information patterns
        businessName: /\*\*Business name:\*\*(.+?)(?:\*\*|$)/i,
        phone: /Phone #(.+?)(?:\*\*|$)/i,
        address: /\*\*Address:\*\*(.+?)(?:\*\*|$)/i,
        city: /\*\*City:\*\*(.+?)(?:\*\*|$)/i,
        state: /\*\*State:\*\*(.+?)(?:\*\*|$)/i,
        zip: /\*\*Zip:\*\*(.+?)(?:\*\*|$)/i,
        hours: /Hours:(.+?)(?:\*\*|$)/i,
        username: /\*\*Username:\*\*(.+?)(?:\*\*|$)/i,
        contractSigner: /\*\*Contract signer name:\*\*(.+?)(?:\*\*|$)/i,
        
        // Social media patterns (optimized)
        website: /Website:(https?:\/\/[^\s\*]+)/i,
        facebook: /(https?:\/\/(?:www\.)?facebook\.com[^\s\*]+)/i,
        instagram: /(https?:\/\/(?:www\.)?instagram\.com[^\s\*]+)/i,
        youtube: /(https?:\/\/(?:www\.)?youtube\.com[^\s\*]+)/i,
        pinterest: /(https?:\/\/(?:www\.)?pinterest\.com[^\s\*]+)/i,
        twitter: /(https?:\/\/(?:x\.com|twitter\.com)[^\s\*]+)/i,
        linkedin: /(https?:\/\/(?:www\.)?linkedin\.com[^\s\*]+)/i,
        tiktok: /(https?:\/\/(?:www\.)?tiktok\.com[^\s\*]+)/i,
        
        // Contact information
        email: /Email:([^\s\*]+@[^\s\*]+)/i,
        password: /\*\*PW:\*\*([^\*\s]+)/i,
        
        // Keywords and description
        keywords: /\*\*Keywords:\*\*(.+?)(?:\*\*|$)/i,
        description: /(?:Description|About|Info):(.+?)(?:\*\*|$)/i
    },
    
    // Field mapping for universal form data
    fieldMappings: {
        businessName: ['title', 'company'],
        phone: ['phone'],
        address: ['address'],
        city: ['city'],
        state: ['state'],
        zip: ['zipcode'],
        email: ['email'],
        website: ['website'],
        description: ['description']
    },
    
    // Cache for parsed data
    cache: new Map(),
    
    // Main parsing function with performance optimization
    parseGoogleSheetsData(rawData) {
        if (!rawData || typeof rawData !== 'string') {
            console.warn('[PARSER] Invalid input data');
            return this.getEmptyResult();
        }
        
        // Check cache first (but limit cache size to prevent memory issues)
        const cacheKey = this.generateCacheKey(rawData);
        if (this.cache.has(cacheKey)) {
            console.log('[PARSER] Using cached result');
            return this.cache.get(cacheKey);
        }
        
        const startTime = performance.now();
        
        try {
            const result = this.performParsing(rawData);
            const duration = performance.now() - startTime;
            
            // Cache the result (with size limit)
            if (this.cache.size < 10) { // Limit cache to 10 entries
                this.cache.set(cacheKey, result);
            }
            
            console.log(`[PARSER] Parsed data in ${duration.toFixed(2)}ms, found:`, {
                universalFields: Object.keys(result.universalFormData).length,
                socialLinks: Object.keys(result.socialLinks).length,
                hasPassword: !!result.passwords.main
            });
            return result;
        } catch (error) {
            console.error('[PARSER] Error parsing data:', error);
            return this.getEmptyResult();
        }
    },
    
    performParsing(rawData) {
        const parsedData = this.getEmptyResult();
        
        // Process lines efficiently
        const lines = this.processLines(rawData);
        const fullText = lines.join(' ');
        
        // Extract data using optimized patterns
        this.extractBusinessInfo(fullText, parsedData);
        this.extractSocialLinks(fullText, parsedData);
        this.extractContactInfo(fullText, parsedData);
        this.extractKeywords(lines, parsedData);
        this.extractDescription(lines, parsedData);
        
        // Post-process and validate data
        this.postProcessData(parsedData);
        
        return parsedData;
    },
    
    processLines(rawData) {
        return rawData
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
    },
    
    extractBusinessInfo(fullText, parsedData) {
        const businessInfo = {
            businessName: this.extractPattern(fullText, 'businessName'),
            phone: this.extractPattern(fullText, 'phone'),
            address: this.extractPattern(fullText, 'address'),
            city: this.extractPattern(fullText, 'city'),
            state: this.extractPattern(fullText, 'state'),
            zip: this.extractPattern(fullText, 'zip'),
            hours: this.extractPattern(fullText, 'hours'),
            username: this.extractPattern(fullText, 'username'),
            contractSigner: this.extractPattern(fullText, 'contractSigner')
        };
        
        // Map to universal form data
        this.mapToUniversalForm(businessInfo, parsedData);
        
        // Add to metadata
        Object.entries(businessInfo).forEach(([key, value]) => {
            if (value) {
                parsedData.metadata[key] = value;
            }
        });
    },
    
    extractSocialLinks(fullText, parsedData) {
        const socialPlatforms = ['website', 'facebook', 'instagram', 'youtube', 'pinterest', 'twitter', 'linkedin', 'tiktok'];
        
        socialPlatforms.forEach(platform => {
            const url = this.extractPattern(fullText, platform);
            if (url && this.isValidUrl(url)) {
                parsedData.socialLinks[platform] = url;
                
                // Also add to universal form data if it's a website
                if (platform === 'website') {
                    parsedData.universalFormData.website = url;
                }
            }
        });
    },
    
    extractContactInfo(fullText, parsedData) {
        const email = this.extractPattern(fullText, 'email');
        if (email && this.isValidEmail(email)) {
            parsedData.universalFormData.email = email;
        }
        
        const password = this.extractPattern(fullText, 'password');
        if (password) {
            parsedData.passwords.main = password;
        }
    },
    
    extractKeywords(lines, parsedData) {
        const keywordLines = lines.filter(line => /^\*\*\d+\*\*/.test(line));
        if (keywordLines.length === 0) return;
        
        const keywords = keywordLines
            .map(line => line.replace(/^\*\*\d+\*\*/, '').replace(/,.*$/, '').trim())
            .filter(keyword => keyword && !keyword.startsWith('http') && keyword.length > 2);
        
        if (keywords.length > 0) {
            parsedData.universalFormData.keywords = keywords.join(', ');
        }
    },
    
    extractDescription(lines, parsedData) {
        // Try pattern-based extraction first
        const fullText = lines.join(' ');
        const description = this.extractPattern(fullText, 'description');
        
        if (description) {
            parsedData.universalFormData.description = description;
            return;
        }
        
        // Fallback to intelligent detection
        const descriptionLine = lines.find(line => {
            return line.length > 100 && 
                   !line.includes('**') && 
                   !line.startsWith('http') &&
                   !line.includes('@') &&
                   (line.includes('cleaning') || line.includes('service') || line.includes('business'));
        });
        
        if (descriptionLine) {
            parsedData.universalFormData.description = descriptionLine;
        }
    },
    
    extractPattern(text, patternName) {
        const pattern = this.patterns[patternName];
        if (!pattern) return null;
        
        const match = text.match(pattern);
        return match ? this.cleanValue(match[1]) : null;
    },
    
    cleanValue(value) {
        if (!value) return '';
        
        return value
            .replace(/^\*\*|\*\*$/g, '') // Remove markdown bold
            .replace(/[,\s]+$/, '') // Remove trailing commas/spaces
            .trim();
    },
    
    mapToUniversalForm(businessInfo, parsedData) {
        Object.entries(this.fieldMappings).forEach(([sourceKey, targetKeys]) => {
            const value = businessInfo[sourceKey];
            if (value) {
                targetKeys.forEach(targetKey => {
                    parsedData.universalFormData[targetKey] = value;
                });
            }
        });
    },
    
    postProcessData(parsedData) {
        // Validate and clean URLs
        Object.entries(parsedData.socialLinks).forEach(([platform, url]) => {
            if (!this.isValidUrl(url)) {
                delete parsedData.socialLinks[platform];
            }
        });
        
        // Validate email
        if (parsedData.universalFormData.email && !this.isValidEmail(parsedData.universalFormData.email)) {
            delete parsedData.universalFormData.email;
        }
        
        // Clean empty values
        this.removeEmptyValues(parsedData.universalFormData);
        this.removeEmptyValues(parsedData.socialLinks);
        this.removeEmptyValues(parsedData.metadata);
    },
    
    removeEmptyValues(obj) {
        Object.keys(obj).forEach(key => {
            if (!obj[key] || obj[key].toString().trim() === '') {
                delete obj[key];
            }
        });
    },
    
    // Utility functions
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    generateCacheKey(rawData) {
        // Simple hash function for caching
        let hash = 0;
        for (let i = 0; i < rawData.length; i++) {
            const char = rawData.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    },
    
    getEmptyResult() {
        return {
            universalFormData: {},
            socialLinks: {},
            passwords: {},
            metadata: {}
        };
    },
    
    // Cache management
    clearCache() {
        this.cache.clear();
    },
    
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    },
    
    // Batch processing for multiple sheets
    parseMultipleSheets(sheetsData) {
        const results = [];
        
        for (const [index, data] of sheetsData.entries()) {
            try {
                const result = this.parseGoogleSheetsData(data);
                results.push({
                    index,
                    success: true,
                    data: result
                });
            } catch (error) {
                results.push({
                    index,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    },
    
    // Merge multiple parsed results
    mergeResults(results) {
        const merged = this.getEmptyResult();
        
        results.forEach(result => {
            if (result.success) {
                this.deepMerge(merged.universalFormData, result.data.universalFormData);
                this.deepMerge(merged.socialLinks, result.data.socialLinks);
                this.deepMerge(merged.metadata, result.data.metadata);
                
                // Keep the last password found
                if (result.data.passwords.main) {
                    merged.passwords.main = result.data.passwords.main;
                }
            }
        });
        
        return merged;
    },
    
    deepMerge(target, source) {
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    target[key] = target[key] || {};
                    this.deepMerge(target[key], source[key]);
                } else if (source[key]) {
                    target[key] = source[key];
                }
            }
        }
    }
};

// Export for global access
window.OptimizedSheetsParser = OptimizedSheetsParser;
