// statics/js/upload.js

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

// ── Global reset — called by remove button AND modal close button ──
function resetUploadState() {
    // Clear upload list
    const uploadList = document.getElementById('upload-list');
    if (uploadList) uploadList.innerHTML = '';

    // Clear single file notice
    const singleNotice = document.querySelector('.single-file-notice');
    if (singleNotice) singleNotice.remove();

    // Reset state
    window.hasActiveUpload = false;
    window.currentData = null;

    // Close the modal
    const modal = document.getElementById('data-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('modal-open');

    // Reset stepper to step 0
    if (typeof setStep === 'function') setStep(0);

    // Clear modal preview content
    const modalContent0 = document.getElementById('modal-content-0');
    if (modalContent0) modalContent0.innerHTML = '';

    // Restore cleaning form HTML
    const modalContent2 = document.getElementById('modal-content-2');
    if (modalContent2 && typeof getCleaningFormHTML === 'function') {
        modalContent2.innerHTML = getCleaningFormHTML();
    }

    // Clear cleaning log
    const cleaningLog = document.getElementById('cleaning-log');
    if (cleaningLog) cleaningLog.style.display = 'none';
    const cleaningLogList = document.getElementById('cleaning-log-list');
    if (cleaningLogList) cleaningLogList.innerHTML = '';
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
fileInput.addEventListener('change', function () { handleFiles(this.files); this.value = ''; });

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

    // ── Fixed typo: was "rremoveBtn" ──
    removeBtn.onclick = () => {
        resetUploadState();
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
    const modal = document.getElementById('data-modal');
    const modalContent = document.getElementById('modal-content-0');

    modalContent.innerHTML = '';

    const message = document.createElement('p');
    message.className = 'row-message';
    message.textContent = total_rows > 100
        ? `Showing 100 of ${total_rows} rows`
        : `Showing all ${total_rows} rows`;
    modalContent.appendChild(message);

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll';
    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

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
    modalContent.appendChild(scrollContainer);

    // Force reset all modal content tabs to hidden first
    document.querySelectorAll('.modal-content').forEach(el => el.classList.remove('active-modal-content'));
    const content0 = document.getElementById('modal-content-0');
    if (content0) content0.classList.add('active-modal-content');

    // Force stepper to step 0
    if (typeof setStep === 'function') setStep(0);
    if (typeof updateModalStepper === 'function') updateModalStepper(0);

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

// Modal close button handler
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('data-modal');
    const closeBtn = document.getElementById('modal-close-btn');

    function confirmCloseModal() {
        const confirmed = confirm('Are you sure you want to close this modal? Any unsaved changes will be lost.');
        if (confirmed) {
            resetUploadState();
        }
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', confirmCloseModal);
    }

    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                confirmCloseModal();
            }
        });
    }
});