// statics/js/upload.js

window.hasActiveUpload = false;
window.currentData = null;
window.currentFileName = '';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const uploadList = document.getElementById('upload-list');

function hideWorkspace() {
    const modal = document.getElementById('data-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

function openWorkspace() {
    const modal = document.getElementById('data-modal');
    if (!modal || !window.currentData) return;

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    if (typeof setStep === 'function') setStep(0);
    if (typeof updateModalStepper === 'function') updateModalStepper(0);
}

function updateModalDatasetInfo(data) {
    const datasetInfo = document.getElementById('modal-dataset-info');
    if (!datasetInfo || !data) return;

    const rowLabel = data.total_rows === 1 ? 'row' : 'rows';
    const columnLabel = data.total_columns === 1 ? 'column' : 'columns';
    datasetInfo.textContent = `${window.currentFileName || 'Uploaded file'} - ${data.total_rows} ${rowLabel}, ${data.total_columns} ${columnLabel}`;
}

function setUploadCompleteState(item, data) {
    item.classList.add('upload-item-complete');

    const oldActions = item.querySelector('.upload-actions');
    if (oldActions) oldActions.remove();

    const actions = document.createElement('div');
    actions.className = 'upload-actions';

    const summary = document.createElement('span');
    summary.className = 'upload-summary';
    summary.textContent = `${data.total_rows} rows, ${data.total_columns} columns ready`;

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'open-workspace-btn';
    openButton.textContent = 'Open workspace';
    openButton.addEventListener('click', openWorkspace);

    actions.append(summary, openButton);
    item.appendChild(actions);
}

function showSingleFileOnlyMessage() {
    const existingNotice = document.querySelector('.single-file-notice');
    if (existingNotice) existingNotice.remove();

    const notice = document.createElement('p');
    notice.className = 'single-file-notice';
    notice.textContent = 'Only one file can be uploaded at a time. Remove the current file first.';
    uploadList.prepend(notice);
}

function resetUploadState() {
    if (uploadList) uploadList.innerHTML = '';

    const singleNotice = document.querySelector('.single-file-notice');
    if (singleNotice) singleNotice.remove();

    window.hasActiveUpload = false;
    window.currentData = null;
    window.currentFileName = '';
    window.cleaningHistory = [];
    if (dropZone) dropZone.classList.remove('has-file');

    hideWorkspace();

    if (typeof setStep === 'function') setStep(0);

    const modalContent0 = document.getElementById('modal-content-0');
    if (modalContent0) modalContent0.innerHTML = '';

    const modalContent2 = document.getElementById('modal-content-2');
    if (modalContent2 && typeof getCleaningFormHTML === 'function') {
        modalContent2.innerHTML = getCleaningFormHTML();
    }

    const datasetInfo = document.getElementById('modal-dataset-info');
    if (datasetInfo) datasetInfo.textContent = 'No dataset loaded';

    const cleaningLog = document.getElementById('cleaning-log');
    if (cleaningLog) cleaningLog.style.display = 'none';
    const cleaningLogList = document.getElementById('cleaning-log-list');
    if (cleaningLogList) cleaningLogList.innerHTML = '';
}

dropZone.addEventListener('click', () => {
    if (window.hasActiveUpload) {
        showSingleFileOnlyMessage();
        return;
    }

    fileInput.click();
    fileInput.blur();
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', function () {
    handleFiles(this.files);
    this.value = '';
});

function handleFiles(files) {
    if (!files || files.length === 0) return;
    if (window.hasActiveUpload) {
        showSingleFileOnlyMessage();
        return;
    }

    const file = files[0];
    window.hasActiveUpload = true;
    window.currentFileName = file.name;
    dropZone.classList.add('has-file');
    uploadFile(file);
}

function uploadFile(file) {
    const item = document.createElement('div');
    item.className = 'upload-item';

    const iconSrc = file.name.toLowerCase().endsWith('.csv') ? '/statics/icons/csv.png' : '/statics/icons/xls.png';

    item.innerHTML = `
        <div class="upload-info">
            <img src="${iconSrc}" class="upload-icon" alt="" style="width: 24px; height: 24px; object-fit: contain;">
            <span class="upload-name"></span>
            <span class="upload-status">0%</span>
            <button type="button" class="upload-remove" aria-label="Remove file">&times;</button>
        </div>
        <div class="progress-container">
            <div class="progress-bar"></div>
        </div>
    `;

    uploadList.appendChild(item);

    const uploadName = item.querySelector('.upload-name');
    const progressBar = item.querySelector('.progress-bar');
    const statusText = item.querySelector('.upload-status');
    const removeBtn = item.querySelector('.upload-remove');

    uploadName.textContent = file.name;
    uploadName.title = file.name;

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
                window.hasActiveUpload = false;
                window.currentFileName = '';
                dropZone.classList.remove('has-file');
                return;
            }

            statusText.textContent = 'Ready';
            statusText.style.color = '#10b981';
            progressBar.style.width = '100%';
            progressBar.classList.add('completed');
            window.currentData = data;
            updateModalDatasetInfo(data);

            if (typeof displayTable === 'function') {
                displayTable(data.columns, data.rows, data.total_rows);
            }
            if (typeof displayProfile === 'function') {
                displayProfile(data);
            }
            if (typeof displayCleaning === 'function') {
                displayCleaning(data);
            }

            setUploadCompleteState(item, data);
        } else {
            statusText.textContent = 'Error';
            statusText.style.color = '#ef4444';
            window.hasActiveUpload = false;
            window.currentFileName = '';
            dropZone.classList.remove('has-file');
        }
    };

    xhr.onerror = () => {
        statusText.textContent = 'Error';
        statusText.style.color = '#ef4444';
        window.hasActiveUpload = false;
        window.currentFileName = '';
        dropZone.classList.remove('has-file');
    };

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
}

function displayTable(columns, rows, total_rows) {
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
    rows.slice(0, 100).forEach(row => {
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

    document.querySelectorAll('.modal-content').forEach(el => el.classList.remove('active-modal-content'));
    const content0 = document.getElementById('modal-content-0');
    if (content0) content0.classList.add('active-modal-content');

    if (typeof setStep === 'function') setStep(0);
    if (typeof updateModalStepper === 'function') updateModalStepper(0);
}

document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('data-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const newUploadBtn = document.getElementById('modal-new-upload-btn');

    function confirmNewUpload() {
        const confirmed = confirm('Upload a new file? This will clear the current dataset and workspace.');
        if (confirmed) resetUploadState();
    }

    if (newUploadBtn) {
        newUploadBtn.addEventListener('click', confirmNewUpload);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', hideWorkspace);
    }

    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                hideWorkspace();
            }
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            hideWorkspace();
        }
    });
});
