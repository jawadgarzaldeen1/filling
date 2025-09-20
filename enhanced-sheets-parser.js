// Enhanced Google Sheets Parser with robust error handling and validation
const EnhancedSheetsParser = {
    parseGoogleSheetsData(rawData) {
        const startTime = performance.now();
        const parsedData = {
            universalFormData: {},
            socialLinks: {},
            passwords: { main: null },
            metadata: {},
            errors: [],
            warnings: [],
            stats: {
                linesProcessed: 0,
                fieldsExtracted: 0,
                processingTime: 0
            }
        };
        
        try {
            // Input validation
            if (!rawData || typeof rawData !== 'string') {
                parsedData.errors.push('Invalid input: Data must be a non-empty string');
                return parsedData;
            }
            
            if (rawData.trim().length < 10) {
                parsedData.warnings.push('Input data seems too short to contain meaningful information');
            }
            
            // Clean and normalize the data
            const cleanedData = this.cleanInputData(rawData);
            const lines = this.parseLines(cleanedData);
            parsedData.stats.linesProcessed = lines.length;
            
            if (lines.length === 0) {
                parsedData.errors.push('No valid lines found in the input data');
                return parsedData;
            }
            
            // Parse different sections
            this.parseBusinessInfo(lines, parsedData);
            this.parseContactInfo(lines, parsedData);
            this.parseSocialLinks(lines, parsedData);
            this.parseKeywords(lines, parsedData);
            this.parseDescription(lines, parsedData);
            this.parseMetadata(lines, parsedData);
            
            // Validate parsed data
            this.validateParsedData(parsedData);
            
            // Count extracted fields
            parsedData.stats.fieldsExtracted = Object.keys(parsedData.universalFormData).length + 
                                              Object.keys(parsedData.socialLinks).length;
            
            const duration = performance.now() - startTime;
            parsedData.stats.processingTime = duration;
            console.log(`[ENHANCED-SHEETS] Parsed data in ${duration.toFixed(2)}ms, extracted ${parsedData.stats.fieldsExtracted} fields`);
            
        } catch (error) {
            parsedData.errors.push(`Parsing error: ${error.message}`);
            console.error('[ENHANCED-SHEETS] Parsing error:', error);
        }
        
        return parsedData;
    },

    cleanInputData(rawData) {
        return rawData
            .replace(/\r\n/g, '\n')  // Normalize line endings
            .replace(/\r/g, '\n')    // Handle old Mac line endings
            .replace(/\t/g, ' ')     // Replace tabs with spaces
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    },

    parseLines(data) {
        return data
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => this.normalizeLine(line));
    },

    normalizeLine(line) {
        // Remove extra asterisks and normalize formatting
        return line
            .replace(/\*{3,}/g, '**')  // Replace multiple asterisks with double
            .replace(/\s*\*\*\s*/g, '**')  // Normalize asterisk spacing
            .trim();
    },

    parseBusinessInfo(lines, parsedData) {
        const fullText = lines.join(' ');
        
        // Business name with multiple patterns
        const businessPatterns = [
            /\*\*Business name:\*\*(.+?)(?:\*\*|$)/i,
            /\*\*Company:\*\*(.+?)(?:\*\*|$)/i,
            /\*\*Business:\*\*(.+?)(?:\*\*|$)/i,
            /Business[:\s]+(.+?)(?:\*\*|$)/i
        ];
        
        for (const pattern of businessPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const name = this.cleanValue(match[1]);
                if (name) {
                    parsedData.universalFormData.title = name;
                    parsedData.universalFormData.company = name;
                    break;
                }
            }
        }
        
        // Phone with multiple patterns
        const phonePatterns = [
            /Phone[#\s]*:?\s*([^\s\*]+)/i,
            /Tel[#\s]*:?\s*([^\s\*]+)/i,
            /Contact[#\s]*:?\s*([^\s\*]+)/i
        ];
        
        for (const pattern of phonePatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const phone = this.cleanValue(match[1]);
                if (this.isValidPhone(phone)) {
                    parsedData.universalFormData.phone = phone;
                    break;
                }
            }
        }
        
        // Address parsing
        const addressPatterns = [
            /\*\*Address:\*\*(.+?)(?:\*\*|$)/i,
            /Address[:\s]+(.+?)(?:\*\*|$)/i
        ];
        
        for (const pattern of addressPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const address = this.cleanValue(match[1]);
                if (address) {
                    parsedData.universalFormData.address = address;
                    break;
                }
            }
        }
        
        // City and ZIP parsing
        const cityMatch = fullText.match(/\*\*City:\*\*(.+?)(?:\*\*|$)/i);
        if (cityMatch) {
            parsedData.universalFormData.city = this.cleanValue(cityMatch[1]);
        }
        
        const zipMatch = fullText.match(/\*\*Zip:\*\*(.+?)(?:\*\*|$)/i);
        if (zipMatch) {
            parsedData.universalFormData.zipcode = this.cleanValue(zipMatch[1]);
        }
    },

    parseContactInfo(lines, parsedData) {
        const fullText = lines.join(' ');
        
        // Email with validation
        const emailMatch = fullText.match(/Email[:\s]+([^\s\*]+@[^\s\*]+)/i);
        if (emailMatch) {
            const email = this.cleanValue(emailMatch[1]);
            if (this.isValidEmail(email)) {
                parsedData.universalFormData.email = email;
            } else {
                parsedData.warnings.push(`Invalid email format: ${email}`);
            }
        }
        
        // Password
        const passwordMatch = fullText.match(/\*\*PW:\*\*([^\*\s]+)/i);
        if (passwordMatch) {
            parsedData.passwords.main = this.cleanValue(passwordMatch[1]);
        }
    },

    parseSocialLinks(lines, parsedData) {
        const fullText = lines.join(' ');
        
        // Social media patterns with validation
        const socialPatterns = {
            website: /Website[:\s]+(https?:\/\/[^\s\*]+)/i,
            facebook: /(https?:\/\/(?:www\.)?facebook\.com[^\s\*]+)/i,
            instagram: /(https?:\/\/(?:www\.)?instagram\.com[^\s\*]+)/i,
            youtube: /(https?:\/\/(?:www\.)?youtube\.com[^\s\*]+)/i,
            pinterest: /(https?:\/\/(?:www\.)?pinterest\.com[^\s\*]+)/i,
            twitter: /(https?:\/\/(?:x\.com|twitter\.com)[^\s\*]+)/i,
            linkedin: /(https?:\/\/(?:www\.)?linkedin\.com[^\s\*]+)/i,
            tiktok: /(https?:\/\/(?:www\.)?tiktok\.com[^\s\*]+)/i
        };
        
        Object.entries(socialPatterns).forEach(([platform, pattern]) => {
            const match = fullText.match(pattern);
            if (match) {
                const url = this.cleanValue(match[1]);
                if (this.isValidUrl(url)) {
                    parsedData.socialLinks[platform] = url;
                    if (platform === 'website') {
                        parsedData.universalFormData.website = url;
                    }
                } else {
                    parsedData.warnings.push(`Invalid ${platform} URL: ${url}`);
                }
            }
        });
    },

    parseKeywords(lines, parsedData) {
        // Extract keywords from numbered list
        const keywordLines = lines.filter(line => /^\*\*\d+\*\*/.test(line));
        if (keywordLines.length > 0) {
            const keywords = keywordLines
                .map(line => {
                    return line.replace(/^\*\*\d+\*\*/, '').replace(/,.*$/, '').trim();
                })
                .filter(keyword => keyword && !keyword.startsWith('http') && keyword.length > 2);
            
            if (keywords.length > 0) {
                parsedData.universalFormData.keywords = keywords.join(', ');
            }
        }
        
        // Also look for explicit keywords field
        const keywordsMatch = lines.join(' ').match(/\*\*Keywords:\*\*(.+?)(?:\*\*|$)/i);
        if (keywordsMatch) {
            const keywords = this.cleanValue(keywordsMatch[1]);
            if (keywords) {
                parsedData.universalFormData.keywords = keywords;
            }
        }
    },

    parseDescription(lines, parsedData) {
        // Find the longest meaningful text block
        const descriptionLines = lines.filter(line => {
            return line.length > 30 && 
                   !line.includes('**') && 
                   !line.includes('http') && 
                   !line.includes('@') &&
                   !line.includes('Phone') &&
                   !line.includes('Email') &&
                   !line.includes('Address') &&
                   !line.match(/^\*\*\d+\*\*/);
        });
        
        if (descriptionLines.length > 0) {
            const description = descriptionLines.join(' ').trim();
            if (description.length > 20) {
                parsedData.universalFormData.description = description;
            }
        }
        
        // Also look for explicit description field
        const descMatch = lines.join(' ').match(/(?:Description|About|Info)[:\s]+(.+?)(?:\*\*|$)/i);
        if (descMatch) {
            const description = this.cleanValue(descMatch[1]);
            if (description && description.length > 20) {
                parsedData.universalFormData.description = description;
            }
        }
    },

    parseMetadata(lines, parsedData) {
        const fullText = lines.join(' ');
        
        const usernameMatch = fullText.match(/\*\*Username:\*\*(.+?)(?:\*\*|$)/i);
        if (usernameMatch) {
            parsedData.metadata.username = this.cleanValue(usernameMatch[1]);
        }
        
        const contractSignerMatch = fullText.match(/\*\*Contract signer name:\*\*(.+?)(?:\*\*|$)/i);
        if (contractSignerMatch) {
            parsedData.metadata.contractSigner = this.cleanValue(contractSignerMatch[1]);
        }
    },

    validateParsedData(parsedData) {
        const { universalFormData, socialLinks } = parsedData;
        
        // Check if we got any meaningful data
        const hasData = Object.keys(universalFormData).length > 0 || Object.keys(socialLinks).length > 0;
        if (!hasData) {
            parsedData.warnings.push('No meaningful data was extracted from the input');
        }
        
        // Validate specific fields
        if (universalFormData.email && !this.isValidEmail(universalFormData.email)) {
            parsedData.errors.push(`Invalid email format: ${universalFormData.email}`);
        }
        
        if (universalFormData.phone && !this.isValidPhone(universalFormData.phone)) {
            parsedData.warnings.push(`Phone number format may be invalid: ${universalFormData.phone}`);
        }
        
        // Check for required fields
        if (!universalFormData.title && !universalFormData.company) {
            parsedData.warnings.push('No business name or company name found');
        }
    },

    cleanValue(value) {
        if (!value) return '';
        return value
            .replace(/^[:\s]+|[:\s]+$/g, '')  // Remove leading/trailing colons and spaces
            .replace(/\s+/g, ' ')             // Normalize whitespace
            .trim();
    },

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    isValidPhone(phone) {
        const phoneRegex = /^[\+]?[\d\s\-\(\)]{7,}$/;
        return phoneRegex.test(phone);
    },

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    // Auto-generate description from available data
    generateDescription(parsedData) {
        const { universalFormData } = parsedData;
        const parts = [];
        
        if (universalFormData.title || universalFormData.company) {
            const name = universalFormData.title || universalFormData.company;
            parts.push(`${name} is a professional business`);
        }
        
        if (universalFormData.keywords) {
            const keywords = universalFormData.keywords.split(',').slice(0, 3).join(', ');
            parts.push(`specializing in ${keywords}`);
        }
        
        if (universalFormData.city) {
            parts.push(`located in ${universalFormData.city}`);
        }
        
        if (parts.length > 0) {
            return parts.join(' ') + '. We provide high-quality services to our customers.';
        }
        
        return null;
    }
};

// Make it globally available
window.EnhancedSheetsParser = EnhancedSheetsParser;
