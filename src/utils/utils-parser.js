/**
 * Utility functions for parsing and data manipulation
 * @version 1.0
 */

class UtilsParser {
    /**
     * Parse text with multiple patterns and return the best match
     */
    static parseWithPatterns(text, patterns) {
        if (!text || typeof text !== 'string') return null;
        
        const results = [];
        
        patterns.forEach(({pattern, field, confidence = 0.8}) => {
            const match = text.match(pattern);
            if (match && match[1]) {
                results.push({
                    field,
                    value: match[1].trim(),
                    confidence,
                    match: match[0]
                });
            }
        });
        
        // Return the highest confidence result or null
        return results.length > 0 ? 
            results.reduce((best, current) => 
                current.confidence > best.confidence ? current : best
            ) : null;
    }

    /**
     * Extract multiple values from text using patterns
     */
    static extractAllPatterns(text, patterns) {
        const results = {};
        
        patterns.forEach(({pattern, field, confidence = 0.8}) => {
            const match = text.match(pattern);
            if (match && match[1]) {
                results[field] = {
                    value: match[1].trim(),
                    confidence,
                    match: match[0]
                };
            }
        });
        
        return results;
    }

    /**
     * Normalize social media URLs
     */
    static normalizeSocialUrl(url, platform) {
        if (!url) return '';
        
        let normalized = url.trim();
        
        // Ensure URL has protocol
        if (!normalized.startsWith('http')) {
            normalized = 'https://' + normalized;
        }
        
        // Platform-specific normalization
        const normalizers = {
            facebook: (url) => url.replace(/\/$/, '').replace(/\/\?.*$/, ''),
            instagram: (url) => url.replace(/\/$/, '').replace(/\/\?.*$/, ''),
            twitter: (url) => url.replace(/\/$/, '').replace(/\/\?.*$/, ''),
            linkedin: (url) => url.replace(/\/$/, '').replace(/\/\?.*$/, '')
        };
        
        return normalizers[platform] ? normalizers[platform](normalized) : normalized;
    }

    /**
     * Validate email format
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate URL format
     */
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Debounce function for performance
     */
    static debounce(func, wait) {
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
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UtilsParser;
} else {
    window.UtilsParser = UtilsParser;
}