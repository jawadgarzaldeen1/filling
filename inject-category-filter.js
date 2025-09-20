(function () {
    const targetUrls = [
        "https://www.allstatesusadirectory.com/submit.php",
        "https://www.hitwebdirectory.com/submit.php"
    ];

    if (!targetUrls.includes(window.location.href)) return;

    const select = document.querySelector("select[name='CATEGORY_ID']");
    if (!select) return;

    const parent = select.parentNode;
    const searchInput = document.createElement("input");

    // Enhanced styling
    searchInput.placeholder = "Search categories...";
    searchInput.style.cssText = `
        margin-bottom: 5px;
        display: block;
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
    `;

    const originalOptions = Array.from(select.options);

    // Debounced search for better performance
    let searchTimeout;
    searchInput.addEventListener("input", function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = this.value.toLowerCase().trim();
            
            // Clear and rebuild options
            select.innerHTML = "";
            
            if (query === "") {
                // Show all options if search is empty
                originalOptions.forEach(opt => select.appendChild(opt.cloneNode(true)));
            } else {
                // Filter options
                originalOptions.forEach(opt => {
                    if (opt.text.toLowerCase().includes(query) || opt.value === "0") {
                        select.appendChild(opt.cloneNode(true));
                    }
                });
            }
            
            // Trigger change event for any listeners
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }, 150); // 150ms debounce
    });

    // Add focus styles
    searchInput.addEventListener('focus', function() {
        this.style.borderColor = '#4A6FFF';
        this.style.boxShadow = '0 0 0 2px rgba(74, 111, 255, 0.2)';
    });

    searchInput.addEventListener('blur', function() {
        this.style.borderColor = '#ddd';
        this.style.boxShadow = 'none';
    });

    parent.insertBefore(searchInput, select);
    
    // Add a small indicator that the search was added
    console.log('[CategoryFilter] Search functionality added to category dropdown');
})();
