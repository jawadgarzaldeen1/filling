/**
 * Message Handling System
 * Provides unified message passing between extension components
 */

import { MESSAGE_TYPES } from './constants.js';

class MessageService {
    constructor() {
        this.handlers = new Map();
        this.pendingResponses = new Map();
        this.messageListener = this.handleMessage.bind(this);
        this.setupMessageListener();
        this.setupCleanupInterval();
    }

    /**
     * Set up Chrome runtime message listener
     * @private
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener(this.messageListener);
    }

    /**
     * Set up cleanup interval for pending responses
     * @private
     */
    setupCleanupInterval() {
        // Clean up pending responses older than 30 seconds
        setInterval(() => {
            const now = Date.now();
            for (const [id, data] of this.pendingResponses) {
                if (now - data.timestamp > 30000) {
                    this.pendingResponses.delete(id);
                }
            }
        }, 10000);
    }

    /**
     * Clean up resources
     */
    destroy() {
        chrome.runtime.onMessage.removeListener(this.messageListener);
        this.handlers.clear();
        this.pendingResponses.clear();
    }

    /**
     * Register a message handler
     * @param {string} type - Message type to handle
     * @param {Function} handler - Handler function
     */
    registerHandler(type, handler) {
        if (!Object.values(MESSAGE_TYPES).includes(type)) {
            throw new Error(`Invalid message type: ${type}`);
        }
        this.handlers.set(type, handler);
    }

    /**
     * Remove a message handler
     * @param {string} type - Message type to remove handler for
     */
    removeHandler(type) {
        this.handlers.delete(type);
    }

    /**
     * Handle incoming message
     * @private
     * @param {Object} message - Message object
     * @param {Object} sender - Message sender
     * @param {Function} sendResponse - Response callback
     */
    async handleMessage(message, sender, sendResponse) {
        try {
            if (!message || !message.type) {
                throw new Error('Invalid message format');
            }

            const handler = this.handlers.get(message.type);
            if (!handler) {
                throw new Error(`No handler registered for message type: ${message.type}`);
            }

            const response = await handler(message.data, sender);
            sendResponse({ success: true, data: response });
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ 
                success: false, 
                error: error.message || 'Unknown error'
            });
        }
    }

    /**
     * Send a message to extension component
     * @param {string} type - Message type
     * @param {*} data - Message data
     * @returns {Promise} Response from receiver
     */
    async sendMessage(type, data = {}) {
        try {
            const response = await chrome.runtime.sendMessage({
                type,
                data
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Message failed');
            }
            
            return response.data;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Send a message to a specific tab
     * @param {number} tabId - ID of tab to send to
     * @param {string} type - Message type
     * @param {*} data - Message data
     * @returns {Promise} Response from receiver
     */
    async sendTabMessage(tabId, type, data = {}) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                type,
                data
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Message failed');
            }
            
            return response.data;
        } catch (error) {
            console.error('Error sending tab message:', error);
            throw error;
        }
    }

    /**
     * Broadcast a message to all tabs
     * @param {string} type - Message type
     * @param {*} data - Message data
     * @returns {Promise<Array>} Array of responses
     */
    async broadcastMessage(type, data = {}) {
        try {
            const tabs = await chrome.tabs.query({});
            const responses = await Promise.all(
                tabs.map(tab => this.sendTabMessage(tab.id, type, data))
            );
            return responses;
        } catch (error) {
            console.error('Error broadcasting message:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const messageService = new MessageService();