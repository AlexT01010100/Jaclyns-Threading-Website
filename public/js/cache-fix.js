/**
 * Mobile Back Button Cache Fix
 * Prevents blank pages when using browser back button on mobile devices
 * Works with iOS Safari, Chrome Mobile, and other mobile browsers
 */

(function() {
    'use strict';
    
    // Fix for mobile back button showing blank page
    // This handles the bfcache (back-forward cache) issue
    window.addEventListener('pageshow', function(event) {
        // Check if page was loaded from cache (persisted = true means bfcache was used)
        if (event.persisted) {
            console.log('Page loaded from cache, forcing reload for mobile');
            // Force reload to show fresh content
            window.location.reload();
        }
    });
    
    // Additional fix for mobile browsers that don't properly handle pageshow
    window.addEventListener('pagehide', function(event) {
        // This helps some mobile browsers understand the page shouldn't be cached
        // Do nothing here, just having this listener helps some browsers
    });
    
    // For older mobile browsers - check if page is loaded from cache on load
    window.addEventListener('load', function() {
        // Check if performance navigation type indicates back/forward navigation
        if (window.performance && window.performance.navigation) {
            if (window.performance.navigation.type === 2) {
                // Type 2 means the page was accessed by navigating into the history
                console.log('Page accessed via back/forward button, ensuring fresh load');
                window.location.reload();
            }
        }
        
        // Modern API alternative
        if (window.performance && window.performance.getEntriesByType) {
            const navEntries = window.performance.getEntriesByType('navigation');
            if (navEntries.length > 0 && navEntries[0].type === 'back_forward') {
                console.log('Back/forward navigation detected via PerformanceNavigationTiming');
                window.location.reload();
            }
        }
    });
    
    // Prevent aggressive caching on mobile
    // This creates a timestamp that forces browsers to treat each visit as unique
    if (!sessionStorage.getItem('page-view-timestamp')) {
        sessionStorage.setItem('page-view-timestamp', Date.now().toString());
    } else {
        // If timestamp exists, we're viewing a cached version
        // Update the timestamp and reload to ensure fresh content
        const lastView = parseInt(sessionStorage.getItem('page-view-timestamp'));
        const now = Date.now();
        const timeSinceLastView = now - lastView;
        
        // If it's been more than 1 second since last view, probably a back navigation
        if (timeSinceLastView > 1000) {
            sessionStorage.setItem('page-view-timestamp', now.toString());
            // Small delay to prevent reload loops
            if (!sessionStorage.getItem('reload-attempted')) {
                sessionStorage.setItem('reload-attempted', 'true');
                window.location.reload();
            }
        }
    }
    
    // Clear the reload flag shortly after page load
    setTimeout(function() {
        sessionStorage.removeItem('reload-attempted');
    }, 2000);
    
    // Unload event to help mobile browsers clear cache properly
    window.addEventListener('beforeunload', function() {
        // Remove timestamp to force fresh load on back
        sessionStorage.removeItem('page-view-timestamp');
    });
    
})();
