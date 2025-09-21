/**
 * Content Script for Form Detection and Autofill
 */

import { MESSAGE_TYPES, FIELD_TYPES } from '../common/constants.js';
import { fieldMapper } from '../common/fieldMapper.js';

class ContentScript {
    constructor() {
        this.observePageChanges = this.observePageChanges.bind(this);
        this.handleMessages = this.handleMessages.bind(this);
        this.setupEventListeners();
    }

    /**
     * Initialize content script
     */
    initialize() {
        console.log('Content script initialized');
        this.scanForForms();
        this.observePageChanges();
    }

    /**
     * Setup message and DOM event listeners
     */
    setupEventListeners() {
        // Setup message handlers
        messageService.registerHandler(MESSAGE_TYPES.AUTOFILL_DATA, (data) => this.fillForm(data));
        messageService.registerHandler(MESSAGE_TYPES.PROFILE_UPDATED, () => this.scanForForms());

        // Listen for form submissions
        document.addEventListener('submit', this.handleFormSubmit.bind(this));
    }

    /**
     * Handle messages from background script
     */
    handleMessages(message, sender, sendResponse) {
        switch (message.type) {
            case MESSAGE_TYPES.AUTOFILL_DATA:
                this.fillForm(message.data);
                sendResponse({ success: true });
                break;
            
            case MESSAGE_TYPES.PROFILE_UPDATED:
                // Re-scan forms if profile data changed
                this.scanForForms();
                sendResponse({ success: true });
                break;
        }
    }

    /**
     * Scan page for forms and analyze fields
     */
    scanForForms() {
        const forms = document.getElementsByTagName('form');
        Array.from(forms).forEach(form => this.analyzeForm(form));

        // Also look for input fields outside of forms
        const inputs = document.querySelectorAll('input:not(form input)');
        if (inputs.length > 0) {
            this.analyzeFields(Array.from(inputs));
        }
    }

    /**
     * Analyze a form and its fields
     * @param {HTMLFormElement} form 
     */
    analyzeForm(form) {
        const fields = Array.from(form.elements).filter(el => {
            return el.tagName === 'INPUT' || 
                   el.tagName === 'SELECT' || 
                   el.tagName === 'TEXTAREA';
        });

        this.analyzeFields(fields, form);
    }

    /**
     * Analyze fields and send data to background script
     * @param {Array<HTMLElement>} fields 
     * @param {HTMLFormElement} form 
     */
    analyzeFields(fields, form = null) {
        const fieldData = fields.map(field => fieldMapper.mapField(field));
        
        if (fieldData.length > 0) {
            messageService.sendMessage(MESSAGE_TYPES.FORM_DETECTED, {
                fields: fieldData,
                url: window.location.href,
                formId: form ? form.id : null
            });
        }
    }

    /**
     * Fill form with provided data
     * @param {Object} data 
     */
    fillForm(data) {
        Object.entries(data).forEach(([selector, value]) => {
            const field = document.querySelector(selector);
            if (!field) return;

            // Set value based on field type
            switch (field.type) {
                case 'checkbox':
                    field.checked = value === true || value === 'true';
                    break;
                case 'radio':
                    if (field.value === value) {
                        field.checked = true;
                    }
                    break;
                case 'select-one':
                    field.value = value;
                    break;
                default:
                    field.value = value;
            }

            // Trigger events
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    /**
     * Handle form submission
     * @param {Event} event 
     */
    handleFormSubmit(event) {
        // Could be used to collect successful form submissions
        // for improving field detection
    }

    /**
     * Observe page for dynamically added forms/fields
     */
    observePageChanges() {
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            
            mutations.forEach(mutation => {
                const addedNodes = Array.from(mutation.addedNodes);
                shouldScan = addedNodes.some(node => {
                    return node.tagName === 'FORM' || 
                           node.querySelector && node.querySelector('input, select, textarea');
                });
            });

            if (shouldScan) {
                this.scanForForms();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Initialize content script
const contentScript = new ContentScript();
contentScript.initialize();