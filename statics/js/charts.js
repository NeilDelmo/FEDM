// statics/js/charts.js

let barChartInstance = null;
let lineChartInstance = null;
let pieChartInstance = null;
let chartValueDropdownListenerReady = false;

const chartPalettes = {
    mixed: ['#0ea5e9', '#f97316', '#22c55e', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308', '#ec4899', '#6366f1', '#84cc16', '#f43f5e', '#06b6d4'],
    business: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#c2410c', '#4f46e5', '#be123c', '#0f766e', '#a16207'],
    soft: ['#93c5fd', '#fdba74', '#86efac', '#c4b5fd', '#fca5a5', '#5eead4', '#fde68a', '#f9a8d4', '#a5b4fc', '#bef264', '#fda4af', '#67e8f9']
};

function escapeChartHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function isPresent(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

function getNumericColumns(columns, rows) {
    return columns.filter(col => {
        const vals = rows.map(r => r[col]).filter(isPresent);
        return vals.length > 0 && vals.every(v => Number.isFinite(Number(v)));
    });
}

function getDateColumns(columns, rows) {
    return columns.filter(col => {
        const vals = rows.map(r => r[col]).filter(isPresent).slice(0, 50);
        if (vals.length === 0) return false;

        const parsed = vals.filter(v => {
            const raw = String(v).trim();
            return raw.length >= 6 && Number.isFinite(Date.parse(raw));
        });

        return parsed.length / vals.length >= 0.8;
    });
}

function getBestCategoryColumn(columns, numericCols) {
    return columns.find(col => !numericCols.includes(col)) || columns[0] || '';
}

function toTitleText(value) {
    return String(value || '')
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function renderValueVariablePicker(yOptions) {
    return `
        <div id="chart-y-column" class="chart-multi-wrapper">
            <button type="button" id="chart-y-column-button" class="chart-select chart-multi-button" aria-expanded="false" aria-haspopup="listbox">
                <span id="chart-y-column-label">Select value variables</span>
                <span class="chart-multi-caret" aria-hidden="true"></span>
            </button>
            <div id="chart-y-column-panel" class="chart-multi-panel" role="listbox" aria-multiselectable="true">
                ${yOptions.map(c => `
                    <label class="chart-multi-option">
                        <input type="checkbox" class="chart-value-checkbox" value="${escapeChartHtml(c)}" />
                        <span>${escapeChartHtml(c)}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

function syncValueDropdownLabel() {
    const label = document.getElementById('chart-y-column-label');
    const selected = getSelectedValueColumns();
    if (!label) return;

    if (selected.length === 0) {
        label.textContent = 'Select value variables';
    } else if (selected.length === 1) {
        label.textContent = selected[0];
    } else {
        label.textContent = `${selected.length} variables selected`;
    }
}

function closeChartValueDropdown() {
    const wrapper = document.getElementById('chart-y-column');
    const button = document.getElementById('chart-y-column-button');
    if (!wrapper || !button) return;

    wrapper.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
}

function setGenerateButtonLoading(isLoading) {
    const button = document.getElementById('generate-charts-btn');
    if (!button) return;

    button.disabled = isLoading;
    button.classList.toggle('is-loading', isLoading);
    button.textContent = isLoading ? 'Generating...' : 'Generate Charts';
}

function showChartLoadingState() {
    const area = document.getElementById('charts-area');
    const empty = document.getElementById('charts-empty');
    const loading = document.getElementById('charts-loading');
    const error = document.getElementById('charts-error');

    if (area) area.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (error) error.style.display = 'none';
    if (loading) loading.style.display = 'block';
    setGenerateButtonLoading(true);
}

function hideChartLoadingState() {
    const loading = document.getElementById('charts-loading');
    if (loading) loading.style.display = 'none';
    setGenerateButtonLoading(false);
}

function showChartError(message) {
    const area = document.getElementById('charts-area');
    const empty = document.getElementById('charts-empty');
    const loading = document.getElementById('charts-loading');
    const error = document.getElementById('charts-error');

    if (area) area.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (error) {
        error.textContent = message;
        error.style.display = 'block';
    }
    setGenerateButtonLoading(false);
}

function destroyChartInstances() {
    if (barChartInstance) barChartInstance.destroy();
    if (lineChartInstance) lineChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();
    barChartInstance = null;
    lineChartInstance = null;
    pieChartInstance = null;
}

function resetChartCanvasWraps() {
    destroyChartInstances();
    const barWrap = document.getElementById('bar-chart-wrap');
    const lineWrap = document.getElementById('line-chart-wrap');
    const pieWrap = document.getElementById('pie-chart-wrap');

    if (barWrap) barWrap.innerHTML = '<canvas id="bar-chart"></canvas>';
    if (lineWrap) lineWrap.innerHTML = '<canvas id="line-chart"></canvas>';
    if (pieWrap) pieWrap.innerHTML = '<canvas id="pie-chart"></canvas>';
}

function setupValueVariablePicker() {
    const wrapper = document.getElementById('chart-y-column');
    const button = document.getElementById('chart-y-column-button');
    const checkboxes = document.querySelectorAll('.chart-value-checkbox');
    if (!wrapper || !button) return;

    button.onclick = event => {
        event.stopPropagation();
        const isOpen = wrapper.classList.toggle('is-open');
        button.setAttribute('aria-expanded', String(isOpen));
    };

    checkboxes.forEach(checkbox => {
        checkbox.onchange = syncValueDropdownLabel;
    });

    if (!chartValueDropdownListenerReady) {
        document.addEventListener('click', event => {
            const currentWrapper = document.getElementById('chart-y-column');
            if (currentWrapper && !currentWrapper.contains(event.target)) {
                closeChartValueDropdown();
            }
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeChartValueDropdown();
            }
        });
        chartValueDropdownListenerReady = true;
    }

    syncValueDropdownLabel();
}

function displayCharts(data) {
    const container = document.getElementById('modal-content-4');
    if (!container) return;

    const columns = data.columns || [];
    const rows = data.rows || [];
    const numericCols = getNumericColumns(columns, rows);
    const dateCols = getDateColumns(columns, rows);
    const yOptions = numericCols.length > 0 ? numericCols : columns;
    const hasNumericValues = numericCols.length > 0;

    container.innerHTML = `
        <div class="charts-header">
            <div class="charts-controls">
                <div class="chart-control-group">
                    <label class="chart-control-label">Scenario</label>
                    <select id="chart-scenario" class="chart-select">
                        <option value="compare">Compare values</option>
                        <option value="trend">Trend over time</option>
                        <option value="distribution">Distribution / percentage</option>
                    </select>
                </div>
                <div class="chart-control-group">
                    <label class="chart-control-label">Category Variable</label>
                    <select id="chart-x-column" class="chart-select">
                        ${columns.map(c => `<option value="${escapeChartHtml(c)}">${escapeChartHtml(c)}</option>`).join('')}
                    </select>
                </div>
                <div class="chart-control-group chart-multi-group">
                    <label class="chart-control-label">Value Variables</label>
                    ${renderValueVariablePicker(yOptions)}
                </div>
                <div class="chart-control-group">
                    <label class="chart-control-label">Category Labels</label>
                    <select id="chart-label-mode" class="chart-select">
                        <option value="auto">Auto</option>
                        <option value="exact">Exact Values</option>
                        <option value="ranges">Number Ranges</option>
                    </select>
                </div>
                <div class="chart-control-group">
                    <label class="chart-control-label">Calculation</label>
                    <select id="chart-aggregation" class="chart-select">
                        <option value="average">Average</option>
                        <option value="sum">Sum</option>
                        <option value="count">Count Rows</option>
                        <option value="min">Minimum</option>
                        <option value="max">Maximum</option>
                    </select>
                </div>
                <div class="chart-control-group">
                    <label class="chart-control-label">Show</label>
                    <select id="chart-limit" class="chart-select">
                        <option value="5">Top 5</option>
                        <option value="8">Top 8</option>
                        <option value="12" selected>Top 12</option>
                        <option value="20">Top 20</option>
                    </select>
                </div>
                <div class="chart-control-group">
                    <label class="chart-control-label">Sort</label>
                    <select id="chart-sort" class="chart-select">
                        <option value="value_desc">Highest Values</option>
                        <option value="value_asc">Lowest Values</option>
                        <option value="category_asc">Category / Date Order</option>
                        <option value="label_asc">A to Z</option>
                    </select>
                </div>
                <div class="chart-control-group">
                    <label class="chart-control-label">Palette</label>
                    <select id="chart-palette" class="chart-select">
                        <option value="mixed">Mixed</option>
                        <option value="business">Business</option>
                        <option value="soft">Soft</option>
                    </select>
                </div>
                <div class="chart-control-group chart-control-btn-wrap">
                    <button id="generate-charts-btn" class="generate-charts-btn">Generate Charts</button>
                </div>
            </div>
            <div class="charts-help">
                Pick the scenario sir asks for, then choose the CSV columns. Hold Ctrl or Shift to select multiple value variables for bar and line charts.
            </div>
        </div>

        <div id="charts-area" class="charts-area" style="display:none;">
            <div id="charts-warning" class="charts-warning" style="display:none;"></div>
            <div id="charts-summary" class="charts-summary"></div>
            <div class="charts-grid">
                <div class="chart-card">
                    <div class="chart-card-title" id="bar-chart-title">Bar Chart</div>
                    <div class="chart-canvas-wrap" id="bar-chart-wrap">
                        <canvas id="bar-chart"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <div class="chart-card-title" id="line-chart-title">Line Chart</div>
                    <div class="chart-canvas-wrap" id="line-chart-wrap">
                        <canvas id="line-chart"></canvas>
                    </div>
                </div>
                <div class="chart-card chart-card-full">
                    <div class="chart-card-title" id="pie-chart-title">Pie Chart</div>
                    <div class="chart-canvas-wrap chart-canvas-pie" id="pie-chart-wrap">
                        <canvas id="pie-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <div id="charts-loading" class="charts-loading" style="display:none;">
            <div class="charts-loading-text">
                <strong>Generating charts...</strong>
                <span>Grouping values, calculating totals, and drawing previews</span>
            </div>
            <div class="charts-progress-track">
                <div class="charts-progress-bar"></div>
            </div>
            <div class="charts-loading-preview" aria-hidden="true">
                <span style="height: 36%"></span>
                <span style="height: 68%"></span>
                <span style="height: 48%"></span>
                <span style="height: 84%"></span>
                <span style="height: 58%"></span>
            </div>
        </div>

        <div id="charts-empty" class="charts-empty">
            <div class="charts-empty-icon">Chart</div>
            <p class="charts-empty-text">Choose variables and options above, then generate the dashboard.</p>
        </div>

        <div id="charts-error" class="charts-error" style="display:none;"></div>
    `;

    const xSelect = document.getElementById('chart-x-column');
    const yCheckboxes = document.querySelectorAll('.chart-value-checkbox');
    xSelect.value = getBestCategoryColumn(columns, numericCols);
    if (numericCols.length > 0) {
        yCheckboxes.forEach((checkbox, index) => {
            checkbox.checked = index === 0;
        });
    }
    if (dateCols.length > 0) {
        document.getElementById('chart-scenario').dataset.bestDateColumn = dateCols[0];
    }
    if (!hasNumericValues) {
        document.getElementById('chart-aggregation').value = 'count';
    }

    document.getElementById('chart-scenario').onchange = () => applyChartScenario(data);
    document.getElementById('chart-aggregation').onchange = syncChartControls;
    document.getElementById('chart-x-column').onchange = () => syncLabelMode(data);
    document.getElementById('generate-charts-btn').onclick = () => generateCharts(data);
    setupValueVariablePicker();
    syncChartControls();
    syncLabelMode(data);
}

function applyChartScenario(data) {
    const scenario = document.getElementById('chart-scenario').value;
    const xSelect = document.getElementById('chart-x-column');
    const aggregationSelect = document.getElementById('chart-aggregation');
    const sortSelect = document.getElementById('chart-sort');
    const limitSelect = document.getElementById('chart-limit');
    const numericCols = getNumericColumns(data.columns || [], data.rows || []);
    const dateCols = getDateColumns(data.columns || [], data.rows || []);

    if (scenario === 'trend') {
        if (dateCols.length > 0) xSelect.value = dateCols[0];
        if (numericCols.length > 0 && aggregationSelect.value === 'count') {
            aggregationSelect.value = 'sum';
        }
        sortSelect.value = 'category_asc';
        limitSelect.value = '20';
    } else if (scenario === 'distribution') {
        aggregationSelect.value = 'count';
        sortSelect.value = 'value_desc';
        limitSelect.value = '12';
    } else {
        if (numericCols.length > 0 && aggregationSelect.value === 'count') {
            aggregationSelect.value = 'average';
        }
        sortSelect.value = 'value_desc';
        limitSelect.value = '12';
    }

    syncChartControls();
    syncLabelMode(data);
}

function syncChartControls() {
    const aggregation = document.getElementById('chart-aggregation').value;
    const yPicker = document.getElementById('chart-y-column');
    const yButton = document.getElementById('chart-y-column-button');
    yPicker.classList.toggle('chart-select-muted', aggregation === 'count');
    yButton.title = aggregation === 'count'
        ? 'Count Rows uses the category variable; selected value variables are ignored until you choose another calculation.'
        : 'Choose one or more value variables.';
}

function getSelectedValueColumns() {
    return Array.from(document.querySelectorAll('.chart-value-checkbox:checked')).map(option => option.value);
}

function getFirstValueColumn() {
    const firstCheckbox = document.querySelector('.chart-value-checkbox');
    return firstCheckbox ? firstCheckbox.value : '';
}

function syncLabelMode(data) {
    const xCol = document.getElementById('chart-x-column').value;
    const labelMode = document.getElementById('chart-label-mode');
    const numericCols = getNumericColumns(data.columns || [], data.rows || []);
    const isNumericCategory = numericCols.includes(xCol);
    const rangesOption = labelMode.querySelector('option[value="ranges"]');

    labelMode.disabled = false;
    if (rangesOption) rangesOption.disabled = !isNumericCategory;

    if (!isNumericCategory && labelMode.value === 'ranges') {
        labelMode.value = 'exact';
    } else if (isNumericCategory && !labelMode.value) {
        labelMode.value = 'auto';
    }

    labelMode.title = isNumericCategory
        ? 'Numeric categories can be grouped as exact values or number ranges.'
        : 'Number ranges are only available when the category variable is numeric.';
}

function getAggregatedValue(group, aggregation) {
    if (aggregation === 'count') return group.rowCount;
    if (group.values.length === 0) return 0;
    if (aggregation === 'sum') return group.values.reduce((sum, value) => sum + value, 0);
    if (aggregation === 'min') return Math.min(...group.values);
    if (aggregation === 'max') return Math.max(...group.values);
    return group.values.reduce((sum, value) => sum + value, 0) / group.values.length;
}

function sortChartRows(rows, sortMode) {
    if (sortMode === 'value_asc') return rows.sort((a, b) => a.value - b.value);
    if (sortMode === 'category_asc') {
        return rows.sort((a, b) => {
            if (a.sortValue !== null && b.sortValue !== null) return a.sortValue - b.sortValue;
            return a.label.localeCompare(b.label, undefined, { numeric: true });
        });
    }
    if (sortMode === 'label_asc') return rows.sort((a, b) => a.label.localeCompare(b.label));
    return rows.sort((a, b) => b.value - a.value);
}

function getNumberRangeLabel(value, min, max, bins = 6) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'Missing';
    if (min === max) return String(number);

    const width = (max - min) / bins;
    const index = Math.min(Math.floor((number - min) / width), bins - 1);
    const start = min + (index * width);
    const end = start + width;
    return `${Number(start.toFixed(1))} to ${Number(end.toFixed(1))}`;
}

function getCategoryLabel(row, options, numericRange) {
    const rawKey = row[options.xCol];
    if (!isPresent(rawKey)) return 'Missing';

    if (options.labelMode === 'ranges' || (options.labelMode === 'auto' && numericRange)) {
        return getNumberRangeLabel(rawKey, numericRange.min, numericRange.max);
    }

    return String(rawKey).trim();
}

function getCategorySortValue(rawValue, fallbackLabel, numericRange) {
    if (!isPresent(rawValue)) return null;
    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue)) return numericValue;

    const parsedDate = Date.parse(String(rawValue).trim());
    if (Number.isFinite(parsedDate)) return parsedDate;

    if (numericRange) {
        const match = String(fallbackLabel).match(/^-?\d+(\.\d+)?/);
        if (match) return Number(match[0]);
    }

    return null;
}

function buildChartDataset(data, options) {
    const grouped = new Map();
    const numericXValues = data.rows
        .map(row => Number(row[options.xCol]))
        .filter(Number.isFinite);
    const uniqueNumericX = new Set(numericXValues).size;
    const shouldUseRanges = numericXValues.length > 0
        && uniqueNumericX > 10
        && (options.labelMode === 'auto' || options.labelMode === 'ranges');
    const numericRange = shouldUseRanges
        ? { min: Math.min(...numericXValues), max: Math.max(...numericXValues) }
        : null;

    data.rows.forEach(row => {
        const key = getCategoryLabel(row, options, numericRange);
        const rawValue = row[options.yCol];
        const numericValue = Number(rawValue);

        if (!grouped.has(key)) {
            grouped.set(key, { rowCount: 0, values: [], sortValues: [] });
        }

        const group = grouped.get(key);
        group.rowCount += 1;
        if (Number.isFinite(numericValue)) {
            group.values.push(numericValue);
        }

        const sortValue = getCategorySortValue(row[options.xCol], key, numericRange);
        if (sortValue !== null) {
            group.sortValues.push(sortValue);
        }
    });

    const aggregated = Array.from(grouped.entries()).map(([label, group]) => ({
        label,
        value: Number(getAggregatedValue(group, options.aggregation).toFixed(2)),
        rowCount: group.rowCount,
        sortValue: group.sortValues.length > 0 ? Math.min(...group.sortValues) : null
    }));

    return sortChartRows(aggregated, options.sortMode).slice(0, options.limit);
}

function generateCharts(data) {
    showChartLoadingState();

    requestAnimationFrame(() => {
        window.setTimeout(() => {
            try {
                renderGeneratedCharts(data);
            } catch (error) {
                console.error('Chart generation error:', error);
                showChartError('Could not generate the charts. Please check that the selected columns have usable values and try another setup.');
            }
        }, 180);
    });
}

function renderGeneratedCharts(data) {
    const selectedYCols = getSelectedValueColumns();
    const options = {
        xCol: document.getElementById('chart-x-column').value,
        yCol: selectedYCols[0] || getFirstValueColumn(),
        labelMode: document.getElementById('chart-label-mode').value,
        aggregation: document.getElementById('chart-aggregation').value,
        limit: Number(document.getElementById('chart-limit').value),
        sortMode: document.getElementById('chart-sort').value,
        paletteName: document.getElementById('chart-palette').value
    };

    const numericCols = getNumericColumns(data.columns || [], data.rows || []);
    const warningEl = document.getElementById('charts-warning');
    let warning = '';
    let valueColumns = selectedYCols.filter(col => numericCols.includes(col));

    if (options.aggregation === 'count') {
        valueColumns = [];
    } else if (valueColumns.length === 0) {
        warning = 'No fully numeric value variable was selected, so the dashboard used Count Rows instead.';
        options.aggregation = 'count';
    } else if (valueColumns.length < selectedYCols.length) {
        const skipped = selectedYCols.filter(col => !numericCols.includes(col));
        warning = `Skipped non-numeric value variables: ${skipped.join(', ')}.`;
    }

    const chartSeries = options.aggregation === 'count'
        ? [{ column: null, label: 'Number of Rows', rows: buildChartDataset(data, options) }]
        : valueColumns.map(col => ({
            column: col,
            label: toTitleText(col),
            rows: buildChartDataset(data, { ...options, yCol: col })
        }));

    if (chartSeries.length === 0 || chartSeries.every(series => series.rows.length === 0)) {
        showChartError('No chartable values were found for this setup. Try another category column or use Count Rows.');
        return;
    }

    const chartRows = chartSeries[0].rows;
    const labels = chartRows.map(item => item.label);
    if (labels.length === 0) {
        showChartError('No category groups were found for this setup. Try another category variable.');
        return;
    }

    if (chartSeries.length > 1) {
        chartSeries.slice(1).forEach(series => {
            const rowsByLabel = new Map(series.rows.map(item => [item.label, item]));
            series.rows = labels.map(label => rowsByLabel.get(label) || {
                label,
                value: 0,
                rowCount: 0,
                sortValue: null
            });
        });
    }
    const palette = chartPalettes[options.paletteName] || chartPalettes.mixed;
    const colors = labels.map((_, i) => palette[i % palette.length]);
    const categoryLabel = toTitleText(options.xCol);
    const valueLabel = options.aggregation === 'count'
        ? 'Number of Rows'
        : chartSeries.map(series => series.label).join(', ');
    const calculationLabel = toTitleText(options.aggregation);
    const metricLabel = options.aggregation === 'count'
        ? `Number of Records by ${categoryLabel}`
        : `${calculationLabel} ${chartSeries.length > 1 ? 'Values' : valueLabel} by ${categoryLabel}`;
    const pieSeries = chartSeries[0];
    const pieValues = pieSeries.rows.map(item => item.value);
    const pieMetricLabel = options.aggregation === 'count'
        ? metricLabel
        : `${calculationLabel} ${pieSeries.label} by ${categoryLabel}`;

    document.getElementById('charts-area').style.display = 'block';
    document.getElementById('charts-empty').style.display = 'none';
    warningEl.style.display = warning ? 'block' : 'none';
    warningEl.textContent = warning;
    document.getElementById('charts-summary').textContent =
        `This dashboard groups records by ${categoryLabel} and shows ${options.aggregation === 'count' ? 'how many records are in each group' : `${calculationLabel.toLowerCase()} ${valueLabel}`} for the top ${labels.length} groups.`;
    document.getElementById('bar-chart-title').textContent = `Bar Chart - ${metricLabel}`;
    document.getElementById('line-chart-title').textContent = `Line Chart - ${metricLabel}`;
    document.getElementById('pie-chart-title').textContent = `Pie Chart - ${pieMetricLabel}`;

    if (typeof Chart === 'undefined') {
        renderFallbackCharts(labels, chartSeries, colors);
        hideChartLoadingState();
        return;
    }

    resetChartCanvasWraps();
    renderBarChart(labels, chartSeries, palette, metricLabel, categoryLabel, valueLabel);
    renderLineChart(labels, chartSeries, palette, metricLabel, categoryLabel, valueLabel);
    renderPieChart(labels, pieValues, colors);
    hideChartLoadingState();
}

function sharedScaleOptions(categoryLabel, valueLabel) {
    return {
        x: {
            title: { display: true, text: categoryLabel, color: '#374151', font: { size: 12, weight: '600' } },
            grid: { display: false },
            ticks: { maxRotation: 35, font: { size: 11 } }
        },
        y: {
            title: { display: true, text: valueLabel, color: '#374151', font: { size: 12, weight: '600' } },
            grid: { color: '#f3f4f6' },
            ticks: { font: { size: 11 } },
            beginAtZero: true
        }
    };
}

function buildSeriesDatasets(chartSeries, palette, type) {
    return chartSeries.map((series, index) => {
        const color = palette[index % palette.length];
        const base = {
            label: series.label,
            data: series.rows.map(item => item.value)
        };

        if (type === 'line') {
            return {
                ...base,
                borderColor: color,
                backgroundColor: `${color}22`,
                borderWidth: 2.5,
                pointBackgroundColor: color,
                pointRadius: 4,
                fill: chartSeries.length === 1,
                tension: 0.35
            };
        }

        return {
            ...base,
            backgroundColor: chartSeries.length === 1
                ? series.rows.map((_, colorIndex) => palette[colorIndex % palette.length])
                : color,
            borderRadius: 6,
            borderSkipped: false
        };
    });
}

function getFallbackRows(chartSeries) {
    const firstSeries = chartSeries[0] || { rows: [] };
    return firstSeries.rows.slice(0, 12);
}

function renderFallbackBars(rows, colors) {
    const max = Math.max(...rows.map(row => Math.abs(row.value)), 1);
    return `
        <div class="chart-fallback-bars">
            ${rows.map((row, index) => {
                const width = Math.max((Math.abs(row.value) / max) * 100, 3);
                return `
                    <div class="chart-fallback-row">
                        <span class="chart-fallback-label" title="${escapeChartHtml(row.label)}">${escapeChartHtml(row.label)}</span>
                        <div class="chart-fallback-track">
                            <span class="chart-fallback-bar" style="width:${width}%; background:${colors[index % colors.length]}"></span>
                        </div>
                        <span class="chart-fallback-value">${row.value}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderFallbackLine(rows, colors) {
    const values = rows.map(row => Number(row.value));
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = max - min || 1;
    const points = rows.map((row, index) => {
        const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
        const y = 88 - (((row.value - min) / range) * 76);
        return `${x},${y}`;
    }).join(' ');

    return `
        <div class="chart-fallback-line">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Line chart preview">
                <polyline points="${points}" fill="none" stroke="${colors[0] || '#16a34a'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
            </svg>
            <div class="chart-fallback-axis">
                <span>${escapeChartHtml(rows[0]?.label || '')}</span>
                <span>${escapeChartHtml(rows[rows.length - 1]?.label || '')}</span>
            </div>
        </div>
    `;
}

function renderFallbackPie(rows, colors) {
    const positiveRows = rows.filter(row => row.value > 0);
    const total = positiveRows.reduce((sum, row) => sum + row.value, 0);

    if (total <= 0) {
        return renderFallbackBars(rows, colors);
    }

    let cursor = 0;
    const segments = positiveRows.map((row, index) => {
        const start = cursor;
        cursor += (row.value / total) * 100;
        return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });

    return `
        <div class="chart-fallback-pie">
            <div class="chart-fallback-pie-shape" style="background:conic-gradient(${segments.join(', ')})"></div>
            <div class="chart-fallback-legend">
                ${positiveRows.slice(0, 8).map((row, index) => `
                    <div class="chart-fallback-legend-item">
                        <span style="background:${colors[index % colors.length]}"></span>
                        <strong title="${escapeChartHtml(row.label)}">${escapeChartHtml(row.label)}</strong>
                        <em>${Math.round((row.value / total) * 100)}%</em>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderFallbackCharts(labels, chartSeries, colors) {
    destroyChartInstances();
    const rows = getFallbackRows(chartSeries);
    const barWrap = document.getElementById('bar-chart-wrap');
    const lineWrap = document.getElementById('line-chart-wrap');
    const pieWrap = document.getElementById('pie-chart-wrap');

    if (barWrap) barWrap.innerHTML = renderFallbackBars(rows, colors);
    if (lineWrap) lineWrap.innerHTML = renderFallbackLine(rows, colors);
    if (pieWrap) pieWrap.innerHTML = renderFallbackPie(rows, colors);
}

function renderBarChart(labels, chartSeries, palette, metricLabel, categoryLabel, valueLabel) {
    if (barChartInstance) barChartInstance.destroy();
    const barCtx = document.getElementById('bar-chart').getContext('2d');
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels,
            datasets: buildSeriesDatasets(chartSeries, palette, 'bar')
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: chartSeries.length > 1 },
                tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } }
            },
            scales: sharedScaleOptions(categoryLabel, valueLabel)
        }
    });
}

function renderLineChart(labels, chartSeries, palette, metricLabel, categoryLabel, valueLabel) {
    if (lineChartInstance) lineChartInstance.destroy();
    const lineCtx = document.getElementById('line-chart').getContext('2d');
    lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels,
            datasets: buildSeriesDatasets(chartSeries, palette, 'line')
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: chartSeries.length > 1 },
                tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } }
            },
            scales: sharedScaleOptions(categoryLabel, valueLabel)
        }
    });
}

function renderPieChart(labels, values, colors) {
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
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((sum, value) => sum + value, 0);
                            const percent = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                            return ` ${ctx.label}: ${ctx.parsed} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}
