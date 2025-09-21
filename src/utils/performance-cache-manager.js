/**
 * Performance and Cache Manager for Social Filler Pro Extension
 * 
 * Provides caching, performance monitoring, and optimization features
 * 
 * @version 7.1
 * @author Social Filler Pro Team
 */

'use strict';

class PerformanceCacheManager {
    constructor(logger, options = {}) {
        this.logger = logger;
        this.options = {
            maxCacheSize: options.maxCacheSize || 100,
            cacheExpiry: options.cacheExpiry || 300000, // 5 minutes
            enableMetrics: options.enableMetrics || true,
            ...options
        };
        
        this.cache = new Map();
        this.metrics = new Map();
        this.domQueryCache = new Map();
        this.debouncedOperations = new Map();
        this.throttledOperations = new Map();
        
        this.initialize();
    }

    /**
     * Initialize cache manager
     */
    initialize() {
        this.setupCacheCleanup();
        this.setupPerformanceMonitoring();
        this.logger.debug('Performance cache manager initialized');
    }

    /**
     * Setup automatic cache cleanup
     */
    setupCacheCleanup() {
        setInterval(() => {
            this.cleanExpiredCache();
        }, 60000); // Clean every minute
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        if (!this.options.enableMetrics) return;

        // Monitor extension performance
        this.startMetric('extensionLifetime');
        
        // Log periodic performance stats
        setInterval(() => {
            this.logPerformanceStats();
        }, 300000); // Every 5 minutes
    }

    /**
     * Generic cache get/set with automatic expiry
     */
    cache_get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        item.hits++;
        return item.data;
    }

    cache_set(key, data, customExpiry = null) {
        const expiry = customExpiry || (Date.now() + this.options.cacheExpiry);
        
        // Check cache size limit
        if (this.cache.size >= this.options.maxCacheSize) {
            this.evictOldestCache();
        }

        this.cache.set(key, {
            data,
            expiry,
            hits: 0,
            created: Date.now()
        });

        this.logger.debug(`Cached item: ${key}`);
    }

    /**
     * Cached DOM query selector
     */
    cachedQuerySelector(selector, context = document, cacheTime = 5000) {
        const cacheKey = `dom_${selector}_${context === document ? 'document' : context.tagName}`;
        
        // Check cache first
        let cached = this.domQueryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheTime) {
            return cached.elements;
        }

        // Query and cache result
        const elements = context.querySelectorAll(selector);
        this.domQueryCache.set(cacheKey, {
            elements: Array.from(elements),
            timestamp: Date.now()
        });

        // Limit DOM cache size
        if (this.domQueryCache.size > 50) {
            const oldestKey = Array.from(this.domQueryCache.keys())[0];
            this.domQueryCache.delete(oldestKey);
        }

        return Array.from(elements);
    }

    /**
     * Cached single element query
     */
    cachedQueryElement(selector, context = document, cacheTime = 5000) {
        const elements = this.cachedQuerySelector(selector, context, cacheTime);
        return elements.length > 0 ? elements[0] : null;
    }

    /**
     * Debounced operation wrapper
     */
    debounce(key, func, delay = 300) {
        if (this.debouncedOperations.has(key)) {
            clearTimeout(this.debouncedOperations.get(key));
        }

        const timeoutId = setTimeout(() => {
            func();
            this.debouncedOperations.delete(key);
        }, delay);

        this.debouncedOperations.set(key, timeoutId);
    }

    /**
     * Throttled operation wrapper
     */
    throttle(key, func, delay = 1000) {
        const now = Date.now();
        const lastCall = this.throttledOperations.get(key) || 0;

        if (now - lastCall >= delay) {
            this.throttledOperations.set(key, now);
            return func();
        }

        return Promise.resolve(null);
    }

    /**
     * Batch DOM operations for better performance
     */
    batchDOMOperations(operations) {
        return new Promise((resolve) => {
            // Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
                const results = operations.map(op => {
                    try {
                        return op();
                    } catch (error) {
                        this.logger.error('Batch DOM operation failed:', error);
                        return null;
                    }
                });
                resolve(results);
            });
        });
    }

    /**
     * Optimized field filling with batching
     */
    async batchFillFields(fields, data) {
        if (!fields || fields.length === 0) return [];

        const fillOperations = fields.map(field => {
            return () => {
                try {
                    const fieldType = field.dataset?.fieldType || 'unknown';
                    const value = data[fieldType];
                    
                    if (value && field.value !== value) {
                        // Use optimized filling method
                        this.optimizedFieldFill(field, value);
                        return { field: fieldType, success: true };
                    }
                    return { field: fieldType, success: false, reason: 'no_value' };
                } catch (error) {
                    return { field: field.dataset?.fieldType || 'unknown', success: false, error: error.message };
                }
            };
        });

        return await this.batchDOMOperations(fillOperations);
    }

    /**
     * Optimized field filling method
     */
    optimizedFieldFill(field, value) {
        // Batch property changes
        field.focus();
        field.value = value;
        
        // Dispatch events in a batch
        const events = ['input', 'change', 'blur'];
        events.forEach(eventType => {
            field.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
    }

    /**
     * Performance metric tracking
     */
    startMetric(name) {
        if (!this.options.enableMetrics) return;

        this.metrics.set(name, {
            start: performance.now(),
            end: null,
            duration: null
        });
    }

    endMetric(name) {
        if (!this.options.enableMetrics) return;

        const metric = this.metrics.get(name);
        if (metric) {
            metric.end = performance.now();
            metric.duration = metric.end - metric.start;
            this.logger.debug(`Metric ${name}: ${metric.duration.toFixed(2)}ms`);
        }
    }

    /**
     * Memory usage monitoring
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(performance.memory.totalJSHeapSize / 1048576),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
            };
        }
        return null;
    }

    /**
     * Storage usage monitoring
     */
    async getStorageUsage() {
        try {
            const data = await chrome.storage.sync.get();
            const size = JSON.stringify(data).length;
            const quotaBytes = chrome.storage.sync.QUOTA_BYTES || 102400;
            
            return {
                used: size,
                total: quotaBytes,
                percentage: Math.round((size / quotaBytes) * 100)
            };
        } catch (error) {
            this.logger.error('Failed to get storage usage:', error);
            return null;
        }
    }

    /**
     * Clean expired cache entries
     */
    cleanExpiredCache() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        // Clean DOM query cache
        for (const [key, item] of this.domQueryCache.entries()) {
            if (now - item.timestamp > 30000) { // 30 seconds for DOM cache
                this.domQueryCache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
        }
    }

    /**
     * Evict oldest cache entry when at capacity
     */
    evictOldestCache() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, item] of this.cache.entries()) {
            if (item.created < oldestTime) {
                oldestTime = item.created;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.logger.debug(`Evicted oldest cache entry: ${oldestKey}`);
        }
    }

    /**
     * Log performance statistics
     */
    logPerformanceStats() {
        const cacheStats = {
            size: this.cache.size,
            domCacheSize: this.domQueryCache.size,
            hitRate: this.calculateHitRate()
        };

        const memoryUsage = this.getMemoryUsage();
        
        this.logger.info('Performance Stats:', {
            cache: cacheStats,
            memory: memoryUsage,
            activeDebounced: this.debouncedOperations.size,
            activeThrottled: this.throttledOperations.size
        });
    }

    /**
     * Calculate cache hit rate
     */
    calculateHitRate() {
        let totalHits = 0;
        let totalEntries = this.cache.size;

        for (const item of this.cache.values()) {
            totalHits += item.hits;
        }

        return totalEntries > 0 ? Math.round((totalHits / totalEntries) * 100) : 0;
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.cache.clear();
        this.domQueryCache.clear();
        this.metrics.clear();
        this.logger.debug('All caches cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            mainCache: {
                size: this.cache.size,
                maxSize: this.options.maxCacheSize,
                hitRate: this.calculateHitRate()
            },
            domCache: {
                size: this.domQueryCache.size,
                maxSize: 50
            },
            operations: {
                debouncedActive: this.debouncedOperations.size,
                throttledActive: this.throttledOperations.size
            }
        };
    }

    /**
     * Optimize storage operations
     */
    async optimizeStorageOperation(operation, cacheKey, ttl = 60000) {
        const cached = this.cache_get(cacheKey);
        if (cached) {
            return cached;
        }

        const result = await operation();
        this.cache_set(cacheKey, result, Date.now() + ttl);
        return result;
    }

    /**
     * Lazy loading helper for expensive operations
     */
    createLazyLoader(loader, cacheKey) {
        let loading = false;
        let loaded = false;

        return async () => {
            if (loaded) {
                return this.cache_get(cacheKey);
            }

            if (loading) {
                // Wait for current loading to complete
                while (loading) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                return this.cache_get(cacheKey);
            }

            loading = true;
            try {
                const result = await loader();
                this.cache_set(cacheKey, result);
                loaded = true;
                return result;
            } finally {
                loading = false;
            }
        };
    }

    /**
     * Cleanup resources on extension unload
     */
    cleanup() {
        // Clear all timeouts
        for (const timeoutId of this.debouncedOperations.values()) {
            clearTimeout(timeoutId);
        }

        // Clear all caches
        this.clearAllCaches();

        // Clear operation maps
        this.debouncedOperations.clear();
        this.throttledOperations.clear();

        this.logger.debug('Performance cache manager cleaned up');
    }
}

// Export for use in other modules
window.PerformanceCacheManager = PerformanceCacheManager;