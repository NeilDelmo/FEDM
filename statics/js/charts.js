// statics/js/charts.js

let barChartInstance = null;
let lineChartInstance = null;
let pieChartInstance = null;

function displayCharts(data) {
    const container = document.getElementById('modal-content-4');
    if (!container) return;

    const columns = data.columns;

    container.innerHTML = `
        <div class="charts-header">
            <div class="charts-controls">
                <div class="chart-control-group">
                    <label class="chart-control-label">📊 X-Axis / Category Column</label>
                    <select id="chart-x-column" class="chart-select">
                        ${columns.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div class="chart-control-group">
                    <label class="chart-control-label">📈 Y-Axis / Value Column (numeric)</label>
                    <select id="chart-y-column" class="chart-select">
                        ${columns.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div class="chart-control-group chart-control-btn-wrap">
                    <button id="generate-charts-btn" class="generate-charts-btn">
                        ⚡ Generate Charts
                    </button>
                </div>
            </div>
        </div>

        <div id="charts-area" class="charts-area" style="display:none;">
            <div class="charts-grid">
                <div class="chart-card">
                    <div class="chart-card-title">📊 Bar Chart</div>
                    <div class="chart-canvas-wrap">
                        <canvas id="bar-chart"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <div class="chart-card-title">📈 Line Chart</div>
                    <div class="chart-canvas-wrap">
                        <canvas id="line-chart"></canvas>
                    </div>
                </div>
                <div class="chart-card chart-card-full">
                    <div class="chart-card-title">🥧 Pie Chart</div>
                    <div class="chart-canvas-wrap chart-canvas-pie">
                        <canvas id="pie-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <div id="charts-empty" class="charts-empty">
            <div class="charts-empty-icon">📊</div>
            <p class="charts-empty-text">Select columns above and click <strong>Generate Charts</strong> to visualize your data.</p>
        </div>
    `;

    // Pre-select a numeric column for Y if possible
    const rows = data.rows;
    const numericCols = columns.filter(col => {
        const vals = rows.map(r => r[col]).filter(v => v !== null && v !== '');
        return vals.length > 0 && vals.every(v => !isNaN(Number(v)));
    });

    const ySelect = document.getElementById('chart-y-column');
    if (numericCols.length > 0) {
        ySelect.value = numericCols[0];
    }

    document.getElementById('generate-charts-btn').onclick = () => {
        generateCharts(data);
    };
}

function generateCharts(data) {
    const xCol = document.getElementById('chart-x-column').value;
    const yCol = document.getElementById('chart-y-column').value;
    const rows = data.rows;

    // Aggregate: group by xCol, sum/average yCol
    const grouped = {};
    rows.forEach(row => {
        const key = String(row[xCol] ?? 'N/A');
        const val = parseFloat(row[yCol]);
        if (!grouped[key]) grouped[key] = { sum: 0, count: 0 };
        if (!isNaN(val)) {
            grouped[key].sum += val;
            grouped[key].count += 1;
        }
    });

    // Sort by count descending, take top 12 for readability
    const sorted = Object.entries(grouped)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 12);

    const labels = sorted.map(([k]) => k);
    const values = sorted.map(([, v]) => v.count > 0 ? parseFloat((v.sum / v.count).toFixed(2)) : 0);

    // Color palette
    const palette = [
        '#ff6600', '#6366f1', '#10b981', '#f59e0b', '#3b82f6',
        '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#22c55e',
        '#ef4444', '#0ea5e9'
    ];
    const colors = labels.map((_, i) => palette[i % palette.length]);

    // Show charts area
    document.getElementById('charts-area').style.display = 'block';
    document.getElementById('charts-empty').style.display = 'none';

    // ── Bar Chart ──────────────────────────────────────
    if (barChartInstance) barChartInstance.destroy();
    const barCtx = document.getElementById('bar-chart').getContext('2d');
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: `${yCol} (avg)`,
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}` } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 11 } } },
                y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }
            }
        }
    });

    // ── Line Chart ─────────────────────────────────────
    if (lineChartInstance) lineChartInstance.destroy();
    const lineCtx = document.getElementById('line-chart').getContext('2d');
    lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: `${yCol} (avg)`,
                data: values,
                borderColor: '#ff6600',
                backgroundColor: 'rgba(255,102,0,0.08)',
                borderWidth: 2.5,
                pointBackgroundColor: '#ff6600',
                pointRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}` } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 11 } } },
                y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }
            }
        }
    });

    // ── Pie Chart ──────────────────────────────────────
    if (pieChartInstance) pieChartInstance.destroy();
    const pieCtx = document.getElementById('pie-chart').getContext('2d');
    pieChartInstance = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 11 }, padding: 12, boxWidth: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed}`
                    }
                }
            }
        }
    });
}
