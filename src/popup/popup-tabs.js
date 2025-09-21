// src/popup/popup-tabs.js

export function initializeTabs() {
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("tab")) {
            const tabId = e.target.dataset.tab;
            if (!tabId) return;

            // Switch active tab button
            document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
            e.target.classList.add("active");

            // Switch active tab content
            document.querySelectorAll(".tab-content").forEach((c) => {
                c.classList.remove("active");
                if (c.id === "tab-" + tabId) {
                    c.classList.add('active');
                }
            });
        }
    });
}
