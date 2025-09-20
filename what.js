function addLinkField() {
    const selector = document.getElementById('serviceSelector');
    if (!selector || selector.value === 'custom') {
        showStatus('Please select a service first', 'error');
        return;
    }

    const service = selector.value;
    const container = document.getElementById('fieldsContainer');
    if (!container) return;

    // Check if field already exists
    if (document.querySelector(`#fieldsContainer input[data-service="${service}"]`)) {
        showStatus('This service already has a field', 'error');
        return;
    }

    const div = document.createElement('div');
    div.className = 'field-item';

    // Generate unique ID for the input to associate with label
    const inputId = `service-input-${service}`;

    div.innerHTML = `
        <label for="${inputId}">
            ${service.charAt(0).toUpperCase() + service.slice(1)}:
        </label>
        <input
            type="url"
            id="${inputId}"
            data-service="${service}"
            placeholder="${service}"
        >
    `;

    container.appendChild(div);

    // Focus the newly added field
    document.getElementById(inputId)?.focus();
}