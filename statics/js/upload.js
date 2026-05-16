// statics/js/upload.js

window.hasActiveUpload = false;
window.currentData = null;
window.originalData = null;
window.currentFileName = '';
window.previewDataMode = 'original';
window.hasCleanedData = false;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const uploadList = document.getElementById('upload-list');

function cloneDataset(data) {
    return data ? JSON.parse(JSON.stringify(data)) : null;
}

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

    showCurrentPreview(window.previewDataMode === 'original' ? 'original' : 'cleaned');
}

function updateModalDatasetInfo(data) {
    const datasetInfo = document.getElementById('modal-dataset-info');
    if (!datasetInfo || !data) return;

    const rowLabel = data.total_rows === 1 ? 'row' : 'rows';
    const columnLabel = data.total_columns === 1 ? 'column' : 'columns';
    datasetInfo.textContent = `${window.currentFileName || 'Uploaded file'} - ${data.total_rows} ${rowLabel}, ${data.total_columns} ${columnLabel}`;
}

function setUploadCompleteState(item, data) {
    item.classList.remove('upload-item-processing');
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
    window.originalData = null;
    window.currentFileName = '';
    window.previewDataMode = 'original';
    window.hasCleanedData = false;
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

    function setUploadStatus(text, color = '#64748b') {
        statusText.textContent = text;
        statusText.style.color = color;
    }

    function setProcessingState() {
        item.classList.add('upload-item-processing');
        progressBar.style.width = '95%';
        setUploadStatus('Processing file...');
    }

    function setErrorState(message) {
        item.classList.remove('upload-item-processing');
        setUploadStatus(message, '#ef4444');
        progressBar.classList.remove('completed');
        window.hasActiveUpload = false;
        window.currentFileName = '';
        dropZone.classList.remove('has-file');
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);

    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            const displayPercent = Math.min(percent, 95);
            progressBar.style.width = displayPercent + '%';

            if (percent >= 100) {
                setProcessingState();
            } else {
                setUploadStatus(`Uploading ${displayPercent}%`);
            }
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            let data;
            try {
                data = JSON.parse(xhr.responseText);
            } catch (error) {
                setErrorState('Invalid server response');
                return;
            }

            if (data.error) {
                setErrorState(data.error);
                return;
            }

            item.classList.remove('upload-item-processing');
            setUploadStatus('Ready', '#10b981');
            progressBar.style.width = '100%';
            progressBar.classList.add('completed');
            window.currentData = data;
            window.originalData = cloneDataset(data);
            window.previewDataMode = 'original';
            window.hasCleanedData = false;
            updateModalDatasetInfo(data);

            if (typeof displayTable === 'function') {
                displayTable(data.columns, data.rows, data.total_rows, {
                    label: 'Original Data',
                    mode: 'original',
                    showOriginalToggle: false,
                    showExport: false
                });
            }
            if (typeof displayProfile === 'function') {
                displayProfile(data);
            }
            if (typeof displayCleaning === 'function') {
                displayCleaning(data);
            }

            setUploadCompleteState(item, data);
        } else {
            let message = 'Upload failed';
            try {
                const errorData = JSON.parse(xhr.responseText);
                if (errorData.error) message = errorData.error;
            } catch (error) {
                message = xhr.status ? `Upload failed (${xhr.status})` : 'Upload failed';
            }
            setErrorState(message);
        }
    };

    xhr.onerror = () => {
        setErrorState('Network error');
    };

    const formData = new FormData();
    formData.append('file', file);
    setUploadStatus('Uploading 0%');
    xhr.send(formData);
}

function displayTable(columns, rows, total_rows, options = {}) {
    const modalContent = document.getElementById('modal-content-0');

    modalContent.innerHTML = '';

    const mode = options.mode || window.previewDataMode || 'original';
    const isCleanedPreview = mode === 'cleaned';
    const label = options.label || (isCleanedPreview ? 'Cleaned Data' : 'Original Data');
    const canShowOriginal = Boolean(options.showOriginalToggle && window.originalData);
    const canShowCleaned = Boolean(isCleanedPreview === false && window.hasCleanedData && window.currentData && window.originalData);
    const showExport = Boolean(options.showExport && window.currentData);

    const previewHeader = document.createElement('div');
    previewHeader.className = 'preview-toolbar';

    const leftActions = document.createElement('div');
    leftActions.className = 'preview-toolbar-left';

    if (canShowOriginal) {
        const originalButton = document.createElement('button');
        originalButton.type = 'button';
        originalButton.className = 'preview-secondary-btn';
        originalButton.textContent = 'View Original Data';
        originalButton.addEventListener('click', () => showCurrentPreview('original'));
        leftActions.appendChild(originalButton);
    } else if (canShowCleaned) {
        const cleanedButton = document.createElement('button');
        cleanedButton.type = 'button';
        cleanedButton.className = 'preview-secondary-btn';
        cleanedButton.textContent = 'View Cleaned Data';
        cleanedButton.addEventListener('click', () => showCurrentPreview('cleaned'));
        leftActions.appendChild(cleanedButton);
    }

    const titleGroup = document.createElement('div');
    titleGroup.className = 'preview-title-group';

    const title = document.createElement('h3');
    title.className = 'preview-title';
    title.textContent = label;
    titleGroup.appendChild(title);

    const rightActions = document.createElement('div');
    rightActions.className = 'preview-toolbar-actions';

    if (showExport) {
        const exportCsv = document.createElement('button');
        exportCsv.type = 'button';
        exportCsv.className = 'preview-export-btn';
        exportCsv.textContent = 'Export CSV';
        exportCsv.addEventListener('click', () => exportCleanedData(window.currentData.columns, window.currentData.rows, 'csv'));

        const exportExcel = document.createElement('button');
        exportExcel.type = 'button';
        exportExcel.className = 'preview-export-btn preview-export-btn-secondary';
        exportExcel.textContent = 'Export Excel';
        exportExcel.addEventListener('click', () => exportCleanedData(window.currentData.columns, window.currentData.rows, 'xlsx'));

        rightActions.append(exportCsv, exportExcel);
    }

    previewHeader.append(leftActions, titleGroup, rightActions);
    modalContent.appendChild(previewHeader);

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

    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.textContent = label;
}

function showCurrentPreview(mode = 'cleaned') {
    const data = mode === 'original' ? window.originalData : window.currentData;
    if (!data) return;

    window.previewDataMode = mode;
    displayTable(data.columns, data.rows, data.total_rows, {
        label: mode === 'original' ? 'Original Data' : 'Cleaned Data',
        mode,
        showOriginalToggle: mode === 'cleaned',
        showExport: mode === 'cleaned'
    });
}

window.showCurrentPreview = showCurrentPreview;

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
