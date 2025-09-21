export const EXTENSION_CONFIG = {
    VERSION: '7.0',
    STORAGE_KEYS: {
        SERVICES: 'services',
        SOCIAL_LINKS: 'socialLinks',
        UNIVERSAL_FORM_DATA: 'universalFormData',
        PASSWORD: 'fillPassword',
        SETTINGS: 'settings',
        SELECTED_CATEGORY: 'selectedCategory',
        SELECTED_LOCATION: 'selectedLocation'
    },
    MESSAGE_TYPES: {
        GET_SERVICES: 'GET_SERVICES',
        RESET_SERVICES: 'RESET_SERVICES_TO_DEFAULT',
        SERVICES_UPDATED: 'SERVICES_UPDATED',
        UNIVERSAL_FORM_DATA_UPDATED: 'UNIVERSAL_FORM_DATA_UPDATED',
        CATEGORY_UPDATED: 'CATEGORY_UPDATED',
        LOCATION_UPDATED: 'LOCATION_UPDATED',
        SETTINGS_UPDATED: 'SETTINGS_UPDATED'
    },
    DEFAULT_SERVICES: {
        facebook: { enabled: true, priority: 1 },
        instagram: { enabled: true, priority: 2 },
        twitter: { enabled: true, priority: 3 },
        youtube: { enabled: true, priority: 4 },
        linkedin: { enabled: true, priority: 5 },
        pinterest: { enabled: true, priority: 6 },
        tiktok: { enabled: true, priority: 7 },
        snapchat: { enabled: true, priority: 8 },
        website: { enabled: true, priority: 9 }
    },
    LOG_LEVELS: {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3
    }
};