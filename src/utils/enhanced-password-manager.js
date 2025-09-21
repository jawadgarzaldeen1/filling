/**
 * Enhanced Password Manager for Social Filler Pro Extension
 * 
 * Provides secure password storage and management with encryption
 * 
 * @version 7.1
 * @author Social Filler Pro Team
 */

'use strict';

class EnhancedPasswordManager {
    constructor(logger) {
        this.logger = logger;
        this.security = new SecurityUtils();
        this.masterKey = null;
        this.isUnlocked = false;
        this.lockTimeout = null;
        this.STORAGE_KEY = 'encryptedPasswords';
        this.MASTER_KEY_STORAGE = 'masterKeyHash';
        this.AUTO_LOCK_TIME = 300000; // 5 minutes
    }

    /**
     * Initialize password manager
     */
    async initialize() {
        try {
            await this.checkMasterPassword();
            this.setupAutoLock();
            this.logger.info('Enhanced password manager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize password manager:', error);
        }
    }

    /**
     * Check if master password is set
     */
    async hasMasterPassword() {
        const result = await chrome.storage.local.get(this.MASTER_KEY_STORAGE);
        return !!result[this.MASTER_KEY_STORAGE];
    }

    /**
     * Set up master password
     */
    async setupMasterPassword(password) {
        try {
            if (!password || password.length < 8) {
                throw new Error('Master password must be at least 8 characters long');
            }

            // Generate hash for verification
            const hash = await this.security.generateHash(password);
            await chrome.storage.local.set({ [this.MASTER_KEY_STORAGE]: hash });

            // Unlock with the new password
            await this.unlock(password);

            this.logger.info('Master password set successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to setup master password:', error);
            throw error;
        }
    }

    /**
     * Verify master password
     */
    async verifyMasterPassword(password) {
        try {
            const result = await chrome.storage.local.get(this.MASTER_KEY_STORAGE);
            const storedHash = result[this.MASTER_KEY_STORAGE];
            
            if (!storedHash) {
                return false;
            }

            const hash = await this.security.generateHash(password);
            return hash === storedHash;
        } catch (error) {
            this.logger.error('Failed to verify master password:', error);
            return false;
        }
    }

    /**
     * Unlock password manager
     */
    async unlock(masterPassword) {
        try {
            const isValid = await this.verifyMasterPassword(masterPassword);
            if (!isValid) {
                throw new Error('Invalid master password');
            }

            this.masterKey = masterPassword;
            this.isUnlocked = true;
            this.resetAutoLock();

            this.logger.debug('Password manager unlocked');
            return true;
        } catch (error) {
            this.logger.error('Failed to unlock password manager:', error);
            throw error;
        }
    }

    /**
     * Lock password manager
     */
    lock() {
        this.masterKey = null;
        this.isUnlocked = false;
        this.clearAutoLockTimeout();
        this.logger.debug('Password manager locked');
    }

    /**
     * Setup auto-lock functionality
     */
    setupAutoLock() {
        this.resetAutoLock();
    }

    /**
     * Reset auto-lock timer
     */
    resetAutoLock() {
        this.clearAutoLockTimeout();
        if (this.isUnlocked) {
            this.lockTimeout = setTimeout(() => {
                this.lock();
            }, this.AUTO_LOCK_TIME);
        }
    }

    /**
     * Clear auto-lock timeout
     */
    clearAutoLockTimeout() {
        if (this.lockTimeout) {
            clearTimeout(this.lockTimeout);
            this.lockTimeout = null;
        }
    }

    /**
     * Store encrypted password
     */
    async storePassword(identifier, password) {
        try {
            if (!this.isUnlocked) {
                throw new Error('Password manager is locked');
            }

            this.resetAutoLock();

            // Load existing passwords
            const passwords = await this.loadPasswords();
            
            // Add/update password
            passwords[identifier] = {
                password: password,
                createdAt: Date.now(),
                lastModified: Date.now()
            };

            // Encrypt and store
            const encrypted = await this.security.encrypt(passwords, this.masterKey);
            await chrome.storage.local.set({ [this.STORAGE_KEY]: encrypted });

            this.logger.debug(`Password stored for ${identifier}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to store password:', error);
            throw error;
        }
    }

    /**
     * Retrieve decrypted password
     */
    async retrievePassword(identifier) {
        try {
            if (!this.isUnlocked) {
                throw new Error('Password manager is locked');
            }

            this.resetAutoLock();

            const passwords = await this.loadPasswords();
            const passwordData = passwords[identifier];

            if (!passwordData) {
                return null;
            }

            return passwordData.password;
        } catch (error) {
            this.logger.error('Failed to retrieve password:', error);
            throw error;
        }
    }

    /**
     * Load and decrypt all passwords
     */
    async loadPasswords() {
        try {
            if (!this.isUnlocked) {
                return {};
            }

            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            const encrypted = result[this.STORAGE_KEY];

            if (!encrypted) {
                return {};
            }

            const decrypted = await this.security.decrypt(encrypted, this.masterKey);
            return decrypted || {};
        } catch (error) {
            this.logger.error('Failed to load passwords:', error);
            return {};
        }
    }

    /**
     * Delete password
     */
    async deletePassword(identifier) {
        try {
            if (!this.isUnlocked) {
                throw new Error('Password manager is locked');
            }

            this.resetAutoLock();

            const passwords = await this.loadPasswords();
            delete passwords[identifier];

            const encrypted = await this.security.encrypt(passwords, this.masterKey);
            await chrome.storage.local.set({ [this.STORAGE_KEY]: encrypted });

            this.logger.debug(`Password deleted for ${identifier}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to delete password:', error);
            throw error;
        }
    }

    /**
     * List all password identifiers
     */
    async listPasswordIdentifiers() {
        try {
            if (!this.isUnlocked) {
                throw new Error('Password manager is locked');
            }

            const passwords = await this.loadPasswords();
            return Object.keys(passwords);
        } catch (error) {
            this.logger.error('Failed to list password identifiers:', error);
            return [];
        }
    }

    /**
     * Generate secure password
     */
    generateSecurePassword(length = 16, includeSymbols = true) {
        const charset = includeSymbols 
            ? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
            : 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        
        return this.security.generateSecurePassword(length, charset);
    }

    /**
     * Change master password
     */
    async changeMasterPassword(currentPassword, newPassword) {
        try {
            // Verify current password
            const isValid = await this.verifyMasterPassword(currentPassword);
            if (!isValid) {
                throw new Error('Current password is incorrect');
            }

            // Load passwords with current key
            const passwords = await this.loadPasswords();

            // Set new master password
            await this.setupMasterPassword(newPassword);

            // Re-encrypt passwords with new key
            if (Object.keys(passwords).length > 0) {
                const encrypted = await this.security.encrypt(passwords, newPassword);
                await chrome.storage.local.set({ [this.STORAGE_KEY]: encrypted });
            }

            this.logger.info('Master password changed successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to change master password:', error);
            throw error;
        }
    }

    /**
     * Export encrypted passwords (for backup)
     */
    async exportPasswords() {
        try {
            if (!this.isUnlocked) {
                throw new Error('Password manager is locked');
            }

            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            return {
                encrypted: result[this.STORAGE_KEY],
                timestamp: Date.now(),
                version: '1.0'
            };
        } catch (error) {
            this.logger.error('Failed to export passwords:', error);
            throw error;
        }
    }

    /**
     * Import encrypted passwords (from backup)
     */
    async importPasswords(backupData) {
        try {
            if (!this.isUnlocked) {
                throw new Error('Password manager is locked');
            }

            if (!backupData || !backupData.encrypted) {
                throw new Error('Invalid backup data');
            }

            await chrome.storage.local.set({ [this.STORAGE_KEY]: backupData.encrypted });

            this.logger.info('Passwords imported successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to import passwords:', error);
            throw error;
        }
    }

    /**
     * Clear all stored passwords
     */
    async clearAllPasswords() {
        try {
            await chrome.storage.local.remove([this.STORAGE_KEY, this.MASTER_KEY_STORAGE]);
            this.lock();
            
            this.logger.info('All passwords cleared');
            return true;
        } catch (error) {
            this.logger.error('Failed to clear passwords:', error);
            throw error;
        }
    }

    /**
     * Check if password manager needs master password setup
     */
    async checkMasterPassword() {
        const hasPassword = await this.hasMasterPassword();
        if (!hasPassword) {
            // Show setup UI or prompt
            this.logger.info('Master password setup required');
            return false;
        }
        return true;
    }

    /**
     * Get password strength score
     */
    getPasswordStrength(password) {
        if (!password) return { score: 0, feedback: 'Password required' };

        let score = 0;
        const feedback = [];

        // Length
        if (password.length >= 12) score += 2;
        else if (password.length >= 8) score += 1;
        else feedback.push('Use at least 8 characters');

        // Uppercase
        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('Add uppercase letters');

        // Lowercase
        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('Add lowercase letters');

        // Numbers
        if (/\d/.test(password)) score += 1;
        else feedback.push('Add numbers');

        // Special characters
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
        else feedback.push('Add special characters');

        // Common patterns (reduce score)
        if (/123|abc|password|qwerty/i.test(password)) {
            score = Math.max(0, score - 2);
            feedback.push('Avoid common patterns');
        }

        return {
            score: Math.min(5, score),
            strength: score >= 4 ? 'Strong' : score >= 2 ? 'Medium' : 'Weak',
            feedback: feedback
        };
    }
}

// Export for use in other modules
window.EnhancedPasswordManager = EnhancedPasswordManager;