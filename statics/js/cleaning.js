// statics/js/cleaning.js

function applyClean(action) {
    if (!window.currentData) return;

    let payload = { action: action, rows: window.currentData.rows };

    if (action === 'missing') {
        payload.column = document.getElementById('missing-column').value;
        payload.method = document.getElementById('missing-method').value;
        payload.custom_value = document.getElementById('custom-value').value;
    } else if (action === 'duplicates') {
        payload.keep = document.getElementById('duplicate-keep').value;
    } else if (action === 'dtype') {
        payload.column = document.getElementById('dtype-column').value;
        payload.target = document.getElementById('dtype-target').value;
    } else if (action === 'format') {
        payload.column = document.getElementById('format-column').value;
        payload.method = document.getElementById('format-method').value;
    } else if (action === 'filter') {
        payload.column = document.getElementById('filter-column').value;
        payload.condition = document.getElementById('filter-condition').value;
        payload.value = document.getElementById('filter-value').value;
    }

    fetch('/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        window.currentData = data;
        if (typeof displayTable === 'function') {
            displayTable(data.columns, data.rows, data.total_rows);
        }
        addToLog(data.message);
        showModal(data.message, data);
    })
    .catch(err => console.error('Clean error:', err));
}

function addToLog(message) {
    const logSection = document.getElementById('cleaning-log');
    const logList = document.getElementById('cleaning-log-list');
    logSection.style.display = 'block';
    const li = document.createElement('li');
    const time = new Date().toLocaleTimeString();
    li.textContent = `[${time}] ${message}`;
    logList.insertBefore(li, logList.firstChild);
}

function showModal(message, data) {
    const modal = document.getElementById('clean-modal');
    document.getElementById('modal-message').textContent = message;
    
    document.getElementById('modal-stats').innerHTML = `
        <div class="modal-stat-row">
            <span class="modal-stat-label">Rows after cleaning</span>
            <span class="modal-stat-value">${data.total_rows}</span>
        </div>
        <div class="modal-stat-row">
            <span class="modal-stat-label">Total columns</span>
            <span class="modal-stat-value">${data.columns.length}</span>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    document.getElementById('modal-close').onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}
