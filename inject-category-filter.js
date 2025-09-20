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

    searchInput.placeholder = "Search categories...";
    searchInput.style.marginBottom = "5px";
    searchInput.style.display = "block";

    const originalOptions = Array.from(select.options);

    searchInput.addEventListener("input", function () {
        const query = this.value.toLowerCase();
        select.innerHTML = "";
        originalOptions.forEach(opt => {
            if (opt.text.toLowerCase().includes(query) || opt.value === "0") {
                select.appendChild(opt);
            }
        });
    });

    parent.insertBefore(searchInput, select);
})();
