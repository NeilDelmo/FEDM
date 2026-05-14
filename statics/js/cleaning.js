// statics/js/cleaning.js

window.cleaningHistory = window.cleaningHistory || [];

const cleaningMethodNotes = {
    missing: {
        drop: 'Drops records with empty values in the selected column. Best when incomplete rows cannot be trusted.',
        mean: 'Fills numeric blanks with the column average. Best for roughly balanced numeric data.',
        median: 'Fills numeric blanks with the middle value. Best when numeric data has outliers.',
        mode: 'Fills blanks with the most frequent value. Best for categories or repeated values.',
        custom: 'Fills blanks with a value you choose. Best when there is a known placeholder or default.'
    },
    duplicates: {
        first: 'Keeps the first repeated record and removes later copies.',
        last: 'Keeps the last repeated record and removes earlier copies.',
        false: 'Removes every repeated record, including the first occurrence.'
    },
    dtype: {
        string: 'Converts the selected column to text.',
        integer: 'Converts the selected column to whole numbers; invalid values become blank.',
        float: 'Converts the selected column to decimal numbers; invalid values become blank.',
        datetime: 'Converts the selected column to dates; invalid values become blank.',
        boolean: 'Converts common true/false values such as yes/no and 1/0.'
    },
    format: {
        uppercase: 'Standardizes text to uppercase.',
        lowercase: 'Standardizes text to lowercase.',
        titlecase: 'Standardizes text to title case.',
        strip: 'Removes extra spaces at the beginning and end of text.'
    },
    filter: {
        greater_than: 'Keeps numeric rows greater than the entered value.',
        less_than: 'Keeps numeric rows less than the entered value.',
        equals: 'Keeps rows that exactly match the entered value.',
        not_equals: 'Removes rows that exactly match the entered value.',
        contains: 'Keeps rows containing the entered text.',
        not_contains: 'Removes rows containing the entered text.',
        is_empty: 'Keeps rows where the selected column is blank or missing.',
        not_empty: 'Keeps rows where the selected column has a usable value.'
    }
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getFirstElement(ids) {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return el;
    }
    return null;
}

function getCleaningDetails(action) {
    const details = {
        action,
        label: 'Cleaning action',
        target: '',
        method: '',
        note: ''
    };

    if (action === 'missing') {
        const columnEl = getFirstElement(['missing-column', 'modal-missing-column']);
        const methodEl = getFirstElement(['missing-method', 'modal-missing-method']);
        details.label = 'Handle Missing Values';
        details.target = columnEl ? columnEl.value : 'all';
        details.method = methodEl ? methodEl.value : 'drop';
        details.note = cleaningMethodNotes.missing[details.method] || '';
    } else if (action === 'duplicates') {
        const keepEl = getFirstElement(['duplicate-keep', 'modal-duplicate-keep']);
        details.label = 'Remove Duplicates';
        details.target = 'All columns';
        details.method = keepEl ? keepEl.value : 'first';
        details.note = cleaningMethodNotes.duplicates[details.method] || '';
    } else if (action === 'dtype') {
        const columnEl = getFirstElement(['dtype-column', 'modal-dtype-column']);
        const targetEl = getFirstElement(['dtype-target', 'modal-dtype-target']);
        details.label = 'Convert Data Type';
        details.target = columnEl ? columnEl.value : '';
        details.method = targetEl ? targetEl.value : 'string';
        details.note = cleaningMethodNotes.dtype[details.method] || '';
    } else if (action === 'format') {
        const columnEl = getFirstElement(['format-column', 'modal-format-column']);
        const methodEl = getFirstElement(['format-method', 'modal-format-method']);
        details.label = 'Standardize Format';
        details.target = columnEl ? columnEl.value : '';
        details.method = methodEl ? methodEl.value : 'uppercase';
        details.note = cleaningMethodNotes.format[details.method] || '';
    } else if (action === 'filter') {
        const columnEl = getFirstElement(['filter-column', 'modal-filter-column']);
        const conditionEl = getFirstElement(['filter-condition', 'modal-filter-condition']);
        const valueEl = getFirstElement(['filter-value', 'modal-filter-value']);
        details.label = 'Filter Invalid Data';
        details.target = columnEl ? columnEl.value : '';
        details.method = conditionEl ? conditionEl.value : 'equals';
        details.value = valueEl ? valueEl.value : '';
        details.note = cleaningMethodNotes.filter[details.method] || '';
    }

    return details;
}

function applyClean(action) {
    if (!window.currentData) return;

    const originalData = {
        columns: [...window.currentData.columns],
        rows: window.currentData.rows.map(r => ({ ...r })),
        total_rows: window.currentData.total_rows
    };

    const details = getCleaningDetails(action);
    const payload = { action: action, rows: window.currentData.rows };

    if (action === 'missing') {
        const customEl = getFirstElement(['custom-value', 'modal-custom-value']);
        payload.column = details.target;
        payload.method = details.method;
        payload.custom_value = customEl ? customEl.value : '';
    } else if (action === 'duplicates') {
        payload.keep = details.method;
    } else if (action === 'dtype') {
        payload.column = details.target;
        payload.target = details.method;
    } else if (action === 'format') {
        payload.column = details.target;
        payload.method = details.method;
    } else if (action === 'filter') {
        payload.column = details.target;
        payload.condition = details.method;
        payload.value = details.value || '';
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
            showComparisonView(originalData, cleanedData, cleanedData.message, details);
        })
        .catch(err => {
            console.error('Clean error:', err);
            alert('Cleaning failed. Please check the selected method and value.');
        });
}

function showComparisonView(originalData, cleanedData, message, details) {
    const modal = document.getElementById('data-modal');
    const compContainer = document.getElementById('modal-content-2');
    const removedRows = originalData.total_rows - cleanedData.total_rows;
    const changedCells = countChangedCells(originalData, cleanedData);

    compContainer.innerHTML = `
        <div class="comparison-header">
            <div class="cleaning-decision">
                <div>
                    <span class="decision-label">${escapeHtml(details.label)}</span>
                    <h3>${escapeHtml(details.target || 'Dataset')} - ${escapeHtml(details.method)}</h3>
                    <p>${escapeHtml(details.note)}</p>
                </div>
            </div>
            <div class="comparison-summary">
                <span class="summary-badge summary-message">${escapeHtml(message)}</span>
                ${removedRows > 0 ? `<span class="summary-badge badge-red">${removedRows} rows removed</span>` : ''}
                ${changedCells > 0 ? `<span class="summary-badge badge-yellow">${changedCells} cells modified</span>` : ''}
                ${removedRows === 0 && changedCells === 0 ? '<span class="summary-badge badge-green">No visible preview changes</span>' : ''}
            </div>
        </div>

        <div class="comparison-panels">
            <div class="comparison-panel">
                <div class="panel-label panel-label-original">Original Data <span class="panel-count">${originalData.total_rows} rows</span></div>
                <div class="table-scroll comparison-table-scroll">
                    ${buildComparisonTable(originalData, cleanedData, 'original')}
                </div>
            </div>

            <div class="comparison-panel">
                <div class="panel-label panel-label-cleaned">Cleaned Data <span class="panel-count">${cleanedData.total_rows} rows</span></div>
                <div class="table-scroll comparison-table-scroll">
                    ${buildComparisonTable(cleanedData, originalData, 'cleaned')}
                </div>
            </div>
        </div>

        <div class="comparison-actions">
            <button class="comparison-btn btn-undo" id="comp-undo-btn">Undo</button>
            <button class="comparison-btn btn-confirm" id="comp-confirm-btn">Confirm & Apply</button>
        </div>
    `;

    if (typeof setStep === 'function') setStep(2);
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    document.getElementById('comp-undo-btn').onclick = () => {
        restoreCleaningTools(window.currentData);
    };

    document.getElementById('comp-confirm-btn').onclick = () => {
        window.currentData = cleanedData;
        addToLog(message, details);

        if (typeof displayTable === 'function') {
            displayTable(cleanedData.columns, cleanedData.rows, cleanedData.total_rows);
        }
        if (typeof displayProfile === 'function') {
            displayProfile(cleanedData);
        }
        if (typeof updateModalDatasetInfo === 'function') {
            updateModalDatasetInfo(cleanedData);
        }

        restoreCleaningTools(cleanedData);
    };
}

function restoreCleaningTools(data) {
    const compContainer = document.getElementById('modal-content-2');
    compContainer.innerHTML = getCleaningFormHTML();
    renderCleaningLog();
    if (typeof displayCleaning === 'function') displayCleaning(data);
    if (typeof setStep === 'function') setStep(2);
}

function getCleaningFormHTML() {
    return `
    <h3 class="subsection-title">Data Cleaning</h3>

    <div class="cleaning-guide">
        <span>Review a method, apply it, compare original vs cleaned data, then confirm the change.</span>
    </div>

    <div class="cleaning-card">
        <div class="cleaning-card-header">
            <h3 class="cleaning-card-title">Handle Missing Values</h3>
            <p class="cleaning-card-desc">Drop incomplete rows or fill blanks using mean, median, mode, or a custom value.</p>
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
            <p class="cleaning-card-desc">Remove repeated rows while choosing which occurrence to keep.</p>
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
            <p class="cleaning-card-desc">Convert columns into text, numbers, dates, or boolean values.</p>
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
            <p class="cleaning-card-desc">Make text values consistent by changing case or trimming spaces.</p>
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
            <p class="cleaning-card-desc">Keep or remove rows based on a rule for one column.</p>
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
                    <option value="is_empty">Is Empty / Missing</option>
                    <option value="not_empty">Is Not Empty</option>
                </select>
            </div>
            <div class="cleaning-option-group">
                <label class="cleaning-label">Value</label>
                <input type="text" id="modal-filter-value" class="cleaning-input" placeholder="Enter value..." />
            </div>
            <button type="button" class="cleaning-btn" id="modal-apply-filter">Apply</button>
        </div>
    </div>

    <div class="cleaning-log" id="cleaning-log" style="display:none">
        <h3 class="subsection-title">Cleaning Log</h3>
        <ul id="cleaning-log-list" class="log-list"></ul>
    </div>`;
}

function rowKey(row, cols) {
    return cols.map(col => String(row[col] ?? '')).join('\u001f');
}

function buildRowKeyCounts(rows, cols) {
    const counts = new Map();
    rows.forEach(row => {
        const key = rowKey(row, cols);
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
}

function buildComparisonTable(primaryData, referenceData, mode) {
    const cols = primaryData.columns;
    const primaryRows = primaryData.rows;
    const refRows = referenceData.rows;
    const referenceCounts = buildRowKeyCounts(refRows, cols);
    const seenCounts = new Map();

    let html = `<table class="data-table comparison-data-table"><thead><tr>`;
    cols.forEach(col => { html += `<th>${escapeHtml(col)}</th>`; });
    html += `</tr></thead><tbody>`;

    primaryRows.slice(0, 100).forEach((row, i) => {
        const key = rowKey(row, cols);
        const seen = (seenCounts.get(key) || 0) + 1;
        seenCounts.set(key, seen);
        const isDeleted = mode === 'original' && seen > (referenceCounts.get(key) || 0);
        const rowClass = isDeleted ? 'row-deleted' : '';
        html += `<tr class="${rowClass}">`;

        cols.forEach(col => {
            const val = row[col] ?? '';
            const refRow = refRows[i];
            const refVal = refRow ? (refRow[col] ?? '') : null;
            let cellClass = '';

            if (!isDeleted && refRow !== undefined && primaryRows.length === refRows.length) {
                if (mode === 'cleaned' && String(val) !== String(refVal)) {
                    cellClass = refVal === null || refVal === '' ? 'cell-filled' : 'cell-modified';
                }
            }

            html += `<td class="${cellClass}" title="${escapeHtml(val)}">${escapeHtml(val)}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    return html;
}

function countChangedCells(originalData, cleanedData) {
    if (originalData.total_rows !== cleanedData.total_rows) return 0;

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

function addToLog(message, details) {
    const time = new Date().toLocaleTimeString();
    window.cleaningHistory.unshift({
        time,
        message,
        details
    });
    renderCleaningLog();
}

function renderCleaningLog() {
    const logSection = document.getElementById('cleaning-log');
    const logList = document.getElementById('cleaning-log-list');
    if (!logSection || !logList) return;

    logList.innerHTML = '';
    if (window.cleaningHistory.length === 0) {
        logSection.style.display = 'none';
        return;
    }

    logSection.style.display = 'block';
    window.cleaningHistory.forEach(entry => {
        const li = document.createElement('li');
        const target = entry.details && entry.details.target ? ` - ${entry.details.target}` : '';
        li.textContent = `[${entry.time}] ${entry.details.label}${target}: ${entry.message}`;
        logList.appendChild(li);
    });
}
