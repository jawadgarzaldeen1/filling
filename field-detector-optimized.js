/**
 * Optimized Field Detector for Social Filler Pro Extension
 * 
 * This module provides:
 * - Advanced field detection algorithms
 * - Scoring and ranking system
 * - Caching for performance
 * - Error handling and logging
 * 
 * @version 7.0
 * @author Social Filler Pro Team
 */

'use strict';

// ============================================================================
// OPTIMIZED FIELD DETECTOR CLASS
// ============================================================================

class OptimizedFieldDetector {
    constructor() {
        this.logger = this.createLogger('OptimizedFieldDetector');
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds
        this.maxCacheSize = 100;
        this.scoringWeights = {
            exactMatch: 100,
            partialMatch: 50,
            attributeMatch: 30,
            placeholderMatch: 25,
            classNameMatch: 20,
            visibility: 15,
            emptyField: 10,
            typeMatch: 5
        };
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
     * Find fields with advanced scoring
     */
    findFields(selectors, fieldType, options = {}) {
        const cacheKey = this.generateCacheKey(selectors, fieldType, options);
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.logger.debug(`Cache hit for ${fieldType} fields`);
                return cached.data;
            } else {
                this.cache.delete(cacheKey);
            }
        }

        const results = this.performFieldDetection(selectors, fieldType, options);
        
        // Cache results
        this.cacheResult(cacheKey, results);
        
        return results;
    }

    /**
     * Perform field detection
     */
    performFieldDetection(selectors, fieldType, options) {
        const {
            maxResults = 10,
            minScore = 5,
            includeHidden = false,
            prioritizeEmpty = true
        } = options;

        const fields = [];
        const startTime = performance.now();

        try {
            for (const selector of selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    
                    for (const element of elements) {
                        const score = this.calculateAdvancedScore(element, fieldType, options);
                        
                        if (score >= minScore) {
                            fields.push({
                                element,
                                score,
                                selector,
                                fieldType,
                                metadata: this.extractFieldMetadata(element)
                            });
                        }
                    }
                } catch (error) {
                    this.logger.warn(`Invalid selector: ${selector}`, error);
                }
            }

            // Remove duplicates and sort
            const uniqueFields = this.removeDuplicateFields(fields);
            const sortedFields = this.sortFieldsByScore(uniqueFields, prioritizeEmpty);
            
            // Limit results
            const limitedFields = sortedFields.slice(0, maxResults);
            
            const endTime = performance.now();
            this.logger.debug(`Field detection completed in ${(endTime - startTime).toFixed(2)}ms for ${fieldType}`);

            return limitedFields;

        } catch (error) {
            this.logger.error('Error during field detection:', error);
            return [];
        }
    }

    /**
     * Calculate advanced field score
     */
    calculateAdvancedScore(element, fieldType, options = {}) {
        let score = 0;

        try {
            // Basic element validation
            if (!this.isValidElement(element)) {
                return 0;
            }

            // Extract element attributes
            const attributes = this.extractElementAttributes(element);
            
            // Exact match scoring
            score += this.calculateExactMatchScore(attributes, fieldType);
            
            // Partial match scoring
            score += this.calculatePartialMatchScore(attributes, fieldType);
            
            // Attribute match scoring
            score += this.calculateAttributeMatchScore(attributes, fieldType);
            
            // Placeholder match scoring
            score += this.calculatePlaceholderMatchScore(attributes, fieldType);
            
            // Class name match scoring
            score += this.calculateClassNameMatchScore(attributes, fieldType);
            
            // Visibility scoring
            score += this.calculateVisibilityScore(element);
            
            // Empty field scoring
            score += this.calculateEmptyFieldScore(element, options);
            
            // Type match scoring
            score += this.calculateTypeMatchScore(element, fieldType);
            
            // Context scoring
            score += this.calculateContextScore(element, fieldType);
            
            // Penalty for hidden/disabled fields
            score -= this.calculatePenaltyScore(element, options);

        } catch (error) {
            this.logger.error('Error calculating field score:', error);
        }

        return Math.max(0, score);
    }

    /**
     * Check if element is valid for filling
     */
    isValidElement(element) {
        if (!element || !element.tagName) {
            return false;
        }

        const tagName = element.tagName.toLowerCase();
        const validTags = ['input', 'select', 'textarea'];
        
        return validTags.includes(tagName);
    }

    /**
     * Extract element attributes
     */
    extractElementAttributes(element) {
        return {
            name: element.name || '',
            id: element.id || '',
            placeholder: element.placeholder || '',
            className: element.className || '',
            type: element.type || '',
            value: element.value || '',
            title: element.title || '',
            'data-name': element.dataset.name || '',
            'data-field': element.dataset.field || '',
            'data-type': element.dataset.type || ''
        };
    }

    /**
     * Calculate exact match score
     */
    calculateExactMatchScore(attributes, fieldType) {
        const exactMatches = [
            attributes.name.toLowerCase(),
            attributes.id.toLowerCase(),
            attributes['data-name'].toLowerCase(),
            attributes['data-field'].toLowerCase()
        ];

        for (const match of exactMatches) {
            if (match === fieldType.toLowerCase()) {
                return this.scoringWeights.exactMatch;
            }
        }

        return 0;
    }

    /**
     * Calculate partial match score
     */
    calculatePartialMatchScore(attributes, fieldType) {
        const searchTexts = [
            attributes.name.toLowerCase(),
            attributes.id.toLowerCase(),
            attributes.placeholder.toLowerCase(),
            attributes.className.toLowerCase(),
            attributes['data-name'].toLowerCase(),
            attributes['data-field'].toLowerCase()
        ];

        const fieldTypeLower = fieldType.toLowerCase();
        let maxScore = 0;

        for (const text of searchTexts) {
            if (text.includes(fieldTypeLower) || fieldTypeLower.includes(text)) {
                const similarity = this.calculateSimilarity(text, fieldTypeLower);
                const score = Math.floor(this.scoringWeights.partialMatch * similarity);
                maxScore = Math.max(maxScore, score);
            }
        }

        return maxScore;
    }

    /**
     * Calculate attribute match score
     */
    calculateAttributeMatchScore(attributes, fieldType) {
        const attributeMatches = {
            name: attributes.name.toLowerCase(),
            id: attributes.id.toLowerCase(),
            placeholder: attributes.placeholder.toLowerCase()
        };

        const fieldTypeLower = fieldType.toLowerCase();
        let score = 0;

        for (const [attr, value] of Object.entries(attributeMatches)) {
            if (value && value.includes(fieldTypeLower)) {
                score += this.scoringWeights.attributeMatch;
            }
        }

        return score;
    }

    /**
     * Calculate placeholder match score
     */
    calculatePlaceholderMatchScore(attributes, fieldType) {
        if (!attributes.placeholder) {
            return 0;
        }

        const placeholder = attributes.placeholder.toLowerCase();
        const fieldTypeLower = fieldType.toLowerCase();

        if (placeholder.includes(fieldTypeLower)) {
            return this.scoringWeights.placeholderMatch;
        }

        return 0;
    }

    /**
     * Calculate class name match score
     */
    calculateClassNameMatchScore(attributes, fieldType) {
        if (!attributes.className) {
            return 0;
        }

        const className = attributes.className.toLowerCase();
        const fieldTypeLower = fieldType.toLowerCase();

        if (className.includes(fieldTypeLower)) {
            return this.scoringWeights.classNameMatch;
        }

        return 0;
    }

    /**
     * Calculate visibility score
     */
    calculateVisibilityScore(element) {
        try {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();

            // Check if element is visible
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0' ||
                rect.width === 0 || 
                rect.height === 0) {
                return 0;
            }

            // Check if element is in viewport
            if (rect.top < 0 || rect.left < 0 || 
                rect.bottom > window.innerHeight || 
                rect.right > window.innerWidth) {
                return this.scoringWeights.visibility / 2;
            }

            return this.scoringWeights.visibility;

        } catch (error) {
            this.logger.warn('Error calculating visibility score:', error);
            return 0;
        }
    }

    /**
     * Calculate empty field score
     */
    calculateEmptyFieldScore(element, options) {
        const { prioritizeEmpty = true } = options;
        
        if (!prioritizeEmpty) {
            return 0;
        }

        const value = element.value || '';
        const placeholder = element.placeholder || '';

        if (value === '' || value === placeholder) {
            return this.scoringWeights.emptyField;
        }

        return 0;
    }

    /**
     * Calculate type match score
     */
    calculateTypeMatchScore(element, fieldType) {
        const type = element.type ? element.type.toLowerCase() : '';
        const fieldTypeLower = fieldType.toLowerCase();

        // Type-specific scoring
        const typeMatches = {
            email: ['email'],
            phone: ['tel', 'phone'],
            url: ['url'],
            password: ['password'],
            text: ['text', 'search']
        };

        for (const [field, types] of Object.entries(typeMatches)) {
            if (fieldTypeLower.includes(field) && types.includes(type)) {
                return this.scoringWeights.typeMatch;
            }
        }

        return 0;
    }

    /**
     * Calculate context score
     */
    calculateContextScore(element, fieldType) {
        try {
            let score = 0;

            // Check parent form context
            const form = element.closest('form');
            if (form) {
                const formId = form.id ? form.id.toLowerCase() : '';
                const formClass = form.className ? form.className.toLowerCase() : '';
                
                if (formId.includes(fieldType) || formClass.includes(fieldType)) {
                    score += 5;
                }
            }

            // Check label context
            const label = element.closest('label') || 
                         document.querySelector(`label[for="${element.id}"]`);
            if (label) {
                const labelText = label.textContent.toLowerCase();
                if (labelText.includes(fieldType)) {
                    score += 5;
                }
            }

            return score;

        } catch (error) {
            this.logger.warn('Error calculating context score:', error);
            return 0;
        }
    }

    /**
     * Calculate penalty score
     */
    calculatePenaltyScore(element, options) {
        const { includeHidden = false } = options;
        let penalty = 0;

        // Penalty for hidden fields
        if (!includeHidden && element.type === 'hidden') {
            penalty += 50;
        }

        // Penalty for disabled fields
        if (element.disabled) {
            penalty += 30;
        }

        // Penalty for readonly fields
        if (element.readOnly) {
            penalty += 20;
        }

        // Penalty for fields with no name or id
        if (!element.name && !element.id) {
            penalty += 10;
        }

        return penalty;
    }

    /**
     * Calculate text similarity
     */
    calculateSimilarity(str1, str2) {
        if (str1 === str2) return 1;
        if (str1.length === 0 || str2.length === 0) return 0;

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1;

        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance
     */
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
    }

    /**
     * Extract field metadata
     */
    extractFieldMetadata(element) {
        return {
            tagName: element.tagName.toLowerCase(),
            type: element.type || 'text',
            name: element.name || '',
            id: element.id || '',
            className: element.className || '',
            placeholder: element.placeholder || '',
            value: element.value || '',
            disabled: element.disabled,
            readOnly: element.readOnly,
            required: element.required,
            visible: this.isElementVisible(element)
        };
    }

    /**
     * Check if element is visible
     */
    isElementVisible(element) {
        try {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0';
        } catch {
            return false;
        }
    }

    /**
     * Remove duplicate fields
     */
    removeDuplicateFields(fields) {
        const seen = new Set();
        return fields.filter(field => {
            const key = `${field.element.tagName}-${field.element.name}-${field.element.id}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Sort fields by score
     */
    sortFieldsByScore(fields, prioritizeEmpty = true) {
        return fields.sort((a, b) => {
            // Primary sort by score
            if (a.score !== b.score) {
                return b.score - a.score;
            }

            // Secondary sort by empty field priority
            if (prioritizeEmpty) {
                const aEmpty = !a.element.value || a.element.value === a.element.placeholder;
                const bEmpty = !b.element.value || b.element.value === b.element.placeholder;
                
                if (aEmpty !== bEmpty) {
                    return aEmpty ? -1 : 1;
                }
            }

            // Tertiary sort by visibility
            const aVisible = a.metadata.visible;
            const bVisible = b.metadata.visible;
            
            if (aVisible !== bVisible) {
                return aVisible ? -1 : 1;
            }

            return 0;
        });
    }

    /**
     * Generate cache key
     */
    generateCacheKey(selectors, fieldType, options) {
        const optionsStr = JSON.stringify(options);
        return `${selectors.join(',')}-${fieldType}-${optionsStr}`;
    }

    /**
     * Cache result
     */
    cacheResult(key, data) {
        // Clean cache if it's too large
        if (this.cache.size >= this.maxCacheSize) {
            this.cleanCache();
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clean expired cache entries
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.debug('Field detection cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            timeout: this.cacheTimeout
        };
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Create global instance
window.OptimizedFieldDetector = new OptimizedFieldDetector();

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedFieldDetector;
}
