const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const uploadList = document.getElementById('upload-list');
let hasActiveUpload = false;

function showSingleFileOnlyMessage() {
    const existingNotice = document.querySelector('.single-file-notice');
    if (existingNotice) existingNotice.remove();

    const notice = document.createElement('p');
    notice.className = 'single-file-notice';
    notice.textContent = 'Only one file can be uploaded at a time. Remove the current file first.';
    uploadList.prepend(notice);
}

dropZone.addEventListener('click', () => { fileInput.click(); fileInput.blur(); });

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, preventDefaults, false); });
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false); });
['dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false); });

dropZone.addEventListener('drop', (e) => { handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', function() { handleFiles(this.files); this.value = ''; });

function handleFiles(files) {
    if (!files || files.length === 0) return;

    if (hasActiveUpload) {
        showSingleFileOnlyMessage();
        return;
    }

    const file = files[0];
    hasActiveUpload = true;
    uploadFile(file);
}

function uploadFile(file) {
    const item = document.createElement('div');
    item.className = 'upload-item';

    const info = document.createElement('div');
    info.className = 'upload-info';

    const icon = document.createElement('span');
    icon.className = 'upload-icon';
    icon.textContent = '📄';

    const name = document.createElement('span');
    name.className = 'upload-name';
    name.textContent = file.name;

    const status = document.createElement('span');
    status.className = 'upload-status';
    status.textContent = '0%';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'upload-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        item.remove();
        const table = document.querySelector('.table-wrapper');
        if (table) table.remove();
        hasActiveUpload = false;
        const notice = document.querySelector('.single-file-notice');
        if (notice) notice.remove();
    };

    info.append(icon, name, status, removeBtn);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';

    progressContainer.appendChild(progressBar);
    item.append(info, progressContainer);
    uploadList.appendChild(item);

    // USE XMLHttpRequest 
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);

    // TRACK PROGRESS
    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;

            progressBar.style.width = percent + '%';
            status.textContent = Math.round(percent) + '%';
        }
    };

    // success
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

            displayTable(data.columns, data.rows, data.total_rows);
        } else {
            status.textContent = 'Error';
            status.style.color = '#ef4444';
        }
    };

    // ERROR
    xhr.onerror = () => {
        status.textContent = 'Error';
        status.style.color = '#ef4444';
    };

    // 📦 SEND FILE
    const formData = new FormData();
    formData.append('file', file);

    xhr.send(formData);
}

function displayTable(columns, rows, total_rows) {
    const existing = document.querySelector('.table-wrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    const message = document.createElement('p');
    message.className = 'row-message';
    message.textContent = total_rows > 100
    ? `Showing 100 of ${total_rows} rows`
    : `Showing all ${total_rows} rows`
    wrapper.appendChild(message);

    const scrollContainer =  document.createElement('div');
    scrollContainer.className = 'table-scroll';

    const table = document.createElement('table');
    table.className = 'data-table';

    // 🔹 THEAD
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 🔹 TBODY
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
    uploadList.appendChild(wrapper);
}