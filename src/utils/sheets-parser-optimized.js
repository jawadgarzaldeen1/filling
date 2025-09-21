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
    async parseGoogleSheetsData(rawData) {
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

        // Try LLM-based extraction first if configured. This gives better
        // structured extraction for free-text rows like "Contact John Doe at ACME Inc in New York".
        try {
            const llmResult = await this.tryLLMExtraction(rawData);
            if (llmResult) {
                const duration = performance.now() - startTime;
                if (this.cache.size < 10) this.cache.set(cacheKey, llmResult);
                console.log(`[PARSER] LLM parsed data in ${duration.toFixed(2)}ms`);
                return llmResult;
            }
        } catch (llmError) {
            // Non-fatal: if LLM fails, fall back to local parser
            console.warn('[PARSER] LLM extraction failed, falling back to local parser:', llmError);
        }

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

    // Try LLM-based extraction. Returns parsed result or null if not available.
    async tryLLMExtraction(rawData) {
        // Read API key from stored settings (non-blocking retrieval)
        let settings = {};
        try {
            const store = await chrome.storage.sync.get('settings');
            settings = store.settings || {};
        } catch (e) {
            // ignore storage errors and fall back
            console.warn('[PARSER] Could not read settings for LLM key:', e);
        }

        const apiKey = settings.apiKey || settings.llmApiKey || null;
        const llmEndpoint = settings.llmEndpoint || 'https://api.openai.com/v1/chat/completions';

        if (!apiKey) return null; // no key configured

        // Build a short prompt that instructs the LLM to return strict JSON
        const prompt = `Extract structured contact/business data as JSON from the following text. ` +
                       `Return only valid JSON with keys name, company, address, city, state, zip, phone, email when present. ` +
                       `If a field is not present, omit it. Text:\n\n"""${rawData.replace(/"/g, '\\"')}"""`;

        try {
            const response = await fetch(llmEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 400,
                    temperature: 0
                })
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`LLM API error: ${response.status} ${response.statusText} ${text}`);
            }

            const json = await response.json();

            // Attempt to extract JSON from response. Support both chat/completions style.
            const content = (json.choices && json.choices[0] && (json.choices[0].message?.content || json.choices[0].text)) || json.output || '';

            // Find JSON substring
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;

            let parsed = null;
            try {
                parsed = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn('[PARSER] LLM returned invalid JSON:', e);
                return null;
            }

            // Map LLM output into parser result shape
            const result = this.getEmptyResult();
            const map = {
                name: ['name'],
                company: ['company', 'title'],
                address: ['address'],
                city: ['city'],
                state: ['state'],
                zip: ['zipcode', 'zip'],
                phone: ['phone'],
                email: ['email']
            };

            Object.entries(map).forEach(([src, targets]) => {
                if (parsed[src]) {
                    targets.forEach(t => result.universalFormData[t] = parsed[src]);
                }
            });

            // Return structured result
            return result;
        } catch (error) {
            console.warn('[PARSER] LLM extraction error:', error);
            return null;
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
    async parseMultipleSheets(sheetsData) {
        const results = [];
        
        for (const [index, data] of sheetsData.entries()) {
            try {
                const result = await this.parseGoogleSheetsData(data);
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
