/**
 * Message Types and Communication Constants
 */
export const MESSAGE_TYPES = {
    FORM_DETECTED: 'FORM_DETECTED',
    AUTOFILL_REQUEST: 'AUTOFILL_REQUEST',
    AUTOFILL_DATA: 'AUTOFILL_DATA',
    PROFILE_UPDATED: 'PROFILE_UPDATED',
    SETTINGS_CHANGED: 'SETTINGS_CHANGED'
};

/**
 * Storage Keys
 */
export const STORAGE_KEYS = {
    PROFILES: 'profiles',
    SETTINGS: 'settings',
    FIELD_MAPPINGS: 'fieldMappings',
    ACTIVE_PROFILE: 'activeProfile'
};

/**
 * Field Types for form detection and mapping
 */
export const FIELD_TYPES = {
    TEXT: 'text',
    EMAIL: 'email',
    PHONE: 'tel',
    URL: 'url',
    PASSWORD: 'password',
    DATE: 'date',
    NUMBER: 'number',
    TEXTAREA: 'textarea',
    SELECT: 'select',
    CHECKBOX: 'checkbox',
    RADIO: 'radio'
};

/**
 * Form Field Categories for mapping and autofill
 */
export const FIELD_CATEGORIES = {
    PERSONAL: 'personal',
    ADDRESS: 'address',
    CONTACT: 'contact',
    BUSINESS: 'business',
    SOCIAL: 'social',
    PASSWORD: 'password'
};

/**
 * Validation Rules
 */
export const VALIDATION_RULES = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^\+?[\d\s-()]{10,}$/,
    URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/
};

/**
 * Extension Version
 */
export const VERSION = '2.0.0';