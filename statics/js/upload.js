// statics/js/upload.js

// Shared state (if not using shared.js)
window.hasActiveUpload = false;
window.currentData = null;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const uploadList = document.getElementById('upload-list');

function showSingleFileOnlyMessage() {
    const existingNotice = document.querySelector('.single-file-notice');
    if (existingNotice) existingNotice.remove();

    const notice = document.createElement('p');
    notice.className = 'single-file-notice';
    notice.textContent = 'Only one file can be uploaded at a time. Remove the current file first.';
    uploadList.prepend(notice);
}

dropZone.addEventListener('click', () => { fileInput.click(); fileInput.blur(); });

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', function() { handleFiles(this.files); this.value = ''; });

function handleFiles(files) {
    if (!files || files.length === 0) return;
    if (window.hasActiveUpload) {
        showSingleFileOnlyMessage();
        return;
    }
    const file = files[0];
    window.hasActiveUpload = true;
    uploadFile(file);
}

function uploadFile(file) {
    const item = document.createElement('div');
    item.className = 'upload-item';
    
    // File Icon (assuming it's a CSV or Excel)
    let iconSrc = file.name.endsWith('.csv') ? '/statics/icons/csv.png' : '/statics/icons/xls.png';

    item.innerHTML = `
        <div class="upload-info">
            <img src="${iconSrc}" class="upload-icon" alt="icon" style="width: 24px; height: 24px; object-fit: contain;">
            <span class="upload-name" title="${file.name}">${file.name}</span>
            <span class="upload-status">0%</span>
            <button class="upload-remove">✕</button>
        </div>
        <div class="progress-container">
            <div class="progress-bar"></div>
        </div>
    `;

    uploadList.appendChild(item);

    const progressBar = item.querySelector('.progress-bar');
    const statusText = item.querySelector('.upload-status');
    const removeBtn = item.querySelector('.upload-remove');

    removeBtn.onclick = () => {
        item.remove();
        window.hasActiveUpload = false;
        window.currentData = null;
        
        // Hide profile & cleaning views, go back to step 1
        if (typeof setStep === 'function') setStep(0);
        
        const singleNotice = document.querySelector('.single-file-notice');
        if (singleNotice) singleNotice.remove();
    };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);

    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            progressBar.style.width = percent + '%';
            statusText.textContent = Math.round(percent) + '%';
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            let data;
            try {
                data = JSON.parse(xhr.responseText);
            } catch (error) {
                statusText.textContent = 'Invalid server response';
                statusText.style.color = '#ef4444';
                return;
            }

            statusText.textContent = 'Done';
            statusText.style.color = '#10b981';
            progressBar.style.width = '100%';
            progressBar.classList.add('completed');
            window.currentData = data;

            if (typeof displayTable === 'function') {
                displayTable(data.columns, data.rows, data.total_rows);
            }
            if (typeof displayProfile === 'function') {
                displayProfile(data);
            }
            if (typeof displayCleaning === 'function') {
                displayCleaning(data);
            }
        } else {
            statusText.textContent = 'Error';
            statusText.style.color = '#ef4444';
        }
    };

    xhr.onerror = () => {
        statusText.textContent = 'Error';
        statusText.style.color = '#ef4444';
    };

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
}

function displayTable(columns, rows, total_rows) {
    const existing = document.querySelector('.table-wrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    
    // Changed: Append the table to the #view-upload container (or #upload-list inside it)
    const containerItem = document.getElementById('view-upload') || document.getElementById('upload-list');
    
    const message = document.createElement('p');
    message.className = 'row-message';
    message.textContent = total_rows > 100
        ? `Showing 100 of ${total_rows} rows`
        : `Showing all ${total_rows} rows`;
    wrapper.appendChild(message);

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll';
    const table = document.createElement('table');
    table.className = 'data-table';

    // THEAD
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // TBODY
    const tbody = document.createElement('tbody');
    rows.forEach(row => {
        const tr = document.createElement('tr');
        columns.forEach(col => {
            const td = document.createElement('td');
            td.textContent = row[col] ?? '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    scrollContainer.appendChild(table);
    wrapper.appendChild(scrollContainer);
    
    // Append to upload list or view container
    document.getElementById('upload-list').appendChild(wrapper);
}