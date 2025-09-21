/**
 * Storage Service
 * Handles all storage operations and sync functionality
 */

class StorageService {
    constructor() {
        this.syncInProgress = false;
        this.pendingSync = new Map();
        this.setupStorageListener();
    }

    /**
     * Setup storage change listener
     * @private
     */
    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            // Skip if this is our own sync
            if (this.syncInProgress) return;

            // Handle changes from other instances
            if (areaName === 'sync') {
                this.handleRemoteChanges(changes);
            }
        });
    }

    /**
     * Get data from storage
     * @param {string|Array<string>} keys - Key or array of keys to fetch
     * @param {boolean} useSync - Whether to use sync storage (default: true)
     * @returns {Promise<any>}
     */
    async get(keys, useSync = true) {
        const storage = useSync ? chrome.storage.sync : chrome.storage.local;
        try {
            const data = await storage.get(keys);
            
            // If requesting synced data, also check pending changes
            if (useSync) {
                keys = Array.isArray(keys) ? keys : [keys];
                keys.forEach(key => {
                    if (this.pendingSync.has(key)) {
                        data[key] = this.pendingSync.get(key);
                    }
                });
            }
            
            return data;
        } catch (error) {
            console.error('Storage get error:', error);
            throw error;
        }
    }

    /**
     * Set data in storage
     * @param {Object} data - Key-value pairs to store
     * @param {boolean} useSync - Whether to use sync storage (default: true)
     * @param {Object} options - Additional options
     * @returns {Promise<void>}
     */
    async set(data, useSync = true, options = {}) {
        const storage = useSync ? chrome.storage.sync : chrome.storage.local;
        const { batch = true, batchDelay = 1000 } = options;

        try {
            if (useSync) {
                // Add to pending sync
                Object.entries(data).forEach(([key, value]) => {
                    this.pendingSync.set(key, value);
                });

                // If batching is enabled, debounce the sync
                if (batch) {
                    if (this._batchTimeout) {
                        clearTimeout(this._batchTimeout);
                    }
                    this._batchTimeout = setTimeout(() => {
                        this.flushPendingSync();
                    }, batchDelay);
                    return;
                }

                // Otherwise sync immediately
                await this.flushPendingSync();
            } else {
                // For local storage, just set immediately
                await storage.set(data);
            }
        } catch (error) {
            console.error('Storage set error:', error);
            throw error;
        }
    }

    /**
     * Flush pending sync changes to storage
     * @private
     */
    async flushPendingSync() {
        if (this.syncInProgress || this.pendingSync.size === 0) return;

        try {
            this.syncInProgress = true;

            // Get current sync storage data
            const currentData = await chrome.storage.sync.get(null);

            // Merge with pending changes
            const mergedData = { ...currentData };
            this.pendingSync.forEach((value, key) => {
                mergedData[key] = value;
            });

            // Write merged data back to sync storage
            await chrome.storage.sync.set(mergedData);

            // Clear pending sync
            this.pendingSync.clear();
        } catch (error) {
            console.error('Sync flush error:', error);
            throw error;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Handle changes from other instances
     * @private
     */
    handleRemoteChanges(changes) {
        Object.entries(changes).forEach(([key, change]) => {
            // Skip if we have a pending local change
            if (!this.pendingSync.has(key)) {
                // Emit change event
                this.onChanged({ [key]: change });
            }
        });
    }

    /**
     * Remove data from storage
     * @param {string|Array<string>} keys - Key or array of keys to remove
     * @param {boolean} useSync - Whether to use sync storage (default: true)
     * @returns {Promise<void>}
     */
    async remove(keys, useSync = true) {
        const storage = useSync ? chrome.storage.sync : chrome.storage.local;
        try {
            await storage.remove(keys);
        } catch (error) {
            console.error('Storage remove error:', error);
            throw error;
        }
    }

    /**
     * Clear all data from storage
     * @param {boolean} useSync - Whether to use sync storage (default: true)
     * @returns {Promise<void>}
     */
    async clear(useSync = true) {
        const storage = useSync ? chrome.storage.sync : chrome.storage.local;
        try {
            await storage.clear();
        } catch (error) {
            console.error('Storage clear error:', error);
            throw error;
        }
    }

    /**
     * Listen for storage changes
     * @param {Function} callback - Function to call when storage changes
     * @returns {void}
     */
    onChanged(callback) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            callback(changes, areaName);
        });
    }
}

// Export singleton instance
export const storageService = new StorageService();