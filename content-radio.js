// Radio button enforcement for specific websites
(function () {
    const selector = 'input[type="radio"][name="productType"][value="001"]';
    let internalUpdate = false;      // stops feedback loops

    /** Ensure our target radio is present and checked */
    function enforceChoice() {
        const radio = document.querySelector(selector);
        if (radio && !radio.checked) {
            internalUpdate = true;
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            internalUpdate = false;
            console.debug('[RadioGuard] Forced selection → 001');
        }
    }

    /* 1️⃣  FIRST PASS – as soon as the DOM is parsed */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enforceChoice, { once: true });
    } else {
        enforceChoice();
    }

    /* 2️⃣  WATCH CHANGE EVENTS on the whole document (capture phase)        */
    /*     If *any* radio in the group changes and it isn't ours, fix it.    */
    document.addEventListener(
        'change',
        (e) => {
            if (internalUpdate) return;                       // ignore our own synthetic change
            const t = e.target;
            if (t.matches?.('input[type="radio"][name="productType"]') && t.value !== '001') {
                enforceChoice();
            }
        },
        true  // capture so we run before site handlers that listen in bubble phase
    );

    /* 3️⃣  MUTATION OBSERVER limited to .itemform-block nodes               */
    const observer = new MutationObserver(enforceChoice);
    document.querySelectorAll('.itemform-block').forEach((block) =>
        observer.observe(block, {
            childList: true,
            subtree: true,
            attributes: true          // catches attribute flips like `checked`
        })
    );

    /* 🔒  Clean-up when navigating away */
    window.addEventListener('beforeunload', () => observer.disconnect());
})();
