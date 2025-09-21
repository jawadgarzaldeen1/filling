/**
 * Unified Location Management System
 * @version 1.0
 */

class LocationManager {
    constructor() {
        this.sources = new Map();
        this.currentLocation = null;
        this.listeners = new Set();
    }

    /**
     * Register a location data source
     */
    registerSource(name, source) {
        this.sources.set(name, source);
        return this;
    }

    /**
     * Update location from all available sources
     */
    async updateLocation() {
        const locationData = {};
        const sourcePromises = [];

        // Try all registered sources
        for (const [name, source] of this.sources) {
            try {
                sourcePromises.push(
                    source.getLocation().then(data => {
                        if (data && this.isValidLocation(data)) {
                            Object.assign(locationData, data);
                            console.log(`Location data from ${name}:`, data);
                        }
                    }).catch(error => {
                        console.warn(`Location source ${name} failed:`, error);
                    })
                );
            } catch (error) {
                console.warn(`Location source ${name} error:`, error);
            }
        }

        // Wait for all sources to complete
        await Promise.allSettled(sourcePromises);

        // Fallback to manual input if no location data
        if (Object.keys(locationData).length === 0) {
            const manualData = await this.getManualLocation();
            Object.assign(locationData, manualData);
        }

        // Update current location and notify listeners
        this.currentLocation = locationData;
        this.notifyListeners(locationData);

        return locationData;
    }

    /**
     * Check if location data is valid
     */
    isValidLocation(locationData) {
        return Object.values(locationData).some(value => 
            value && typeof value === 'string' && value.trim().length > 0
        );
    }

    /**
     * Get location from manual input fields
     */
    async getManualLocation() {
        const locationData = {};
        const fields = ['countryValue', 'regionValue', 'cityValue', 'addressValue'];

        for (const fieldId of fields) {
            const element = document.getElementById(fieldId);
            if (element && element.value.trim()) {
                const key = fieldId.replace('Value', '');
                locationData[key] = element.value.trim();
            }
        }

        return locationData;
    }

    /**
     * Get location from storage
     */
    async getStoredLocation() {
        try {
            const result = await chrome.storage.sync.get('selectedLocation');
            return result.selectedLocation || {};
        } catch (error) {
            console.error('Error loading stored location:', error);
            return {};
        }
    }

    /**
     * Get location from HTML5 Geolocation API
     */
    async getGeolocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({});
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        source: 'geolocation'
                    });
                },
                (error) => {
                    console.warn('Geolocation error:', error);
                    resolve({});
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 300000
                }
            );
        });
    }

    /**
     * Get location from IP address
     */
    async getIPLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) throw new Error('IP location failed');
            
            const data = await response.json();
            return {
                country: data.country_name,
                country_code: data.country_code,
                region: data.region,
                city: data.city,
                latitude: data.latitude,
                longitude: data.longitude,
                source: 'ipapi'
            };
        } catch (error) {
            console.warn('IP location failed:', error);
            return {};
        }
    }

    /**
     * Add change listener
     */
    addListener(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of location changes
     */
    notifyListeners(locationData) {
        this.listeners.forEach(listener => {
            try {
                listener(locationData);
            } catch (error) {
                console.error('Location listener error:', error);
            }
        });
    }

    /**
     * Save location to storage
     */
    async saveLocation(locationData) {
        try {
            await chrome.storage.sync.set({
                selectedLocation: locationData
            });
            this.currentLocation = locationData;
            this.notifyListeners(locationData);
            return true;
        } catch (error) {
            console.error('Error saving location:', error);
            return false;
        }
    }

    /**
     * Initialize location manager with default sources
     */
    initialize() {
        // Register default location sources
        this.registerSource('storage', {
            getLocation: () => this.getStoredLocation()
        });

        this.registerSource('manual', {
            getLocation: () => this.getManualLocation()
        });

        this.registerSource('geolocation', {
            getLocation: () => this.getGeolocation()
        });

        this.registerSource('ip', {
            getLocation: () => this.getIPLocation()
        });

        console.log('Location Manager initialized with', this.sources.size, 'sources');
        return this;
    }
}

// Initialize singleton instance
window.LocationManager = new LocationManager().initialize();

// Integrate with existing content script
if (window.contentScript) {
    window.contentScript.locationManager = window.LocationManager;
}