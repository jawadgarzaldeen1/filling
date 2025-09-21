/**
 * Message Service for handling communication between extension components
 */
class MessageService {
    constructor() {
        this.handlers = new Map();
    }

    /**
     * Register a message handler for a specific type
     * @param {string} type - Message type
     * @param {Function} handler - Handler function
     */
    on(type, handler) {
        this.handlers.set(type, handler);
    }

    /**
     * Send a message to the background script
     * @param {string} type - Message type
     * @param {object} data - Message data
     * @returns {Promise} Response from the handler
     */
    async sendToBackground(type, data = {}) {
        try {
            return await chrome.runtime.sendMessage({ type, ...data });
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Send a message to a specific tab
     * @param {number} tabId - Target tab ID
     * @param {string} type - Message type
     * @param {object} data - Message data
     * @returns {Promise} Response from the handler
     */
    async sendToTab(tabId, type, data = {}) {
        try {
            return await chrome.tabs.sendMessage(tabId, { type, ...data });
        } catch (error) {
            console.error('Error sending message to tab:', error);
            throw error;
        }
    }

    /**
     * Initialize message listeners
     */
    initializeListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const handler = this.handlers.get(message.type);
            if (handler) {
                Promise.resolve(handler(message, sender))
                    .then(sendResponse)
                    .catch(error => {
                        console.error('Error in message handler:', error);
                        sendResponse({ error: error.message });
                    });
                return true; // Will respond asynchronously
            }
        });
    }
}

// Export a singleton instance
export const messageService = new MessageService();