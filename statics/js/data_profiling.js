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
        select.innerHTML = config.addAll ? '<option value="all">All Columns</option>' : '';
        data.columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            select.appendChild(option);
        });
    });

    function attachMissingMethodHandler(selectId, customGroupId) {
        const missingMethod = document.getElementById(selectId);
        const customGroup = document.getElementById(customGroupId);
        if (!missingMethod || !customGroup) return;
        missingMethod.onchange = function() {
            customGroup.style.display = this.value === 'custom' ? 'block' : 'none';
        };
        missingMethod.dispatchEvent(new Event('change'));
    }

    attachMissingMethodHandler('missing-method', 'custom-value-group');
    attachMissingMethodHandler('modal-missing-method', 'modal-custom-value-group');

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
