/**
 * Autofill Service
 * Core business logic for handling form detection and autofill operations
 */

import { FormField, FieldMapping } from './models.js';
import { fieldMapper } from './fieldMapper.js';
import { FIELD_TYPES, FIELD_CATEGORIES } from './constants.js';

export class AutofillService {
    constructor() {
        this.fieldMappings = new Map();
    }

    /**
     * Analyze a form and create field mappings
     * @param {HTMLFormElement} form - Form element to analyze
     * @returns {Array<FormField>} Detected form fields
     */
    analyzeForm(form) {
        const fields = [];
        const elements = this.getFormElements(form);

        for (const element of elements) {
            const field = this.createFieldFromElement(element);
            if (field) {
                fields.push(field);
            }
        }

        return fields;
    }

    /**
     * Create a FormField instance from a DOM element
     * @private
     * @param {HTMLElement} element - Form element
     * @returns {FormField|null} Form field instance
     */
    createFieldFromElement(element) {
        // Skip hidden or non-input elements
        if (!this.isValidFormElement(element)) {
            return null;
        }

        const mapping = fieldMapper.mapField(element);
        if (!mapping) {
            return null;
        }

        return new FormField({
            id: element.id || element.name,
            name: element.name || element.id,
            type: mapping.type,
            label: mapping.labelText || '',
            placeholder: element.placeholder || '',
            required: element.required,
            category: mapping.category,
            mapping: mapping.key
        });
    }

    /**
     * Check if element is a valid form input
     * @private
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} Whether element is valid
     */
    isValidFormElement(element) {
        // Skip hidden elements
        if (element.type === 'hidden' || 
            !element.offsetParent || 
            window.getComputedStyle(element).display === 'none') {
            return false;
        }

        // Check element type
        const validTypes = ['input', 'select', 'textarea'];
        if (!validTypes.includes(element.tagName.toLowerCase())) {
            return false;
        }

        // Skip submit, reset, button inputs
        const skipTypes = ['submit', 'reset', 'button', 'file', 'image'];
        if (element.type && skipTypes.includes(element.type)) {
            return false;
        }

        return true;
    }

    /**
     * Get all form elements including those outside <form>
     * @private
     * @param {HTMLFormElement} form - Form element or document
     * @returns {Array<HTMLElement>} Form elements
     */
    getFormElements(form) {
        const elements = [];

        // Get elements within form
        if (form instanceof HTMLFormElement) {
            elements.push(...Array.from(form.elements));
        }

        // Get elements outside forms
        const standaloneInputs = document.querySelectorAll(
            'input:not(form input), select:not(form select), textarea:not(form textarea)'
        );
        elements.push(...Array.from(standaloneInputs));

        return elements;
    }

    /**
     * Map profile data to form fields
     * @param {Object} profile - Profile data
     * @param {Array<FormField>} fields - Form fields
     * @returns {Object} Field values mapped by selector
     */
    mapProfileToFields(profile, fields) {
        const mappedData = {};

        for (const field of fields) {
            const value = this.getValueForField(profile, field);
            if (value !== null) {
                const selector = this.getFieldSelector(field);
                mappedData[selector] = value;
            }
        }

        return mappedData;
    }

    /**
     * Get value for a field from profile data
     * @private
     * @param {Object} profile - Profile data
     * @param {FormField} field - Form field
     * @returns {string|null} Field value
     */
    getValueForField(profile, field) {
        // Try custom mapping first
        const mapping = this.fieldMappings.get(field.id);
        if (mapping) {
            return mapping.getValue(profile);
        }

        // Try automatic mapping
        if (field.mapping) {
            let section = '';
            switch (field.category) {
                case FIELD_CATEGORIES.PERSONAL:
                    section = 'personal';
                    break;
                case FIELD_CATEGORIES.BUSINESS:
                    section = 'business';
                    break;
                case FIELD_CATEGORIES.SOCIAL:
                    section = 'socialMedia';
                    break;
            }

            if (section && profile[section]?.[field.mapping]) {
                return profile[section][field.mapping];
            }
        }

        return null;
    }

    /**
     * Get CSS selector for field
     * @private
     * @param {FormField} field - Form field
     * @returns {string} CSS selector
     */
    getFieldSelector(field) {
        if (field.id) {
            return `#${field.id}`;
        }
        if (field.name) {
            return `[name="${field.name}"]`;
        }
        return '';
    }

    /**
     * Add or update field mapping
     * @param {string} fieldId - Field ID
     * @param {FieldMapping} mapping - Field mapping
     */
    setFieldMapping(fieldId, mapping) {
        this.fieldMappings.set(fieldId, mapping);
    }

    /**
     * Remove field mapping
     * @param {string} fieldId - Field ID
     */
    removeFieldMapping(fieldId) {
        this.fieldMappings.delete(fieldId);
    }

    /**
     * Clear all field mappings
     */
    clearFieldMappings() {
        this.fieldMappings.clear();
    }
}