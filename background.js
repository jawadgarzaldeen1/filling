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
    }
});

// Simplified message handling with a single listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Message received:', message);

    if (message.type === "GET_SERVICES") {
        chrome.storage.sync.get('services', (result) => {
             if (chrome.runtime.lastError) {
                 log('Error getting services:', chrome.runtime.lastError);
                 sendResponse({ services: defaultServices }); // Send defaults on error
             } else {
                // If services are undefined/null in storage, return defaults
                sendResponse({ services: result.services || defaultServices });
             }
        });
        return true; // Keeps the sendResponse function alive for async response
    }
    // Handler to reset services to their default values
    else if (message.type === "RESET_SERVICES_TO_DEFAULT") {
        chrome.storage.sync.set({ services: defaultServices , fillPassword: "" }, () => {
             if (chrome.runtime.lastError) {
                 log('Error resetting services:', chrome.runtime.lastError);
                 sendResponse({ success: false, error: chrome.runtime.lastError.message });
             } else {
                log('Services reset to default');
                sendResponse({ success: true });
                // Notify content scripts that services changed
                chrome.tabs.query({}, tabs => {
                    tabs.forEach(tab => {
                        if (tab.id) {
                             chrome.tabs.sendMessage(tab.id, {
                                type: 'SERVICES_UPDATED',
                                message: 'Services configuration reset to default'
                            }).catch(err => log(`Failed to send SERVICES_UPDATED to tab ${tab.id}:`, err));
                        }
                    });
                });
            }
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

chrome.storage.onChanged.addListener((changes, area) => {
    log(`Storage changed (${area}):`, changes);
    
    // Notify tabs when services are updated
    if (area === 'sync' && changes.services) {
        chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
                 if (tab.id) { // Ensure tab.id exists
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'SERVICES_UPDATED',
                        message: 'Services configuration updated'
                    }).catch(err => log(`Failed to send SERVICES_UPDATED to tab ${tab.id} on change:`, err));
                 }
            });
        });
    }
});

log("Background worker initialized");