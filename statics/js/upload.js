const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const uploadList = document.getElementById('upload-list');

dropZone.addEventListener('click', () => { fileInput.click(); });

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, preventDefaults, false); });
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false); });
['dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false); });

dropZone.addEventListener('drop', (e) => { handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', function() { handleFiles(this.files); this.value = ''; });

function handleFiles(files) { [...files].forEach(uploadFile); }

function uploadFile(file) {
    const item = document.createElement('div');
    item.className = 'upload-item';
    const info = document.createElement('div');
    info.className = 'upload-info';
    const icon = document.createElement('span');
    icon.className = 'upload-icon'; icon.textContent = '??';
    const name = document.createElement('span');
    name.className = 'upload-name'; name.textContent = file.name;
    const status = document.createElement('span');
    status.className = 'upload-status'; status.textContent = '0%';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'upload-remove'; removeBtn.innerHTML = '&times;';
    removeBtn.onclick = (e) => { e.stopPropagation(); item.remove(); };

    info.append(icon, name, status, removeBtn);
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressContainer.appendChild(progressBar);
    
    item.append(info, progressContainer);
    uploadList.appendChild(item);

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            status.textContent = 'Done';
            status.style.color = '#10b981';
            progressBar.classList.add('completed');
        } else {
            status.textContent = Math.round(progress) + '%';
        }
        progressBar.style.width = progress + '%';
    }, 250);
}
