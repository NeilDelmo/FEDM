// statics/js/display.js

function displayTable(columns, rows, total_rows) {
    const existing = document.querySelector('.table-wrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    
    const message = document.createElement('p');
    message.className = 'row-message';
    message.textContent = total_rows > 100
        ? `Showing 100 of ${total_rows} rows`
        : `Showing all ${total_rows} rows`;
    wrapper.appendChild(message);

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll';
    const table = document.createElement('table');
    table.className = 'data-table';

    // THEAD
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // TBODY
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
    document.getElementById('upload-list').appendChild(wrapper);
}

function displayProfile(data) {
    // Advance step if navigation is ready
    if (typeof setStep === 'function') setStep(1);

    document.getElementById('total-rows').textContent = data.total_rows;
    document.getElementById('total-columns').textContent = data.total_columns;
    document.getElementById('total-missing').textContent = data.total_missing;
    document.getElementById('total-duplicates').textContent = data.total_duplicates;

    const profileBody = document.getElementById('profile-table-body');
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

    const statsBody = document.getElementById('stats-table-body');
    statsBody.innerHTML = '';
    if (data.stats.length === 0) {
        statsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#6b7280;">No numeric columns found</td></tr>`;
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
        statsBody.appendChild(tr);
    });
}

function displayCleaning(data) {
    const dropdowns = ['missing-column', 'dtype-column', 'format-column', 'filter-column'];
    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (id === 'missing-column') {
            select.innerHTML = '<option value="all">All Columns</option>';
        } else {
            select.innerHTML = '';
        }
        data.columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            select.appendChild(option);
        });
    });

    // Custom value toggle
    document.getElementById('missing-method').addEventListener('change', function() {
        const customGroup = document.getElementById('custom-value-group');
        customGroup.style.display = this.value === 'custom' ? 'block' : 'none';
    });

    // Attach apply button handlers
    document.getElementById('apply-missing').onclick = (e) => { e.preventDefault(); applyClean('missing'); };
    document.getElementById('apply-duplicates').onclick = (e) => { e.preventDefault(); applyClean('duplicates'); };
    document.getElementById('apply-dtype').onclick = (e) => { e.preventDefault(); applyClean('dtype'); };
    document.getElementById('apply-format').onclick = (e) => { e.preventDefault(); applyClean('format'); };
    document.getElementById('apply-filter').onclick = (e) => { e.preventDefault(); applyClean('filter'); };
}