/**
 * Optimized field detection utilities
 * @version 1.0
 */

class OptimizedFieldDetector {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds
    }

    /**
     * Find form fields with optimized caching
     */
    findFields(selectors, context = document) {
        const cacheKey = `${selectors.join(',')}-${context.toString()}`;
            const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.fields;
        }

        const fields = [];
        const seen = new Set();

        selectors.forEach(selector => {
            try {
                const elements = context.querySelectorAll(selector);
                elements.forEach(element => {
                    if (this.isValidField(element) && !seen.has(element)) {
                        seen.add(element);
                        fields.push(element);
                    }
                });
                } catch (error) {
                console.debug(`Invalid selector: ${selector}`, error);
            }
        });

        this.cache.set(cacheKey, {
            fields,
            timestamp: Date.now()
        });

        return fields;
    }

    /**
     * Check if element is a valid form field
     */
    isValidField(element) {
        if (!element || 
            element.disabled || 
            element.readOnly || 
            element.offsetParent === null) {
            return false;
        }

            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0';
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Find fields by label text
     */
    findFieldsByLabel(text, context = document) {
        const labels = context.querySelectorAll('label');
        const fields = [];

        labels.forEach(label => {
            if (label.textContent.toLowerCase().includes(text.toLowerCase())) {
                const forId = label.getAttribute('for');
                if (forId) {
                    const field = context.getElementById(forId);
                    if (field && this.isValidField(field)) {
                        fields.push(field);
                    }
                }
            }
        });

        return fields;
    }
}

// Initialize singleton instance
window.FieldDetector = new OptimizedFieldDetector();