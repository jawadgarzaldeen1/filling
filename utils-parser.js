/**
 * Enhanced Parser Utilities for Social Filler Pro Extension
 * 
 * This module provides:
 * - Advanced text parsing utilities
 * - Data extraction and validation
 * - URL normalization and validation
 * - Error handling and logging
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

// ============================================================================
// PARSER UTILITIES CLASS
// ============================================================================

class ParserUtils {
    constructor() {
        this.logger = this.createLogger('ParserUtils');
    }

    /**
     * Create logger instance
     */
    createLogger(context) {
        return {
            debug: (message, ...args) => console.debug(`[${context}]`, message, ...args),
            info: (message, ...args) => console.info(`[${context}]`, message, ...args),
            warn: (message, ...args) => console.warn(`[${context}]`, message, ...args),
            error: (message, ...args) => console.error(`[${context}]`, message, ...args)
        };
    }

    /**
     * Parse text with multiple patterns
     */
    parseWithPatterns(text, patterns, options = {}) {
        const results = {
            matches: {},
            errors: [],
            warnings: []
        };

        try {
            if (!text || typeof text !== 'string') {
                results.errors.push('Invalid text input');
                return results;
            }

            const {
                caseSensitive = false,
                multiline = false,
                global = false,
                strict = false
            } = options;

            for (const [key, pattern] of Object.entries(patterns)) {
                try {
                    const flags = this.buildRegexFlags(caseSensitive, multiline, global);
                    const regex = new RegExp(pattern, flags);
                    const matches = text.match(regex);

                    if (matches) {
                        results.matches[key] = matches;
                    } else if (strict) {
                        results.warnings.push(`No match found for pattern: ${key}`);
                    }
                } catch (error) {
                    results.errors.push(`Invalid pattern for ${key}: ${error.message}`);
                }
            }

        } catch (error) {
            results.errors.push(`Parse error: ${error.message}`);
        }

        return results;
    }

    /**
     * Build regex flags string
     */
    buildRegexFlags(caseSensitive, multiline, global) {
        let flags = '';
        if (!caseSensitive) flags += 'i';
        if (multiline) flags += 'm';
        if (global) flags += 'g';
        return flags;
    }

    /**
     * Extract structured data from text
     */
    extractStructuredData(text, schema) {
        const results = {
            data: {},
            errors: [],
            warnings: [],
            metadata: {
                processedAt: new Date().toISOString(),
                textLength: text ? text.length : 0,
                schemaKeys: Object.keys(schema).length
            }
        };

        try {
            if (!text || typeof text !== 'string') {
                results.errors.push('Invalid text input');
                return results;
            }

            if (!schema || typeof schema !== 'object') {
                results.errors.push('Invalid schema');
                return results;
            }

            for (const [fieldName, fieldConfig] of Object.entries(schema)) {
                try {
                    const extracted = this.extractField(text, fieldConfig);
                    if (extracted !== null) {
                        results.data[fieldName] = extracted;
                    }
                } catch (error) {
                    results.errors.push(`Error extracting ${fieldName}: ${error.message}`);
                }
            }

        } catch (error) {
            results.errors.push(`Extraction error: ${error.message}`);
        }

        return results;
    }

    /**
     * Extract single field from text
     */
    extractField(text, fieldConfig) {
        const {
            pattern,
            type = 'string',
            required = false,
            defaultValue = null,
            transform = null,
            validate = null
        } = fieldConfig;

        try {
            if (!pattern) {
                throw new Error('Pattern is required');
            }

            const regex = new RegExp(pattern, 'i');
            const match = text.match(regex);

            if (!match) {
                if (required) {
                    throw new Error('Required field not found');
                }
                return defaultValue;
            }

            let value = match[1] || match[0];
            
            // Apply type conversion
            value = this.convertType(value, type);
            
            // Apply transformation
            if (transform && typeof transform === 'function') {
                value = transform(value);
            }
            
            // Apply validation
            if (validate && typeof validate === 'function') {
                const validation = validate(value);
                if (!validation.isValid) {
                    throw new Error(`Validation failed: ${validation.error}`);
                }
            }

            return value;

        } catch (error) {
            if (required) {
                throw error;
            }
            return defaultValue;
        }
    }

    /**
     * Convert value to specified type
     */
    convertType(value, type) {
        if (value === null || value === undefined) {
            return value;
        }

        switch (type.toLowerCase()) {
            case 'string':
                return String(value).trim();
            case 'number':
                const num = parseFloat(value);
                return isNaN(num) ? 0 : num;
            case 'integer':
                const int = parseInt(value, 10);
                return isNaN(int) ? 0 : int;
            case 'boolean':
                return Boolean(value);
            case 'array':
                return Array.isArray(value) ? value : [value];
            case 'object':
                return typeof value === 'object' ? value : { value };
            default:
                return value;
        }
    }

    /**
     * Clean and normalize text
     */
    cleanText(text, options = {}) {
        try {
            if (!text || typeof text !== 'string') {
                return '';
            }

            const {
                trim = true,
                normalizeWhitespace = true,
                removeEmptyLines = false,
                removeSpecialChars = false,
                toLowerCase = false
            } = options;

            let cleaned = text;

            if (trim) {
                cleaned = cleaned.trim();
            }

            if (normalizeWhitespace) {
                cleaned = cleaned.replace(/\s+/g, ' ');
            }

            if (removeEmptyLines) {
                cleaned = cleaned.replace(/^\s*$/gm, '');
            }

            if (removeSpecialChars) {
                cleaned = cleaned.replace(/[^\w\s]/g, '');
            }

            if (toLowerCase) {
                cleaned = cleaned.toLowerCase();
            }

            return cleaned;

        } catch (error) {
            this.logger.error('Error cleaning text:', error);
            return text || '';
        }
    }

    /**
     * Extract URLs from text
     */
    extractUrls(text, options = {}) {
        try {
            if (!text || typeof text !== 'string') {
                return [];
            }

            const {
                includeProtocol = true,
                normalize = true,
                unique = true
            } = options;

            const urlPattern = includeProtocol 
                ? /https?:\/\/[^\s]+/gi
                : /(?:https?:\/\/)?[^\s]+/gi;

            const matches = text.match(urlPattern) || [];
            let urls = matches.map(url => url.trim());

            if (normalize) {
                urls = urls.map(url => this.normalizeUrl(url));
            }

            if (unique) {
                urls = [...new Set(urls)];
            }

            return urls;

        } catch (error) {
            this.logger.error('Error extracting URLs:', error);
            return [];
        }
    }

    /**
     * Extract email addresses from text
     */
    extractEmails(text, options = {}) {
        try {
            if (!text || typeof text !== 'string') {
                return [];
            }

            const {
                unique = true,
                validate = true
            } = options;

            const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const matches = text.match(emailPattern) || [];
            let emails = matches.map(email => email.trim().toLowerCase());

            if (validate) {
                emails = emails.filter(email => this.isValidEmail(email));
            }

            if (unique) {
                emails = [...new Set(emails)];
            }

            return emails;

        } catch (error) {
            this.logger.error('Error extracting emails:', error);
            return [];
        }
    }

    /**
     * Normalize URL
     */
    normalizeUrl(url) {
        try {
            if (!url || typeof url !== 'string') {
                return '';
            }

            let normalized = url.trim();

            // Add protocol if missing
            if (!normalized.match(/^https?:\/\//i)) {
                normalized = 'https://' + normalized;
            }

            // Remove trailing slash for consistency
            if (normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }

            return normalized;

        } catch (error) {
            this.logger.error('Error normalizing URL:', error);
            return url || '';
        }
    }

    /**
     * Validate URL
     */
    isValidUrl(url) {
        try {
            if (!url || typeof url !== 'string') {
                return false;
            }

            new URL(url);
            return true;

        } catch {
            return false;
        }
    }

    /**
     * Validate email
     */
    isValidEmail(email) {
        try {
            if (!email || typeof email !== 'string') {
                return false;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);

        } catch {
            return false;
        }
    }

    /**
     * Generate unique ID
     */
    generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }

    /**
     * Deep clone object
     */
    deepClone(obj) {
        try {
            if (obj === null || typeof obj !== 'object') {
                return obj;
            }

            if (obj instanceof Date) {
                return new Date(obj.getTime());
            }

            if (obj instanceof Array) {
                return obj.map(item => this.deepClone(item));
            }

            if (typeof obj === 'object') {
                const cloned = {};
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        cloned[key] = this.deepClone(obj[key]);
                    }
                }
                return cloned;
            }

            return obj;

        } catch (error) {
            this.logger.error('Error deep cloning object:', error);
            return obj;
        }
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Create global instance
window.ParserUtils = new ParserUtils();

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParserUtils;
}
