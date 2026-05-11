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
    // ... (your existing upload item UI code) ...
    // [Keep all your existing upload UI creation code here]

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);

    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            progressBar.style.width = percent + '%';
            status.textContent = Math.round(percent) + '%';
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            let data;
            try {
                data = JSON.parse(xhr.responseText);
            } catch (error) {
                status.textContent = 'Invalid server response';
                status.style.color = '#ef4444';
                return;
            }

            status.textContent = 'Done';
            status.style.color = '#10b981';
            progressBar.style.width = '100%';
            progressBar.classList.add('completed');
            window.currentData = data; // ✅ Store in global state

            // Call display functions (defined in display.js)
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
            status.textContent = 'Error';
            status.style.color = '#ef4444';
        }
    };

    xhr.onerror = () => {
        status.textContent = 'Error';
        status.style.color = '#ef4444';
    };

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
}