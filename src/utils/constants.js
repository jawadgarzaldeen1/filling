/**
 * Constants used throughout the extension
 */
export const MESSAGE_TYPES = {
    FORM_DETECTED: 'FORM_DETECTED',
    AUTOFILL_REQUEST: 'AUTOFILL_REQUEST',
    UPDATE_PROFILE: 'UPDATE_PROFILE',
    GET_PROFILE: 'GET_PROFILE',
    SAVE_SETTINGS: 'SAVE_SETTINGS',
    GET_SETTINGS: 'GET_SETTINGS'
};

export const STORAGE_KEYS = {
    PROFILES: 'profiles',
    SETTINGS: 'settings',
    LAST_USED: 'lastUsed'
};

export const DEFAULT_SETTINGS = {
    autoFill: true,
    showNotifications: true,
    defaultProfile: 'default'
};