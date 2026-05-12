// statics/js/cleaning.js

function applyClean(action) {
    if (!window.currentData) return;

    function getFirstElement(ids) {
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    }

    // ── Save original data BEFORE cleaning ──
    const originalData = {
        columns: [...window.currentData.columns],
        rows: window.currentData.rows.map(r => ({ ...r })),
        total_rows: window.currentData.total_rows
    };

    let payload = { action: action, rows: window.currentData.rows };

    if (action === 'missing') {
        const columnEl = getFirstElement(['missing-column', 'modal-missing-column']);
        const methodEl = getFirstElement(['missing-method', 'modal-missing-method']);
        const customEl = getFirstElement(['custom-value', 'modal-custom-value']);
        payload.column = columnEl ? columnEl.value : 'all';
        payload.method = methodEl ? methodEl.value : 'drop';
        payload.custom_value = customEl ? customEl.value : '';
    } else if (action === 'duplicates') {
        const keepEl = getFirstElement(['duplicate-keep', 'modal-duplicate-keep']);
        payload.keep = keepEl ? keepEl.value : 'first';
    } else if (action === 'dtype') {
        const columnEl = getFirstElement(['dtype-column', 'modal-dtype-column']);
        const targetEl = getFirstElement(['dtype-target', 'modal-dtype-target']);
        payload.column = columnEl ? columnEl.value : null;
        payload.target = targetEl ? targetEl.value : 'string';
    } else if (action === 'format') {
        const columnEl = getFirstElement(['format-column', 'modal-format-column']);
        const methodEl = getFirstElement(['format-method', 'modal-format-method']);
        payload.column = columnEl ? columnEl.value : null;
        payload.method = methodEl ? methodEl.value : 'uppercase';
    } else if (action === 'filter') {
        const columnEl = getFirstElement(['filter-column', 'modal-filter-column']);
        const conditionEl = getFirstElement(['filter-condition', 'modal-filter-condition']);
        const valueEl = getFirstElement(['filter-value', 'modal-filter-value']);
        payload.column = columnEl ? columnEl.value : null;
        payload.condition = conditionEl ? conditionEl.value : 'equals';
        payload.value = valueEl ? valueEl.value : '';
    }

    fetch('/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(cleanedData => {
            if (cleanedData.error) {
                alert('Error: ' + cleanedData.error);
                return;
            }
            // Show comparison view — don't update currentData yet
            showComparisonView(originalData, cleanedData, cleanedData.message);
        })
        .catch(err => console.error('Clean error:', err));
}

function showComparisonView(originalData, cleanedData, message) {
    const modal = document.getElementById('data-modal');
    const compContainer = document.getElementById('modal-content-2');

    // Build summary badge counts
    const removedRows = originalData.total_rows - cleanedData.total_rows;
    const changedCells = countChangedCells(originalData, cleanedData);

    compContainer.innerHTML = `
        <div class="comparison-header">
            <div class="comparison-summary">
                <span class="summary-badge summary-message">📋 ${message}</span>
                ${removedRows > 0 ? `<span class="summary-badge badge-red">🗑️ ${removedRows} rows removed</span>` : ''}
                ${changedCells > 0 ? `<span class="summary-badge badge-yellow">✏️ ${changedCells} cells modified</span>` : ''}
            </div>
        </div>

        <div class="comparison-panels">
            <!-- Original -->
            <div class="comparison-panel">
                <div class="panel-label panel-label-original">📄 Original Data <span class="panel-count">${originalData.total_rows} rows</span></div>
                <div class="table-scroll comparison-table-scroll">
                    ${buildComparisonTable(originalData, cleanedData, 'original')}
                </div>
            </div>

            <!-- Cleaned -->
            <div class="comparison-panel">
                <div class="panel-label panel-label-cleaned">✅ Cleaned Data <span class="panel-count">${cleanedData.total_rows} rows</span></div>
                <div class="table-scroll comparison-table-scroll">
                    ${buildComparisonTable(cleanedData, originalData, 'cleaned')}
                </div>
            </div>
        </div>

        <div class="comparison-actions">
            <button class="comparison-btn btn-undo" id="comp-undo-btn">↩️ Undo</button>
            <button class="comparison-btn btn-confirm" id="comp-confirm-btn">✅ Confirm & Apply</button>
        </div>
    `;

    // Switch to step 3 (Clean tab) to show comparison
    if (typeof setStep === 'function') setStep(2);
    modal.style.display = 'flex';

    document.getElementById('comp-undo-btn').onclick = () => {
        // Restore the cleaning form HTML back into modal-content-2
        const compContainer = document.getElementById('modal-content-2');
        compContainer.innerHTML = getCleaningFormHTML();
        // Re-attach all dropdowns and button handlers
        if (typeof displayCleaning === 'function') displayCleaning(window.currentData);
        if (typeof setStep === 'function') setStep(2);
    };

    document.getElementById('comp-confirm-btn').onclick = () => {
        window.currentData = cleanedData;
        if (typeof displayTable === 'function') displayTable(cleanedData.columns, cleanedData.rows, cleanedData.total_rows);
        if (typeof displayCleaning === 'function') displayCleaning(cleanedData);
        addToLog(message);
        if (typeof setStep === 'function') setStep(0);
    };
}

function getCleaningFormHTML() {
    return `
    <h3 class="subsection-title">Data Cleaning</h3>

    <div class="cleaning-card">
        <div class="cleaning-card-header">
            <h3 class="cleaning-card-title">Handle Missing Values</h3>
            <p class="cleaning-card-desc">Choose how to handle empty/null values in your dataset</p>
        </div>
        <div class="cleaning-options">
            <div class="cleaning-option-group">
                <label class="cleaning-label">Select Column</label>
                <select id="modal-missing-column" class="cleaning-select"><option value="all">All Columns</option></select>
            </div>
            <div class="cleaning-option-group">
                <label class="cleaning-label">Method</label>
                <select id="modal-missing-method" class="cleaning-select">
                    <option value="drop">Drop rows with missing values</option>
                    <option value="mean">Fill with Mean</option>
                    <option value="median">Fill with Median</option>
                    <option value="mode">Fill with Mode</option>
                    <option value="custom">Fill with Custom Value</option>
                </select>
            </div>
            <div class="cleaning-option-group" id="modal-custom-value-group" style="display:none">
                <label class="cleaning-label">Custom Value</label>
                <input type="text" id="modal-custom-value" class="cleaning-input" placeholder="Enter value..." />
            </div>
            <button type="button" class="cleaning-btn" id="modal-apply-missing">Apply</button>
        </div>
    </div>

    <div class="cleaning-card">
        <div class="cleaning-card-header">
            <h3 class="cleaning-card-title">Remove Duplicates</h3>
            <p class="cleaning-card-desc">Remove duplicate rows from your dataset</p>
        </div>
        <div class="cleaning-options">
            <div class="cleaning-option-group">
                <label class="cleaning-label">Keep</label>
                <select id="modal-duplicate-keep" class="cleaning-select">
                    <option value="first">Keep First Occurrence</option>
                    <option value="last">Keep Last Occurrence</option>
                    <option value="false">Remove All Duplicates</option>
                </select>
            </div>
            <button type="button" class="cleaning-btn" id="modal-apply-duplicates">Apply</button>
        </div>
    </div>

    <div class="cleaning-card">
        <div class="cleaning-card-header">
            <h3 class="cleaning-card-title">Convert Data Types</h3>
            <p class="cleaning-card-desc">Change the data type of a column</p>
        </div>
        <div class="cleaning-options">
            <div class="cleaning-option-group">
                <label class="cleaning-label">Select Column</label>
                <select id="modal-dtype-column" class="cleaning-select"></select>
            </div>
            <div class="cleaning-option-group">
                <label class="cleaning-label">Convert To</label>
                <select id="modal-dtype-target" class="cleaning-select">
                    <option value="string">Text (String)</option>
                    <option value="integer">Integer (Whole Number)</option>
                    <option value="float">Float (Decimal Number)</option>
                    <option value="datetime">Date / Time</option>
                    <option value="boolean">Boolean (True/False)</option>
                </select>
            </div>
            <button type="button" class="cleaning-btn" id="modal-apply-dtype">Apply</button>
        </div>
    </div>

    <div class="cleaning-card">
        <div class="cleaning-card-header">
            <h3 class="cleaning-card-title">Standardize Formats</h3>
            <p class="cleaning-card-desc">Standardize text formatting in a column</p>
        </div>
        <div class="cleaning-options">
            <div class="cleaning-option-group">
                <label class="cleaning-label">Select Column</label>
                <select id="modal-format-column" class="cleaning-select"></select>
            </div>
            <div class="cleaning-option-group">
                <label class="cleaning-label">Format</label>
                <select id="modal-format-method" class="cleaning-select">
                    <option value="uppercase">UPPERCASE</option>
                    <option value="lowercase">lowercase</option>
                    <option value="titlecase">Title Case</option>
                    <option value="strip">Remove Extra Spaces</option>
                </select>
            </div>
            <button type="button" class="cleaning-btn" id="modal-apply-format">Apply</button>
        </div>
    </div>

    <div class="cleaning-card">
        <div class="cleaning-card-header">
            <h3 class="cleaning-card-title">Filter Invalid Data</h3>
            <p class="cleaning-card-desc">Remove rows based on a condition</p>
        </div>
        <div class="cleaning-options">
            <div class="cleaning-option-group">
                <label class="cleaning-label">Select Column</label>
                <select id="modal-filter-column" class="cleaning-select"></select>
            </div>
            <div class="cleaning-option-group">
                <label class="cleaning-label">Condition</label>
                <select id="modal-filter-condition" class="cleaning-select">
                    <option value="greater_than">Greater Than</option>
                    <option value="less_than">Less Than</option>
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="contains">Contains (text)</option>
                    <option value="not_contains">Does Not Contain (text)</option>
                </select>
            </div>
            <div class="cleaning-option-group">
                <label class="cleaning-label">Value</label>
                <input type="text" id="modal-filter-value" class="cleaning-input" placeholder="Enter value..." />
            </div>
            <button type="button" class="cleaning-btn" id="modal-apply-filter">Apply</button>
        </div>
    </div>`;
}

function buildComparisonTable(primaryData, referenceData, mode) {
    const cols = primaryData.columns;
    const primaryRows = primaryData.rows;
    const refRows = referenceData.rows;

    // Build a set of original row keys to detect deleted rows (for cleaned panel)
    let deletedRowIndices = new Set();
    if (mode === 'original') {
        // Mark rows in original that no longer exist in cleaned
        primaryRows.forEach((row, i) => {
            const stillExists = refRows.some(refRow =>
                cols.every(col => String(row[col] ?? '') === String(refRow[col] ?? ''))
            );
            if (!stillExists) deletedRowIndices.add(i);
        });
    }

    let html = `<table class="data-table comparison-data-table"><thead><tr>`;
    cols.forEach(col => { html += `<th>${col}</th>`; });
    html += `</tr></thead><tbody>`;

    primaryRows.slice(0, 100).forEach((row, i) => {
        const isDeleted = mode === 'original' && deletedRowIndices.has(i);
        const rowClass = isDeleted ? 'row-deleted' : '';
        html += `<tr class="${rowClass}">`;
        cols.forEach(col => {
            const val = row[col] ?? '';
            const refRow = refRows[i];
            const refVal = refRow ? (refRow[col] ?? '') : null;
            let cellClass = '';
            if (!isDeleted && refRow !== undefined) {
                if (mode === 'cleaned' && String(val) !== String(refVal)) {
                    // Value changed — was it filled (was null, now has value)?
                    if (refVal === null || refVal === '') {
                        cellClass = 'cell-filled';
                    } else {
                        cellClass = 'cell-modified';
                    }
                }
            }
            html += `<td class="${cellClass}" title="${val}">${val}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    return html;
}

function countChangedCells(originalData, cleanedData) {
    let count = 0;
    const minRows = Math.min(originalData.rows.length, cleanedData.rows.length);
    for (let i = 0; i < minRows; i++) {
        originalData.columns.forEach(col => {
            if (String(originalData.rows[i][col] ?? '') !== String(cleanedData.rows[i][col] ?? '')) {
                count++;
            }
        });
    }
    return count;
}

function exportCleanedData(columns, rows, format = 'csv') {
    fetch('/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: columns, rows: rows, format: format })
    })
        .then(response => {
            if (!response.ok) throw new Error('Export failed');
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = format === 'xlsx' ? 'cleaned_data.xlsx' : 'cleaned_data.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        })
        .catch(err => console.error('Export error:', err));
}

function addToLog(message) {
    const logSection = document.getElementById('cleaning-log');
    const logList = document.getElementById('cleaning-log-list');
    if (!logSection || !logList) return;
    logSection.style.display = 'block';
    const li = document.createElement('li');
    const time = new Date().toLocaleTimeString();
    li.textContent = `[${time}] ${message}`;
    logList.insertBefore(li, logList.firstChild);
}