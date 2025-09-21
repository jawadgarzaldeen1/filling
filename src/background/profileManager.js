/**
 * Profile Manager
 * Handles profile storage, matching, and management
 */

import { storageService } from '../common/storage.js';
import { STORAGE_KEYS } from '../common/constants.js';
import { fieldMapper } from '../common/fieldMapper.js';

export class ProfileManager {
    constructor() {
        this.profiles = [];
        this.activeProfileId = null;
    }

    /**
     * Initialize profile manager
     */
    async initialize() {
        try {
            const data = await storageService.get([
                STORAGE_KEYS.PROFILES,
                STORAGE_KEYS.ACTIVE_PROFILE
            ]);
            
            this.profiles = data[STORAGE_KEYS.PROFILES] || [];
            this.activeProfileId = data[STORAGE_KEYS.ACTIVE_PROFILE];
            
            console.log('Profile manager initialized with', this.profiles.length, 'profiles');
        } catch (error) {
            console.error('Failed to initialize profile manager:', error);
            throw error;
        }
    }

    /**
     * Find matching profile for form
     * @param {Object} formData - Form field data
     * @param {string} url - Page URL
     * @returns {Object|null} Matching profile
     */
    async findMatchingProfile(formData, url) {
        if (!formData.fields || formData.fields.length === 0) {
            return null;
        }

        // If there's an active profile, use that
        if (this.activeProfileId) {
            const activeProfile = this.profiles.find(p => p.id === this.activeProfileId);
            if (activeProfile) {
                return activeProfile;
            }
        }

        // Otherwise try to find best matching profile based on form fields
        let bestMatch = null;
        let highestScore = 0;

        for (const profile of this.profiles) {
            const score = this.calculateMatchScore(profile, formData.fields);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = profile;
            }
        }

        return bestMatch;
    }

    /**
     * Calculate how well a profile matches form fields
     * @private
     * @param {Object} profile - Profile data
     * @param {Array} fields - Form fields
     * @returns {number} Match score
     */
    calculateMatchScore(profile, fields) {
        let score = 0;
        const profileData = { ...profile.personal, ...profile.business };

        fields.forEach(field => {
            if (field.key && profileData[field.key]) {
                score++;
            }
        });

        return score;
    }

    /**
     * Map profile data to form fields
     * @param {string} profileId - Profile ID
     * @param {Object} formData - Form field data
     * @returns {Object} Mapped field values
     */
    async mapProfileToForm(profileId, formData) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            throw new Error('Profile not found');
        }

        const mappedData = {};
        const profileData = { ...profile.personal, ...profile.business };

        formData.fields.forEach(field => {
            if (field.key && profileData[field.key]) {
                // Validate value before mapping
                const value = profileData[field.key];
                if (fieldMapper.validateFieldValue(value, field.type)) {
                    mappedData[`#${field.originalId}`] = value;
                }
            }
        });

        return mappedData;
    }

    /**
     * Add or update profile
     * @param {Object} profile - Profile data
     */
    async updateProfile(profile) {
        const index = this.profiles.findIndex(p => p.id === profile.id);
        
        if (index >= 0) {
            this.profiles[index] = profile;
        } else {
            profile.id = this.generateProfileId();
            this.profiles.push(profile);
        }

        await this.saveProfiles();
    }

    /**
     * Delete profile
     * @param {string} profileId - Profile ID
     */
    async deleteProfile(profileId) {
        this.profiles = this.profiles.filter(p => p.id !== profileId);
        
        if (this.activeProfileId === profileId) {
            this.activeProfileId = null;
            await storageService.remove(STORAGE_KEYS.ACTIVE_PROFILE);
        }

        await this.saveProfiles();
    }

    /**
     * Set active profile
     * @param {string} profileId - Profile ID
     */
    async setActiveProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            throw new Error('Profile not found');
        }

        this.activeProfileId = profileId;
        await storageService.set({
            [STORAGE_KEYS.ACTIVE_PROFILE]: profileId
        });
    }

    /**
     * Save profiles to storage
     * @private
     */
    async saveProfiles() {
        await storageService.set({
            [STORAGE_KEYS.PROFILES]: this.profiles
        });
    }

    /**
     * Generate unique profile ID
     * @private
     * @returns {string} New profile ID
     */
    generateProfileId() {
        return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}