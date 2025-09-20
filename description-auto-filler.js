// Auto-fill Description Field Manager
const DescriptionAutoFiller = {
    // Configuration for description templates
    templates: {
        business: {
            basic: "{businessName} is a professional business specializing in {keywords}. We provide high-quality services to our customers.",
            detailed: "{businessName} is a professional business specializing in {keywords}. Located in {city}, we provide high-quality services to our customers. Contact us at {phone} or visit our website at {website}.",
            withAddress: "{businessName} is a professional business specializing in {keywords}. Located at {address} in {city}, we provide high-quality services to our customers. Contact us at {phone} or visit our website at {website}."
        },
        service: {
            basic: "Professional {keywords} services provided by {businessName}. We deliver exceptional results for our clients.",
            detailed: "Professional {keywords} services provided by {businessName}. Based in {city}, we deliver exceptional results for our clients. Contact us at {phone} for more information.",
            withAddress: "Professional {keywords} services provided by {businessName}. Located at {address} in {city}, we deliver exceptional results for our clients. Contact us at {phone} for more information."
        },
        cleaning: {
            basic: "{businessName} provides professional {keywords} services. We ensure your space is clean, safe, and comfortable.",
            detailed: "{businessName} provides professional {keywords} services in {city}. We ensure your space is clean, safe, and comfortable. Call us at {phone} for a free estimate.",
            withAddress: "{businessName} provides professional {keywords} services. Located at {address} in {city}, we ensure your space is clean, safe, and comfortable. Call us at {phone} for a free estimate."
        }
    },

    // Auto-generate description based on available data
    generateDescription(formData, templateType = 'auto') {
        try {
            const data = this.prepareData(formData);
            
            if (!data.businessName && !data.keywords) {
                return null; // Not enough data to generate description
            }

            // Determine template type automatically if not specified
            if (templateType === 'auto') {
                templateType = this.detectTemplateType(data);
            }

            // Select appropriate template
            const template = this.selectTemplate(templateType, data);
            
            // Fill template with data
            const description = this.fillTemplate(template, data);
            
            return this.cleanDescription(description);
        } catch (error) {
            console.error('[DESCRIPTION] Error generating description:', error);
            return null;
        }
    },

    // Prepare and normalize data for template filling
    prepareData(formData) {
        const data = {
            businessName: formData.title || formData.company || formData.businessName || '',
            keywords: formData.keywords || '',
            city: formData.city || '',
            address: formData.address || '',
            phone: formData.phone || '',
            website: formData.website || '',
            email: formData.email || ''
        };

        // Clean and format data
        data.businessName = this.cleanText(data.businessName);
        data.keywords = this.cleanKeywords(data.keywords);
        data.city = this.cleanText(data.city);
        data.address = this.cleanText(data.address);
        data.phone = this.formatPhone(data.phone);
        data.website = this.cleanUrl(data.website);
        data.email = this.cleanText(data.email);

        return data;
    },

    // Detect the best template type based on data
    detectTemplateType(data) {
        const keywords = data.keywords.toLowerCase();
        
        if (keywords.includes('cleaning') || keywords.includes('clean')) {
            return 'cleaning';
        } else if (keywords.includes('service') || keywords.includes('services')) {
            return 'service';
        } else {
            return 'business';
        }
    },

    // Select the most appropriate template based on available data
    selectTemplate(templateType, data) {
        const templates = this.templates[templateType] || this.templates.business;
        
        // Choose template based on available data
        if (data.address && data.website) {
            return templates.withAddress || templates.detailed || templates.basic;
        } else if (data.city || data.website) {
            return templates.detailed || templates.basic;
        } else {
            return templates.basic;
        }
    },

    // Fill template with actual data
    fillTemplate(template, data) {
        let description = template;
        
        // Replace placeholders with actual data
        const placeholders = {
            '{businessName}': data.businessName,
            '{keywords}': data.keywords,
            '{city}': data.city,
            '{address}': data.address,
            '{phone}': data.phone,
            '{website}': data.website,
            '{email}': data.email
        };

        Object.entries(placeholders).forEach(([placeholder, value]) => {
            if (value) {
                description = description.replace(new RegExp(placeholder, 'g'), value);
            } else {
                // Remove placeholder and clean up surrounding text
                description = description.replace(new RegExp(`\\s*${placeholder}\\s*`, 'g'), ' ');
                description = description.replace(/\s+/g, ' ').trim();
            }
        });

        return description;
    },

    // Clean and format the final description
    cleanDescription(description) {
        return description
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .replace(/\s*,\s*,/g, ',')  // Remove double commas
            .replace(/,\s*\./g, '.')  // Fix comma before period
            .replace(/\s*\.\s*\./g, '.')  // Remove double periods
            .replace(/^\s*,\s*/, '')  // Remove leading comma
            .replace(/\s*,\s*$/, '')  // Remove trailing comma
            .trim();
    },

    // Clean text data
    cleanText(text) {
        if (!text) return '';
        return text.trim().replace(/\s+/g, ' ');
    },

    // Clean and format keywords
    cleanKeywords(keywords) {
        if (!keywords) return '';
        
        return keywords
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0)
            .join(', ');
    },

    // Format phone number
    formatPhone(phone) {
        if (!phone) return '';
        
        // Basic phone formatting
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        
        return phone; // Return original if can't format
    },

    // Clean URL
    cleanUrl(url) {
        if (!url) return '';
        
        // Remove protocol if present for display
        return url.replace(/^https?:\/\//, '');
    },

    // Auto-fill description field when source fields change
    setupAutoFill() {
        const sourceFields = [
            'universal-title', 'universal-company', 'universal-keywords',
            'universal-city', 'universal-address', 'universal-phone',
            'universal-website', 'universal-email'
        ];

        sourceFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Use debounced function to avoid too many updates
                const debouncedUpdate = this.debounce(() => {
                    this.updateDescriptionField();
                }, 500);

                field.addEventListener('input', debouncedUpdate);
                field.addEventListener('change', debouncedUpdate);
            }
        });
    },

    // Update the description field with auto-generated content
    updateDescriptionField() {
        try {
            const descriptionField = document.getElementById('universal-description');
            if (!descriptionField) return;

            // Get current form data
            const formData = this.getCurrentFormData();
            
            // Generate new description
            const newDescription = this.generateDescription(formData);
            
            if (newDescription && newDescription.length > 20) {
                // Only update if field is empty or user hasn't made significant changes
                if (this.shouldUpdateDescription(descriptionField, newDescription)) {
                    descriptionField.value = newDescription;
                    this.addVisualFeedback(descriptionField);
                }
            }
        } catch (error) {
            console.error('[DESCRIPTION] Error updating description field:', error);
        }
    },

    // Get current form data from all universal fields
    getCurrentFormData() {
        const formData = {};
        const fieldMappings = {
            'universal-title': 'title',
            'universal-company': 'company',
            'universal-keywords': 'keywords',
            'universal-city': 'city',
            'universal-address': 'address',
            'universal-phone': 'phone',
            'universal-website': 'website',
            'universal-email': 'email'
        };

        Object.entries(fieldMappings).forEach(([fieldId, dataKey]) => {
            const field = document.getElementById(fieldId);
            if (field && field.value.trim()) {
                formData[dataKey] = field.value.trim();
            }
        });

        return formData;
    },

    // Determine if description should be updated
    shouldUpdateDescription(descriptionField, newDescription) {
        const currentValue = descriptionField.value.trim();
        
        // Always update if field is empty
        if (!currentValue) return true;
        
        // Don't update if user has made significant changes (more than 50% different)
        const similarity = this.calculateSimilarity(currentValue, newDescription);
        return similarity < 0.5;
    },

    // Calculate similarity between two strings
    calculateSimilarity(str1, str2) {
        const words1 = str1.toLowerCase().split(/\s+/);
        const words2 = str2.toLowerCase().split(/\s+/);
        
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    },

    // Add visual feedback to indicate auto-fill
    addVisualFeedback(field) {
        field.style.backgroundColor = '#E8F5E8';
        field.style.borderColor = '#4CAF50';
        
        setTimeout(() => {
            field.style.backgroundColor = '';
            field.style.borderColor = '';
        }, 2000);
    },

    // Debounce function to limit update frequency
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Manual description generation (for buttons/triggers)
    generateDescriptionManually(templateType = 'auto') {
        try {
            const formData = this.getCurrentFormData();
            const description = this.generateDescription(formData, templateType);
            
            if (description) {
                const descriptionField = document.getElementById('universal-description');
                if (descriptionField) {
                    descriptionField.value = description;
                    this.addVisualFeedback(descriptionField);
                    return description;
                }
            }
            
            return null;
        } catch (error) {
            console.error('[DESCRIPTION] Error in manual generation:', error);
            return null;
        }
    },

    // Initialize the auto-fill system
    initialize() {
        try {
            this.setupAutoFill();
            console.log('[DESCRIPTION] Auto-fill system initialized');
        } catch (error) {
            console.error('[DESCRIPTION] Error initializing auto-fill system:', error);
        }
    }
};

// Make it globally available
window.DescriptionAutoFiller = DescriptionAutoFiller;
