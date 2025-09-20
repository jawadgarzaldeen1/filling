(function () {
    const targetUrls = [
        "https://www.allstatesusadirectory.com/submit.php",
        "https://www.hitwebdirectory.com/submit.php"
    ];

    // Check if we're on a target URL or if there's a category dropdown
    const isTargetUrl = targetUrls.includes(window.location.href);
    const categorySelect = document.querySelector("select[name='CATEGORY_ID']") || 
                          document.querySelector("select[name='catId']") ||
                          document.querySelector("select[id='catId']");
    
    if (!isTargetUrl && !categorySelect) return;
    
    const select = categorySelect;
    if (!select) return;

    const parent = select.parentNode;
    const searchInput = document.createElement("input");

    // Enhanced styling with better positioning
    searchInput.placeholder = "🔍 Search categories...";
    searchInput.style.cssText = `
        margin-bottom: 8px;
        display: block;
        width: 100%;
        padding: 10px 12px;
        border: 2px solid #e1e5e9;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
        background: #f8f9fa;
        transition: all 0.2s ease;
        position: relative;
        z-index: 1000;
    `;

    // Store original structure for restoration
    const originalHTML = select.innerHTML;

    // Enhanced search functionality for complex dropdowns with optgroups
    let searchTimeout;
    searchInput.addEventListener("input", function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = this.value.toLowerCase().trim();
            
            // Clear and rebuild options
            select.innerHTML = "";
            
            if (query === "") {
                // Show all options if search is empty
                select.innerHTML = originalHTML;
            } else {
                // Create a temporary container to parse the original HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = originalHTML;
                const tempSelect = tempDiv.querySelector('select') || tempDiv;
                
                // Handle optgroups and regular options
                const optgroups = tempSelect.querySelectorAll('optgroup');
                const regularOptions = Array.from(tempSelect.children).filter(child => 
                    child.tagName === 'OPTION' && !child.closest('optgroup')
                );
                
                // Process optgroups
                optgroups.forEach(optgroup => {
                    const matchingOptions = Array.from(optgroup.options).filter(opt => 
                        opt.text.toLowerCase().includes(query) || 
                        opt.value === "" || 
                        opt.value === "0"
                    );
                    
                    if (matchingOptions.length > 0) {
                        const newOptgroup = optgroup.cloneNode(false);
                        matchingOptions.forEach(opt => {
                            newOptgroup.appendChild(opt.cloneNode(true));
                        });
                        select.appendChild(newOptgroup);
                    }
                });
                
                // Process regular options
                regularOptions.forEach(opt => {
                    if (opt.text.toLowerCase().includes(query) || 
                        opt.value === "" || 
                        opt.value === "0") {
                        select.appendChild(opt.cloneNode(true));
                    }
                });
            }
            
            // Trigger change event for any listeners
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }, 150); // 150ms debounce
    });

    // Add focus styles and clear functionality
    searchInput.addEventListener('focus', function() {
        this.style.borderColor = '#4A6FFF';
        this.style.boxShadow = '0 0 0 3px rgba(74, 111, 255, 0.15)';
        this.style.background = '#ffffff';
    });

    searchInput.addEventListener('blur', function() {
        this.style.borderColor = '#e1e5e9';
        this.style.boxShadow = 'none';
        this.style.background = '#f8f9fa';
    });

    // Insert search input
    parent.insertBefore(searchInput, select);
    
    // Add keyboard shortcuts
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            this.value = '';
            this.dispatchEvent(new Event('input'));
            this.blur();
        }
    });
    
    // Add a small indicator that the search was added
    console.log('[CategoryFilter] Enhanced search functionality added to category dropdown');
    
    // Auto-select saved category
    autoSelectCategory(select);
    
    // Listen for category updates from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'CATEGORY_UPDATED') {
            console.log('[CategoryFilter] Category updated, re-selecting:', message.category);
            autoSelectCategory(select);
        }
    });
})();

// Function to auto-select saved category
async function autoSelectCategory(select) {
    try {
        // Get saved category from storage
        const result = await chrome.storage.sync.get('selectedCategory');
        const savedCategory = result.selectedCategory;
        
        if (!savedCategory) {
            console.log('[CategoryFilter] No saved category found');
            return;
        }
        
        console.log('[CategoryFilter] Looking for saved category:', savedCategory);
        
        // Find matching option
        const options = Array.from(select.options);
        let matchingOption = null;
        
        // First try exact match
        matchingOption = options.find(option => 
            option.text.trim() === savedCategory || 
            option.text.includes(savedCategory)
        );
        
        // If no exact match, try partial match (case insensitive)
        if (!matchingOption) {
            const lowerSaved = savedCategory.toLowerCase();
            matchingOption = options.find(option => 
                option.text.toLowerCase().includes(lowerSaved) ||
                lowerSaved.includes(option.text.toLowerCase())
            );
        }
        
        if (matchingOption) {
            select.value = matchingOption.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[CategoryFilter] Auto-selected category:', matchingOption.text);
            
            // Add visual feedback
            select.style.backgroundColor = '#E8F5E8';
            select.style.borderColor = '#4CAF50';
            setTimeout(() => {
                select.style.backgroundColor = '';
                select.style.borderColor = '';
            }, 2000);
        } else {
            console.log('[CategoryFilter] No matching option found for:', savedCategory);
        }
    } catch (error) {
        console.error('[CategoryFilter] Error auto-selecting category:', error);
    }
}
