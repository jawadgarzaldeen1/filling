/**
 * Profile Data Service
 * Handles profile data persistence and retrieval
 */

import { storageService } from './storage.js';
import { Profile } from './models.js';
import { STORAGE_KEYS } from './constants.js';

export class ProfileDataService {
    constructor() {
        this.profiles = new Map();
        this.activeProfileId = null;
    }

    /**
     * Initialize service and load profiles
     */
    async initialize() {
        try {
            const data = await storageService.get([
                STORAGE_KEYS.PROFILES,
                STORAGE_KEYS.ACTIVE_PROFILE
            ]);

            // Load profiles
            const profiles = data[STORAGE_KEYS.PROFILES] || [];
            profiles.forEach(profileData => {
                const profile = new Profile(profileData);
                this.profiles.set(profile.id, profile);
            });

            // Set active profile
            this.activeProfileId = data[STORAGE_KEYS.ACTIVE_PROFILE] || null;

            console.log('Loaded', this.profiles.size, 'profiles');
        } catch (error) {
            console.error('Failed to initialize profile data service:', error);
            throw error;
        }
    }

    /**
     * Get all profiles
     * @returns {Array<Profile>} Array of profiles
     */
    getAllProfiles() {
        return Array.from(this.profiles.values());
    }

    /**
     * Get profile by ID
     * @param {string} id - Profile ID
     * @returns {Profile|null} Profile if found
     */
    getProfile(id) {
        return this.profiles.get(id) || null;
    }

    /**
     * Get active profile
     * @returns {Profile|null} Active profile if set
     */
    getActiveProfile() {
        return this.activeProfileId ? this.getProfile(this.activeProfileId) : null;
    }

    /**
     * Create new profile
     * @param {Object} data - Profile data
     * @returns {Profile} Created profile
     */
    async createProfile(data) {
        const profile = new Profile(data);

        // Validate profile data
        const validation = profile.validate();
        if (!validation.isValid) {
            throw new Error('Invalid profile data: ' + validation.errors.join(', '));
        }

        // Generate ID if not provided
        if (!profile.id) {
            profile.id = this.generateProfileId();
        }

        this.profiles.set(profile.id, profile);
        await this.saveProfiles();

        return profile;
    }

    /**
     * Update existing profile
     * @param {string} id - Profile ID
     * @param {Object} data - Updated profile data
     * @returns {Profile} Updated profile
     */
    async updateProfile(id, data) {
        const profile = this.getProfile(id);
        if (!profile) {
            throw new Error('Profile not found');
        }

        profile.update(data);

        // Validate updated profile
        const validation = profile.validate();
        if (!validation.isValid) {
            throw new Error('Invalid profile data: ' + validation.errors.join(', '));
        }

        this.profiles.set(id, profile);
        await this.saveProfiles();

        return profile;
    }

    /**
     * Delete profile
     * @param {string} id - Profile ID
     */
    async deleteProfile(id) {
        if (!this.profiles.has(id)) {
            throw new Error('Profile not found');
        }

        this.profiles.delete(id);

        // Clear active profile if deleted
        if (this.activeProfileId === id) {
            await this.setActiveProfile(null);
        }

        await this.saveProfiles();
    }

    /**
     * Set active profile
     * @param {string|null} id - Profile ID or null to clear
     */
    async setActiveProfile(id) {
        if (id && !this.profiles.has(id)) {
            throw new Error('Profile not found');
        }

        this.activeProfileId = id;
        await storageService.set({
            [STORAGE_KEYS.ACTIVE_PROFILE]: id
        });
    }

    /**
     * Save all profiles to storage
     * @private
     */
    async saveProfiles() {
        const profiles = this.getAllProfiles().map(profile => profile.toJSON());
        await storageService.set({
            [STORAGE_KEYS.PROFILES]: profiles
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

// Export singleton instance
export const profileDataService = new ProfileDataService();