'use strict';

/**
 * Promise-based storage operations with error handling
 */
export class StorageManager {
    constructor(logger) {
        this.logger = logger;
    }

    async get(keys = null) {
        try {
            const result = await chrome.storage.sync.get(keys);
            this.logger.debug('Storage get successful:', keys, result);
            return result;
        } catch (error) {
            this.logger.error('Storage get failed:', error);
            throw new Error(`Failed to retrieve data: ${error.message}`);
        }
    }

    async set(data) {
        try {
            await chrome.storage.sync.set(data);
            this.logger.debug('Storage set successful:', data);
            return true;
        } catch (error) {
            this.logger.error('Storage set failed:', error);
            throw new Error(`Failed to save data: ${error.message}`);
        }
    }

    async clear() {
        try {
            await chrome.storage.sync.clear();
            this.logger.info('Storage cleared successfully');
            return true;
        } catch (error) {
            this.logger.error('Storage clear failed:', error);
            throw new Error(`Failed to clear storage: ${error.message}`);
        }
    }
}