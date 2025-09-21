/**
 * Enhanced Google Sheets Parser with LLM Integration
 * @version 2.0
 */

class EnhancedSheetsParser {
    constructor(apiKey = null) {
        this.llmApiKey = apiKey || this.loadApiKey();
        this.llmEndpoint = 'https://api.openai.com/v1/chat/completions';
        this.cache = new Map();
    }

    /**
     * Load API key from storage
     */
    async loadApiKey() {
        try {
            const result = await chrome.storage.sync.get('llmApiKey');
            return result.llmApiKey || null;
        } catch (error) {
            console.error('Error loading API key:', error);
            return null;
        }
    }

    /**
     * Save API key to storage
     */
    async saveApiKey(apiKey) {
        try {
            await chrome.storage.sync.set({ llmApiKey: apiKey });
            this.llmApiKey = apiKey;
            return true;
        } catch (error) {
            console.error('Error saving API key:', error);
            return false;
        }
    }

    /**
     * Call LLM API for structured data extraction
     */
    async callLLMForStructuredData(unstructuredText) {
        if (!this.llmApiKey) {
            throw new Error('LLM API key not configured');
        }

        const cacheKey = `llm_${unstructuredText}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const prompt = `
        Extract structured data from the following text. Return ONLY valid JSON with this structure:
        {
          "name": string or null,
          "company": string or null,
          "email": string or null,
          "phone": string or null,
          "address": string or null,
          "city": string or null,
          "state": string or null,
          "country": string or null,
          "website": string or null,
          "social_media": { "platform": "url" } or null
        }

        Text: "${unstructuredText}"
        `;

        try {
            const response = await fetch(this.llmEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.llmApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that extracts structured data from unstructured text. Always return valid JSON.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                throw new Error(`LLM API error: ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in LLM response');
            }

            const structuredData = JSON.parse(jsonMatch[0]);
            this.cache.set(cacheKey, structuredData);
            
            return structuredData;

        } catch (error) {
            console.error('LLM API call failed:', error);
            // Fallback to traditional parsing
            return this.fallbackParse(unstructuredText);
        }
    }

    /**
     * Fallback parsing without LLM
     */
    fallbackParse(text) {
        const patterns = [
            // Name patterns
            { pattern: /(?:^|\s)([A-Z][a-z]+ [A-Z][a-z]+)(?=\s|$)/, field: 'name' },
            { pattern: /(?:contact|name)[:\s]*([^\n,]+)/i, field: 'name' },
            
            // Company patterns
            { pattern: /(?:company|firm|inc|llc)[:\s]*([^\n,]+)/i, field: 'company' },
            { pattern: /at ([A-Z][a-zA-Z0-9&. ]+)(?=\s|$)/, field: 'company' },
            
            // Email patterns
            { pattern: /([^\s@]+@[^\s@]+\.[^\s@]+)/, field: 'email' },
            
            // Phone patterns
            { pattern: /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/, field: 'phone' },
            
            // Location patterns
            { pattern: /in ([A-Z][a-zA-Z\s,]+)(?=\s|$)/, field: 'city' },
            { pattern: /, ([A-Z]{2})(?=\s|$)/, field: 'state' }
        ];

        const result = {
            name: null,
            company: null,
            email: null,
            phone: null,
            address: null,
            city: null,
            state: null,
            country: null,
            website: null,
            social_media: null
        };

        patterns.forEach(({ pattern, field }) => {
            const match = text.match(pattern);
            if (match && match[1]) {
                result[field] = match[1].trim();
            }
        });

        return result;
    }

    /**
     * Enhanced Google Sheets data parsing with LLM
     */
    async parseGoogleSheetsData(rawData, useLLM = true) {
        const lines = rawData.split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const parsedData = {
            universalFormData: {},
            socialLinks: {},
            metadata: {
                extractionMethod: useLLM ? 'llm' : 'traditional',
                processedLines: lines.length
            },
            confidence: {}
        };

        for (const line of lines) {
            if (useLLM && this.llmApiKey) {
                try {
                    const structuredData = await this.callLLMForStructuredData(line);
                    this.mergeStructuredData(parsedData, structuredData);
                } catch (error) {
                    console.warn('LLM parsing failed for line, falling back:', line, error);
                    const fallbackData = this.fallbackParse(line);
                    this.mergeStructuredData(parsedData, fallbackData);
                }
            } else {
                const fallbackData = this.fallbackParse(line);
                this.mergeStructuredData(parsedData, fallbackData);
            }
        }

        return parsedData;
    }

    /**
     * Merge structured data into parsed results
     */
    mergeStructuredData(parsedData, structuredData) {
        // Merge universal form data
        Object.entries(structuredData).forEach(([key, value]) => {
            if (value && key !== 'social_media') {
                parsedData.universalFormData[key] = value;
                parsedData.confidence[key] = 0.9; // High confidence for LLM data
            }
        });

        // Merge social media
        if (structuredData.social_media) {
            Object.assign(parsedData.socialLinks, structuredData.social_media);
        }
    }

    /**
     * Initialize LLM settings in the popup
     */
    initializePopupIntegration() {
        document.addEventListener('DOMContentLoaded', () => {
            // Add LLM API key input to settings
            this.addLLMSettingsToPopup();
        });
    }

    /**
     * Add LLM settings to popup UI
     */
    addLLMSettingsToPopup() {
        const settingsSection = document.querySelector('.settings-section');
        if (settingsSection) {
            const llmHtml = `
                <div class="form-group">
                    <label for="llmApiKey">LLM API Key (OpenAI)</label>
                    <input type="password" id="llmApiKey" placeholder="sk-...">
                    <div class="help-text">API key for AI-powered data extraction</div>
                </div>
                <div class="form-group">
                    <label for="useLLM">Use AI Extraction</label>
                    <input type="checkbox" id="useLLM" checked>
                    <div class="help-text">Enable AI-powered data extraction from Google Sheets</div>
                </div>
            `;
            settingsSection.insertAdjacentHTML('beforeend', llmHtml);
        }
    }
}

// Initialize and export
window.EnhancedSheetsParser = new EnhancedSheetsParser();