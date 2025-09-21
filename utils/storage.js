/**
 * Storage management utility
 */
export class StorageManager {
    constructor(namespace = 'popup') {
        this.namespace = namespace;
    }

    async get(key) {
        const result = await chrome.storage.local.get(this.getNamespacedKey(key));
        return result[this.getNamespacedKey(key)];
    }

    async set(key, value) {
        await chrome.storage.local.set({
            [this.getNamespacedKey(key)]: value
        });
    }

    async remove(key) {
        await chrome.storage.local.remove(this.getNamespacedKey(key));
    }

    getNamespacedKey(key) {
        return `${this.namespace}_${key}`;
    }
}