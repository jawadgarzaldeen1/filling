'use strict';

/**
 * Tab management utilities
 */
export class TabManager {
    constructor(logger) {
        this.logger = logger;
    }

    async getAllTabs() {
        try {
            const tabs = await chrome.tabs.query({});
            this.logger.debug(`Retrieved ${tabs.length} tabs`);
            return tabs;
        } catch (error) {
            this.logger.error('Failed to get tabs:', error);
            throw new Error(`Failed to retrieve tabs: ${error.message}`);
        }
    }

    async sendMessageToAllTabs(message) {
        try {
            const tabs = await this.getAllTabs();
            const notifications = tabs
                .filter(tab => tab.id)
                .map(tab => this.sendMessageToTab(tab.id, message));
            
            const results = await Promise.allSettled(notifications);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            this.logger.info(`Message sent to ${successful} tabs, ${failed} failed`);
            return { successful, failed, results };
        } catch (error) {
            this.logger.error('Failed to send message to all tabs:', error);
            throw new Error(`Failed to notify tabs: ${error.message}`);
        }
    }

    async sendMessageToTab(tabId, message) {
        try {
            await chrome.tabs.sendMessage(tabId, message);
            this.logger.debug(`Message sent to tab ${tabId}:`, message.type);
            return { tabId, success: true };
        } catch (error) {
            this.logger.debug(`Failed to send message to tab ${tabId}:`, error.message);
            return { tabId, success: false, error: error.message };
        }
    }
}