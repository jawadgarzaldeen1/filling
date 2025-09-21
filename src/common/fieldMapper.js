/**
 * Field Mapping Service
 * Handles form field detection and mapping to profile data
 */

import { FIELD_TYPES, FIELD_CATEGORIES, VALIDATION_RULES } from './constants.js';

class FieldMapper {
    /**
     * Common field name patterns for different categories
     * @private
     */
    static patterns = {
        name: /(^|[_-])(name|fullname|full[-_]name)($|[_-])/i,
        firstName: /(^|[_-])(first[-_]?name|fname|firstname|first)($|[_-])/i,
        lastName: /(^|[_-])(last[-_]?name|lname|lastname|last|surname)($|[_-])/i,
        email: /(^|[_-])(email|e[-_]?mail)($|[_-])/i,
        phone: /(^|[_-])(phone|telephone|tel|mobile|cell)($|[_-])/i,
        address: /(^|[_-])(address|addr|street)($|[_-])/i,
        city: /(^|[_-])(city|town|locality)($|[_-])/i,
        state: /(^|[_-])(state|province|region)($|[_-])/i,
        zip: /(^|[_-])(zip|postal|postcode)($|[_-])/i,
        country: /(^|[_-])(country|nation)($|[_-])/i,
        company: /(^|[_-])(company|organization|business|employer)($|[_-])/i,
        website: /(^|[_-])(website|web|url|site)($|[_-])/i,
        password: /(^|[_-])(password|pwd|pass)($|[_-])/i
    };

    /**
     * Map a field to its likely category and type
     * @param {HTMLElement} field - The form field element
     * @returns {Object} Field mapping information
     */
    mapField(field) {
        const mapping = {
            type: this.detectFieldType(field),
            category: FIELD_CATEGORIES.PERSONAL,
            name: field.name || field.id,
            originalId: field.id,
            originalName: field.name
        };

        // Check field name/id against patterns
        const fieldIdentifier = (field.name || field.id || '').toLowerCase();
        
        for (const [key, pattern] of Object.entries(FieldMapper.patterns)) {
            if (pattern.test(fieldIdentifier)) {
                mapping.key = key;
                mapping.category = this.getCategoryForKey(key);
                break;
            }
        }

        // Check label text if available
        const label = this.findFieldLabel(field);
        if (label) {
            mapping.labelText = label.textContent.trim();
            // Additional pattern matching on label text could be done here
        }

        return mapping;
    }

    /**
     * Find the associated label for a form field
     * @private
     * @param {HTMLElement} field - The form field element
     * @returns {HTMLElement|null} The label element if found
     */
    findFieldLabel(field) {
        // Try explicit label
        if (field.id) {
            const label = document.querySelector(`label[for="${field.id}"]`);
            if (label) return label;
        }

        // Try parent label
        let parent = field.parentElement;
        while (parent) {
            if (parent.tagName === 'LABEL') {
                return parent;
            }
            parent = parent.parentElement;
        }

        // Try adjacent label
        const previousSibling = field.previousElementSibling;
        if (previousSibling && previousSibling.tagName === 'LABEL') {
            return previousSibling;
        }

        return null;
    }

    /**
     * Detect the type of a form field
     * @private
     * @param {HTMLElement} field - The form field element
     * @returns {string} The detected field type
     */
    detectFieldType(field) {
        if (field.tagName === 'SELECT') {
            return FIELD_TYPES.SELECT;
        }
        if (field.tagName === 'TEXTAREA') {
            return FIELD_TYPES.TEXTAREA;
        }
        if (field.tagName === 'INPUT') {
            return field.type || FIELD_TYPES.TEXT;
        }
        return FIELD_TYPES.TEXT;
    }

    /**
     * Get the category for a field key
     * @private
     * @param {string} key - The field key
     * @returns {string} The field category
     */
    getCategoryForKey(key) {
        const categoryMap = {
            name: FIELD_CATEGORIES.PERSONAL,
            firstName: FIELD_CATEGORIES.PERSONAL,
            lastName: FIELD_CATEGORIES.PERSONAL,
            email: FIELD_CATEGORIES.CONTACT,
            phone: FIELD_CATEGORIES.CONTACT,
            address: FIELD_CATEGORIES.ADDRESS,
            city: FIELD_CATEGORIES.ADDRESS,
            state: FIELD_CATEGORIES.ADDRESS,
            zip: FIELD_CATEGORIES.ADDRESS,
            country: FIELD_CATEGORIES.ADDRESS,
            company: FIELD_CATEGORIES.BUSINESS,
            website: FIELD_CATEGORIES.BUSINESS,
            password: FIELD_CATEGORIES.PASSWORD
        };
        return categoryMap[key] || FIELD_CATEGORIES.PERSONAL;
    }

    /**
     * Validate a field value based on its type
     * @param {string} value - The field value to validate
     * @param {string} type - The field type
     * @returns {boolean} Whether the value is valid
     */
    validateFieldValue(value, type) {
        switch (type) {
            case FIELD_TYPES.EMAIL:
                return VALIDATION_RULES.EMAIL.test(value);
            case FIELD_TYPES.PHONE:
                return VALIDATION_RULES.PHONE.test(value);
            case FIELD_TYPES.URL:
                return VALIDATION_RULES.URL.test(value);
            default:
                return true;
        }
    }
}

// Export singleton instance
export const fieldMapper = new FieldMapper();