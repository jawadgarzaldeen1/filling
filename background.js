const log = (...args) => {
    console.log(`[BG][${new Date().toLocaleTimeString()}]`, ...args);
};

// Default services configuration
const defaultServices = {
    twitter: {
        keywords: ['twitter', 'x.com', 'tweet', 'handle', '/@'],
        patterns: [
            { source: '(https?:\\/\\/)?(www\\.)?twitter\\.com\\/[a-z0-9_]{1,15}\\/?', flags: 'i' },
            { source: '(https?:\\/\\/)?(www\\.)?x\\.com\\/[a-z0-9_]{1,15}\\/?', flags: 'i' }
        ],
        exclude: ['bird', 'logo', 'button', 'widget'],
        weight: 1.5
    },
    facebook: {
        keywords: ['facebook', 'fb.me', 'fb.com', 'fb profile'],
        patterns: [{ source: 'facebook\\.com\\/[^/]+', flags: 'i' }],
        exclude: ['like', 'share', 'button'],
        weight: 1.2
    },
    linkedin: {
        keywords: ['linkedin', 'li.com', 'lnkd.in', 'professional profile'],
        patterns: [{ source: 'linkedin\\.com\\/in\\/[^/]+', flags: 'i' }],
        exclude: ['connect', 'share'],
        weight: 1.2
    },
    instagram: {
        keywords: ['instagram', 'ig', 'instagr.am', 'insta'],
        patterns: [{ source: 'instagram\\.com\\/[^/]+', flags: 'i' }],
        exclude: ['follow', 'button'],
        weight: 1.0
    },
    website: {
        keywords: ['website', 'websi.te', 'homepage', 'site', 'url'],
        patterns: [{ source: 'https?:\\/\\/[^/]+\\.[a-z]+', flags: 'i' }],
        exclude: ['visit', 'click'],
        weight: 0.8
    },
    youtube: {
        keywords: ['youtube', 'you.tube', 'yt', 'channel'],
        patterns: [{ source: 'youtube\\.com\\/(@[^/]+|channel\\/[^/]+|c\\/[^/]+)', flags: 'i' }],
        exclude: ['subscribe', 'video'],
        weight: 1.0
    },
    pinterest: {
        keywords: ['pinterest', 'pin', 'pins'],
        patterns: [{ source: 'pinterest\\.com\\/[^/]+', flags: 'i' }],
        exclude: ['save', 'board'],
        weight: 0.8
    },
    tiktok: {
        keywords: ['tiktok', 'tt', 'tiktok profile'],
        patterns: [{ source: 'tiktok\\.com\\/@[^/]+', flags: 'i' }],
        exclude: ['follow', 'trending'],
        weight: 1.0
    }
};

// Initialize services in storage if not exists
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const { services } = await chrome.storage.sync.get('services');
        if (!services) {
            await chrome.storage.sync.set({ services: defaultServices });
            log('Default services initialized');
        } else {
            // Merge existing services with defaults (for updates)
            const updatedServices = { ...defaultServices };
            Object.entries(services).forEach(([name, config]) => {
                if (defaultServices[name]) {
                    // Keep custom patterns and keywords, but ensure proper format
                    updatedServices[name] = {
                        ...defaultServices[name],
                        patterns: config.patterns?.map(p => ({
                            source: p.source || p.toString(),
                            flags: p.flags || 'i'
                        })) || defaultServices[name].patterns,
                        keywords: [...new Set([
                            ...(config.keywords || []),
                            ...defaultServices[name].keywords
                        ])],
                        exclude: [...new Set([
                            ...(config.exclude || []),
                            ...defaultServices[name].exclude
                        ])],
                        weight: config.weight || defaultServices[name].weight
                    };
                } else {
                    // Keep custom services
                    updatedServices[name] = config;
                }
            });
            await chrome.storage.sync.set({ services: updatedServices });
            log('Services configuration updated');
        }
    } catch (error) {
        log('Error initializing services:', error);
        // Fallback: set default services if there's an error
        try {
            await chrome.storage.sync.set({ services: defaultServices });
            log('Fallback: Default services set due to error');
        } catch (fallbackError) {
            log('Critical error: Could not set default services:', fallbackError);
        }
    }
});

// Optimized message handling with better error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Message received:', message.type);

    const handleAsyncResponse = async (handler) => {
        try {
            const result = await handler();
            sendResponse(result);
        } catch (error) {
            log('Error in message handler:', error);
            sendResponse({ success: false, error: error.message });
        }
    };

    if (message.type === "GET_SERVICES") {
        handleAsyncResponse(async () => {
            const result = await chrome.storage.sync.get('services');
            return { services: result.services || defaultServices };
        });
        return true; // Keeps the sendResponse function alive for async response
    }
    
    if (message.type === "RESET_SERVICES_TO_DEFAULT") {
        handleAsyncResponse(async () => {
            await chrome.storage.sync.set({ services: defaultServices, fillPassword: "" });
            log('Services reset to default');
            
            // Notify content scripts that services changed
            const tabs = await chrome.tabs.query({});
            const notifications = tabs.map(tab => {
                if (tab.id) {
                    return chrome.tabs.sendMessage(tab.id, {
                        type: 'SERVICES_UPDATED',
                        message: 'Services configuration reset to default'
                    }).catch(err => log(`Failed to send SERVICES_UPDATED to tab ${tab.id}:`, err));
                }
            });
            await Promise.allSettled(notifications);
            
            return { success: true };
        });
        return true; // Keep connection open for async response
    }

    // Return false for other message types that aren't handled or are synchronous
    return false;
});

// Context invalidation notifier
chrome.runtime.onSuspend.addListener(() => {
    log('Extension suspending - notifying tabs');
    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            if (tab.id) { // Check that tab.id exists before sending
                chrome.tabs.sendMessage(tab.id, { 
                    type: 'CONTEXT_INVALID',
                    message: 'Extension updated - please reload page' 
                }).catch(() => {}); // Catch any errors but don't log them (expected for inactive tabs)
            }
        });
    });
});

chrome.storage.onChanged.addListener(async (changes, area) => {
    log(`Storage changed (${area}):`, Object.keys(changes));
    
    // Notify tabs when services are updated
    if (area === 'sync' && changes.services) {
        try {
            const tabs = await chrome.tabs.query({});
            const notifications = tabs.map(tab => {
                if (tab.id) {
                    return chrome.tabs.sendMessage(tab.id, {
                        type: 'SERVICES_UPDATED',
                        message: 'Services configuration updated'
                    }).catch(err => log(`Failed to send SERVICES_UPDATED to tab ${tab.id} on change:`, err));
                }
            });
            await Promise.allSettled(notifications);
        } catch (error) {
            log('Error notifying tabs of services update:', error);
        }
    }
});

log("Background worker initialized");