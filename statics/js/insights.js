// statics/js/insights.js

function displayInsights(data) {
    const container = document.getElementById('modal-content-3');
    if (!container) return;

    container.innerHTML = `
        <div class="insights-loading">
            <div class="insights-loading-text">
                <strong>Analyzing data...</strong>
                <span>Generating summaries, frequent values, and patterns</span>
            </div>
            <div class="insights-progress-track">
                <div class="insights-progress-bar"></div>
            </div>
        </div>
    `;

    fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: data.rows, columns: data.columns })
    })
    .then(res => res.json())
    .then(insights => {
        if (insights.error) {
            container.innerHTML = `<div class="insights-error">${insights.error}</div>`;
            return;
        }
        renderInsights(container, insights, data);
    })
    .catch(err => {
        container.innerHTML = '<div class="insights-error">Failed to generate insights. Please try again.</div>';
        console.error('Insights error:', err);
    });
}

function renderInsights(container, insights, data) {
    container.innerHTML = '';

    // ── Summary Cards ──────────────────────────────────────
    const summarySection = document.createElement('div');
    summarySection.innerHTML = `<h3 class="subsection-title">📊 Dataset Summary</h3>`;

    const cards = document.createElement('div');
    cards.className = 'insights-cards';
    cards.innerHTML = `
        <div class="insight-card">
            <span class="insight-card-label">Total Rows</span>
            <span class="insight-card-value">${insights.total_rows}</span>
        </div>
        <div class="insight-card">
            <span class="insight-card-label">Total Columns</span>
            <span class="insight-card-value">${insights.total_columns}</span>
        </div>
        <div class="insight-card">
            <span class="insight-card-label">Missing Values</span>
            <span class="insight-card-value ${insights.total_missing > 0 ? 'value-warning' : 'value-good'}">${insights.total_missing}</span>
        </div>
        <div class="insight-card">
            <span class="insight-card-label">Numeric Columns</span>
            <span class="insight-card-value">${insights.numeric_columns}</span>
        </div>
        <div class="insight-card">
            <span class="insight-card-label">Text Columns</span>
            <span class="insight-card-value">${insights.text_columns}</span>
        </div>
        <div class="insight-card">
            <span class="insight-card-label">Completeness</span>
            <span class="insight-card-value ${insights.completeness >= 90 ? 'value-good' : 'value-warning'}">${insights.completeness}%</span>
        </div>
    `;
    summarySection.appendChild(cards);
    container.appendChild(summarySection);

    // ── Simple Interpretations ─────────────────────────────
    if (insights.interpretations && insights.interpretations.length > 0) {
        const interpSection = document.createElement('div');
        interpSection.innerHTML = `<h3 class="subsection-title">💡 Interpretations</h3>`;
        const interpList = document.createElement('ul');
        interpList.className = 'interpretation-list';
        insights.interpretations.forEach(text => {
            const li = document.createElement('li');
            li.className = 'interpretation-item';
            li.textContent = text;
            interpList.appendChild(li);
        });
        interpSection.appendChild(interpList);
        container.appendChild(interpSection);
    }

    // ── Most Frequent Values ───────────────────────────────
    if (insights.frequent_values && insights.frequent_values.length > 0) {
        const freqSection = document.createElement('div');
        freqSection.innerHTML = `<h3 class="subsection-title">🔁 Most Frequent Values</h3>`;
        const freqGrid = document.createElement('div');
        freqGrid.className = 'frequent-grid';

        insights.frequent_values.forEach(item => {
            const card = document.createElement('div');
            card.className = 'frequent-card';
            let valuesHTML = item.values.map(v =>
                `<div class="freq-value-row">
                    <span class="freq-val">${v.value}</span>
                    <span class="freq-count">${v.count}x</span>
                    <div class="freq-bar-wrap">
                        <div class="freq-bar" style="width:${v.percent}%"></div>
                    </div>
                    <span class="freq-pct">${v.percent}%</span>
                </div>`
            ).join('');
            card.innerHTML = `
                <div class="frequent-card-title">${item.column}</div>
                ${valuesHTML}
            `;
            freqGrid.appendChild(card);
        });
        freqSection.appendChild(freqGrid);
        container.appendChild(freqSection);
    }

    // ── Numeric Statistics ─────────────────────────────────
    if (insights.numeric_stats && insights.numeric_stats.length > 0) {
        const statsSection = document.createElement('div');
        statsSection.innerHTML = `<h3 class="subsection-title">📈 Numeric Column Statistics</h3>`;
        const tableWrap = document.createElement('div');
        tableWrap.className = 'table-scroll';
        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Column</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Mean</th>
                        <th>Median</th>
                        <th>Std Dev</th>
                        <th>Mode</th>
                    </tr>
                </thead>
                <tbody>
        `;
        insights.numeric_stats.forEach(s => {
            tableHTML += `
                <tr>
                    <td><strong>${s.column}</strong></td>
                    <td>${s.min ?? '—'}</td>
                    <td>${s.max ?? '—'}</td>
                    <td>${s.mean ?? '—'}</td>
                    <td>${s.median ?? '—'}</td>
                    <td>${s.std ?? '—'}</td>
                    <td>${s.mode ?? '—'}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        tableWrap.innerHTML = tableHTML;
        statsSection.appendChild(tableWrap);
        container.appendChild(statsSection);
    }

    // ── Trends & Patterns ──────────────────────────────────
    if (insights.trends && insights.trends.length > 0) {
        const trendsSection = document.createElement('div');
        trendsSection.innerHTML = `<h3 class="subsection-title">📉 Trends & Patterns</h3>`;
        const trendList = document.createElement('div');
        trendList.className = 'trend-list';
        insights.trends.forEach(t => {
            const item = document.createElement('div');
            item.className = `trend-item trend-${t.type}`;
            item.innerHTML = `
                <span class="trend-icon">${t.type === 'warning' ? '⚠️' : t.type === 'good' ? '✅' : 'ℹ️'}</span>
                <span class="trend-text">${t.message}</span>
            `;
            trendList.appendChild(item);
        });
        trendsSection.appendChild(trendList);
        container.appendChild(trendsSection);
    }
}
