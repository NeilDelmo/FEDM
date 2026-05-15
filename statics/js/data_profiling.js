// statics/js/data_profiling.js (Profile logic)

function displayProfile(data) {
    // Update modal profile cards
    document.getElementById('modal-total-rows').textContent = data.total_rows;
    document.getElementById('modal-total-columns').textContent = data.total_columns;
    document.getElementById('modal-total-missing').textContent = data.total_missing;
    document.getElementById('modal-total-duplicates').textContent = data.total_duplicates;

    const profileBody = document.getElementById('modal-profile-table-body');
    profileBody.innerHTML = '';
    data.column_details.forEach(col => {
        const tr = document.createElement('tr');
        let missingClass = 'missing-none';
        if (col.missing_percent > 30) missingClass = 'missing-high';
        else if (col.missing_percent > 0) missingClass = 'missing-low';

        tr.innerHTML = `
            <td>${col.name}</td>
            <td>${col.dtype}</td>
            <td class="${missingClass}">${col.missing}</td>
            <td class="${missingClass}">${col.missing_percent}%</td>
            <td>${col.unique}</td>
        `;
        profileBody.appendChild(tr);
    });

    // Also update page profile section (for non-modal view)
    document.getElementById('total-rows').textContent = data.total_rows;
    document.getElementById('total-columns').textContent = data.total_columns;
    document.getElementById('total-missing').textContent = data.total_missing;
    document.getElementById('total-duplicates').textContent = data.total_duplicates;

    const pageProfileBody = document.getElementById('profile-table-body');
    if (pageProfileBody) {
        pageProfileBody.innerHTML = '';
        data.column_details.forEach(col => {
            const tr = document.createElement('tr');
            let missingClass = 'missing-none';
            if (col.missing_percent > 30) missingClass = 'missing-high';
            else if (col.missing_percent > 0) missingClass = 'missing-low';

            tr.innerHTML = `
                <td>${col.name}</td>
                <td>${col.dtype}</td>
                <td class="${missingClass}">${col.missing}</td>
                <td class="${missingClass}">${col.missing_percent}%</td>
                <td>${col.unique}</td>
            `;
            pageProfileBody.appendChild(tr);
        });
    }

    const statsBody = document.getElementById('stats-table-body');
    const modalStatsBody = document.getElementById('modal-stats-table-body');
    if (statsBody) {
        statsBody.innerHTML = '';
    }
    if (modalStatsBody) {
        modalStatsBody.innerHTML = '';
    }

    if (data.stats.length === 0) {
        const noDataRow = `<tr><td colspan="6" style="text-align:center; color:#6b7280;">No numeric columns found</td></tr>`;
        if (statsBody) statsBody.innerHTML = noDataRow;
        if (modalStatsBody) modalStatsBody.innerHTML = noDataRow;
        return;
    }

    data.stats.forEach(stat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${stat.column}</td>
            <td>${stat.min ?? '—'}</td>
            <td>${stat.max ?? '—'}</td>
            <td>${stat.mean ?? '—'}</td>
            <td>${stat.median ?? '—'}</td>
            <td>${stat.std ?? '—'}</td>
        `;
        if (statsBody) statsBody.appendChild(tr.cloneNode(true));
        if (modalStatsBody) modalStatsBody.appendChild(tr);
    });
}

function displayCleaning(data) {
    window.columnDetails = data.column_details || [];

    function getColumnDetail(columnName) {
        return window.columnDetails.find(col => col.name === columnName) || {};
    }

    function getColumnTypeLabel(columnName) {
        const detail = getColumnDetail(columnName);
        return detail.intent || detail.dtype || 'unknown';
    }

    function getAllColumnsTypeLabel() {
        const typeCounts = window.columnDetails.reduce((counts, col) => {
            const type = col.intent || col.dtype || 'unknown';
            counts[type] = (counts[type] || 0) + 1;
            return counts;
        }, {});
        const types = Object.keys(typeCounts);
        if (types.length === 0) return 'unknown';
        if (types.length === 1) return `${types[0]} only`;
        return `mixed: ${types.map(type => `${typeCounts[type]} ${type}`).join(', ')}`;
    }

    const dropdownMap = {
        'missing-column': { addAll: true },
        'modal-missing-column': { addAll: true },
        'dtype-column': {},
        'modal-dtype-column': {},
        'format-column': {},
        'modal-format-column': {},
        'filter-column': {},
        'modal-filter-column': {}
    };

    Object.entries(dropdownMap).forEach(([id, config]) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        if (config.addAll) {
            const allOption = document.createElement('option');
            allOption.value = 'all';
            allOption.textContent = `All Columns (${getAllColumnsTypeLabel()})`;
            select.appendChild(allOption);
        }
        data.columns.forEach(col => {
            const option = document.createElement('option');
            const detail = getColumnDetail(col);
            const typeLabel = getColumnTypeLabel(col);
            option.value = col;
            option.textContent = `${col} (${typeLabel})`;
            option.title = detail.sample_values && detail.sample_values.length
                ? `Sample: ${detail.sample_values.join(', ')}`
                : `Detected type: ${typeLabel}`;
            select.appendChild(option);
        });
    });

    function attachMissingMethodHandler(columnSelectId, methodSelectId, customGroupId) {
        const columnSelect = document.getElementById(columnSelectId);
        const missingMethod = document.getElementById(methodSelectId);
        const customGroup = document.getElementById(customGroupId);
        if (!columnSelect || !missingMethod || !customGroup) return;

        let hint = document.getElementById(`${methodSelectId}-hint`);
        if (!hint) {
            hint = document.createElement('small');
            hint.id = `${methodSelectId}-hint`;
            hint.className = 'cleaning-field-hint';
            missingMethod.insertAdjacentElement('afterend', hint);
        }

        function updateMissingOptions() {
            const selectedColumn = columnSelect.value;
            const colInfo = getColumnDetail(selectedColumn);
            const intent = colInfo.intent || colInfo.dtype || 'unknown';
            const nonNumericColumns = window.columnDetails.filter(col => (col.intent || col.dtype) !== 'numeric');
            const isAllMixed = selectedColumn === 'all' && nonNumericColumns.length > 0;
            const isSingleNonNumeric = selectedColumn !== 'all' && intent !== 'numeric';
            const shouldDisableNumericMethods = isAllMixed || isSingleNonNumeric;

            ['mean', 'median'].forEach(value => {
                const option = missingMethod.querySelector(`option[value="${value}"]`);
                if (option) option.disabled = shouldDisableNumericMethods;
            });

            if (shouldDisableNumericMethods && ['mean', 'median'].includes(missingMethod.value)) {
                missingMethod.value = 'mode';
            }

            customGroup.style.display = missingMethod.value === 'custom' ? 'block' : 'none';
            if (isAllMixed) {
                hint.textContent = `All Columns includes non-numeric columns. Select a numeric column, or use Mode, Custom Value, or Drop Rows.`;
                missingMethod.title = 'Mean and median need numeric data in every selected column.';
            } else if (isSingleNonNumeric) {
                hint.textContent = `Detected ${intent} column. Use Mode, Custom Value, or Drop Rows.`;
                missingMethod.title = `Mean and median need numeric data. "${selectedColumn}" is detected as ${intent}.`;
            } else {
                hint.textContent = '';
                missingMethod.title = 'Choose how missing values should be handled.';
            }
            hint.style.display = shouldDisableNumericMethods ? 'block' : 'none';
        }

        columnSelect.onchange = updateMissingOptions;
        missingMethod.onchange = updateMissingOptions;
        updateMissingOptions();
    }

    attachMissingMethodHandler('missing-column', 'missing-method', 'custom-value-group');
    attachMissingMethodHandler('modal-missing-column', 'modal-missing-method', 'modal-custom-value-group');

    function attachFilterConditionHandler(selectId, valueInputId) {
        const filterCondition = document.getElementById(selectId);
        const valueInput = document.getElementById(valueInputId);
        const valueGroup = valueInput ? valueInput.closest('.cleaning-option-group') : null;
        if (!filterCondition || !valueInput || !valueGroup) return;
        filterCondition.onchange = function() {
            const needsValue = !['is_empty', 'not_empty'].includes(this.value);
            valueGroup.style.display = needsValue ? 'flex' : 'none';
            valueInput.required = needsValue;
            if (!needsValue) valueInput.value = '';
        };
        filterCondition.dispatchEvent(new Event('change'));
    }

    attachFilterConditionHandler('filter-condition', 'filter-value');
    attachFilterConditionHandler('modal-filter-condition', 'modal-filter-value');

    const applyButtons = {
        'apply-missing': 'missing',
        'modal-apply-missing': 'missing',
        'apply-duplicates': 'duplicates',
        'modal-apply-duplicates': 'duplicates',
        'apply-dtype': 'dtype',
        'modal-apply-dtype': 'dtype',
        'apply-format': 'format',
        'modal-apply-format': 'format',
        'apply-filter': 'filter',
        'modal-apply-filter': 'filter'
    };
    
    Object.entries(applyButtons).forEach(([buttonId, cleanType]) => {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.onclick = (e) => { e.preventDefault(); applyClean(cleanType); };
        }
    });
}
