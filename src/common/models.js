/**
 * Core Domain Models
 */

/**
 * Profile Data Model
 */
export class Profile {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.isActive = data.isActive || false;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        
        // Personal Information
        this.personal = {
            firstName: data.personal?.firstName || '',
            lastName: data.personal?.lastName || '',
            email: data.personal?.email || '',
            phone: data.personal?.phone || '',
            website: data.personal?.website || ''
        };

        // Business Information
        this.business = {
            companyName: data.business?.companyName || '',
            address: data.business?.address || '',
            city: data.business?.city || '',
            state: data.business?.state || '',
            zip: data.business?.zip || '',
            country: data.business?.country || '',
            industry: data.business?.industry || '',
            description: data.business?.description || ''
        };

        // Social Media Links
        this.socialMedia = {
            facebook: data.socialMedia?.facebook || '',
            twitter: data.socialMedia?.twitter || '',
            linkedin: data.socialMedia?.linkedin || '',
            instagram: data.socialMedia?.instagram || '',
            youtube: data.socialMedia?.youtube || '',
            pinterest: data.socialMedia?.pinterest || ''
        };

        // Form Field Mappings
        this.fieldMappings = data.fieldMappings || {};
    }

    /**
     * Update profile data
     * @param {Object} data - New profile data
     */
    update(data) {
        Object.assign(this, new Profile({
            ...this,
            ...data,
            updatedAt: new Date().toISOString()
        }));
    }

    /**
     * Validate profile data
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];

        // Required fields
        if (!this.name) {
            errors.push('Profile name is required');
        }

        // Email format
        if (this.personal.email && !this.isValidEmail(this.personal.email)) {
            errors.push('Invalid email format');
        }

        // Phone format
        if (this.personal.phone && !this.isValidPhone(this.personal.phone)) {
            errors.push('Invalid phone format');
        }

        // Website format
        if (this.personal.website && !this.isValidUrl(this.personal.website)) {
            errors.push('Invalid website URL format');
        }

        // Social media URLs
        Object.entries(this.socialMedia).forEach(([platform, url]) => {
            if (url && !this.isValidUrl(url)) {
                errors.push(`Invalid ${platform} URL format`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate email format
     * @private
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Validate phone format
     * @private
     */
    isValidPhone(phone) {
        return /^\+?[\d\s-()]{10,}$/.test(phone);
    }

    /**
     * Validate URL format
     * @private
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Convert to JSON
     */
    toJSON() {
        const { validate, isValidEmail, isValidPhone, isValidUrl, ...data } = this;
        return data;
    }
}

/**
 * Form Field Model
 */
export class FormField {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.type = data.type || 'text';
        this.label = data.label || '';
        this.value = data.value || '';
        this.placeholder = data.placeholder || '';
        this.required = data.required || false;
        this.category = data.category || null;
        this.mapping = data.mapping || null;
    }

    /**
     * Check if field matches a profile property
     * @param {string} property - Property name to match
     * @returns {boolean} Whether field matches property
     */
    matchesProperty(property) {
        const name = (this.name || '').toLowerCase();
        const label = (this.label || '').toLowerCase();
        const placeholder = (this.placeholder || '').toLowerCase();
        const terms = property.toLowerCase().split('_');

        return terms.every(term => 
            name.includes(term) || 
            label.includes(term) || 
            placeholder.includes(term)
        );
    }
}

/**
 * Field Mapping Model
 */
export class FieldMapping {
    constructor(data = {}) {
        this.id = data.id || null;
        this.fieldId = data.fieldId || null;
        this.profileProperty = data.profileProperty || null;
        this.transformation = data.transformation || null;
        this.rules = data.rules || [];
    }

    /**
     * Apply mapping to get field value
     * @param {Object} profileData - Profile data
     * @returns {string} Mapped value
     */
    getValue(profileData) {
        let value = '';

        // Get raw value from profile
        if (this.profileProperty) {
            value = this.getNestedValue(profileData, this.profileProperty);
        }

        // Apply transformation if specified
        if (this.transformation && typeof this.transformation === 'function') {
            value = this.transformation(value);
        }

        // Apply rules
        for (const rule of this.rules) {
            if (rule.condition(value)) {
                value = rule.transform(value);
            }
        }

        return value;
    }

    /**
     * Get nested object value by path
     * @private
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((curr, key) => 
            curr && curr[key] !== undefined ? curr[key] : '', obj);
    }
}