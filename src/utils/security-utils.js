/**
 * Security Utilities for Social Filler Pro Extension
 * 
 * Provides encryption, sanitization, and security features
 * 
 * @version 7.1
 * @author Social Filler Pro Team
 */

'use strict';

class SecurityUtils {
    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
    }

    /**
     * Generate a cryptographic key from password
     */
    async generateKey(password, salt) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            this.encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt sensitive data
     */
    async encrypt(data, password) {
        try {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await this.generateKey(password, salt);
            
            const encodedData = this.encoder.encode(JSON.stringify(data));
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encodedData
            );

            // Combine salt, iv, and encrypted data
            const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('[SECURITY] Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     */
    async decrypt(encryptedData, password) {
        try {
            const combined = new Uint8Array(atob(encryptedData).split('').map(char => char.charCodeAt(0)));
            
            const salt = combined.slice(0, 16);
            const iv = combined.slice(16, 28);
            const data = combined.slice(28);
            
            const key = await this.generateKey(password, salt);
            
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            );

            return JSON.parse(this.decoder.decode(decryptedData));
        } catch (error) {
            console.error('[SECURITY] Decryption failed:', error);
            throw new Error('Failed to decrypt data - incorrect password or corrupted data');
        }
    }

    /**
     * Generate secure random password
     */
    generateSecurePassword(length = 16) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => charset[byte % charset.length]).join('');
    }

    /**
     * Sanitize HTML input to prevent XSS
     */
    sanitizeHtml(input) {
        if (!input || typeof input !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    /**
     * Validate and sanitize URL
     */
    validateAndSanitizeUrl(url) {
        if (!url || typeof url !== 'string') return null;
        
        // Remove potentially dangerous characters
        const sanitized = url.trim().replace(/[<>'"]/g, '');
        
        try {
            const urlObj = new URL(sanitized.startsWith('http') ? sanitized : `https://${sanitized}`);
            
            // Only allow http and https protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                throw new Error('Invalid protocol');
            }
            
            // Block localhost and private IPs in production
            if (urlObj.hostname === 'localhost' || 
                urlObj.hostname.startsWith('127.') || 
                urlObj.hostname.startsWith('192.168.') ||
                urlObj.hostname.startsWith('10.') ||
                urlObj.hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)) {
                throw new Error('Private/local URLs not allowed');
            }
            
            return urlObj.href;
        } catch (error) {
            console.warn('[SECURITY] Invalid URL:', sanitized, error.message);
            return null;
        }
    }

    /**
     * Validate email address
     */
    validateEmail(email) {
        if (!email || typeof email !== 'string') return false;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Validate phone number
     */
    validatePhone(phone) {
        if (!phone || typeof phone !== 'string') return false;
        
        // Allow various phone formats
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
        return phoneRegex.test(cleanPhone);
    }

    /**
     * Rate limiting helper
     */
    createRateLimiter(maxRequests, timeWindow) {
        const requests = new Map();
        
        return (key) => {
            const now = Date.now();
            const requestTimes = requests.get(key) || [];
            
            // Remove old requests outside the time window
            const validRequests = requestTimes.filter(time => now - time < timeWindow);
            
            if (validRequests.length >= maxRequests) {
                return false; // Rate limited
            }
            
            validRequests.push(now);
            requests.set(key, validRequests);
            return true; // Request allowed
            
        };
    }

    /**
     * Generate content hash for integrity checking
     */
    async generateHash(content) {
        const data = this.encoder.encode(JSON.stringify(content));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Verify content integrity
     */
    async verifyIntegrity(content, expectedHash) {
        const actualHash = await this.generateHash(content);
        return actualHash === expectedHash;
    }
}

// Export for use in other modules
window.SecurityUtils = SecurityUtils;
