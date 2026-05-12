from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import json
import os
import io

app = Flask(__name__, static_folder='statics', static_url_path='/statics')


@app.route('/')
def home():
	return render_template('login.html')


@app.route('/login')
def login():
	return render_template('login.html')


@app.route('/upload_module')
def upload_module():
	return render_template('upload_module.html')

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected for uploading'}), 400
    
    filename = file.filename.lower()

    if filename.endswith('.csv'):
        df = pd.read_csv(file)
    else:
        df = pd.read_excel(file)

    total_rows = len(df)
    total_columns = len(df.columns)
    total_missing = int(df.isnull().sum().sum())
    total_duplicates = int(df.duplicated().sum())
    preview_df = df.head(100)
    # Use pandas JSON serializer so NaN/NaT become JSON null values.
    rows = json.loads(preview_df.to_json(orient='records', date_format='iso'))

    column_details = []
    for col in df.columns:
        missing_count = int(df[col].isnull().sum())
        missing_percent = round((missing_count / total_rows) * 100, 2) if total_rows > 0 else 0
        unique_count = int(df[col].nunique())
        dtype = str(df[col].dtype)
        column_details.append({
            'name': col,
            'dtype': dtype,
            'missing': missing_count,
            'missing_percent': missing_percent,
            'unique': unique_count
        })

    stats = []
    numeric_cols = df.select_dtypes(include='number').columns
    for col in numeric_cols:
        stats.append({
            'column': col,
            'min': round(float(df[col].min()), 2) if pd.notnull(df[col].min()) else None,
            'max': round(float(df[col].max()), 2) if pd.notnull(df[col].max()) else None,
            'mean': round(float(df[col].mean()), 2) if pd.notnull(df[col].mean()) else None,
            'median': round(float(df[col].median()), 2) if pd.notnull(df[col].median()) else None,
            'std': round(float(df[col].std()), 2) if pd.notnull(df[col].std()) else None,
        })
    
    return jsonify({
        'columns': preview_df.columns.tolist(),
        'rows': rows,
        'total_rows': total_rows,
        'total_columns': total_columns,
        'total_missing': total_missing,
        'total_duplicates': total_duplicates,
        'column_details': column_details,
        'stats': stats
    })

@app.route('/clean', methods=['POST'])
def clean():
    data = request.get_json()
    
    # Rebuild dataframe from the rows sent by frontend
    df = pd.DataFrame(data['rows'])
    action = data['action']
    result_message = ''

    # ─── 1. Handle Missing Values ───────────────────────────
    if action == 'missing':
        column = data['column']
        method = data['method']
        before = int(df.isnull().sum().sum())

        if column == 'all':
            cols = df.columns
        else:
            cols = [column]

        for col in cols:
            if method == 'drop':
                df = df.dropna(subset=[col])
            elif method == 'mean':
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].mean())
            elif method == 'median':
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].median())
            elif method == 'mode':
                df[col] = df[col].fillna(df[col].mode()[0])
            elif method == 'custom':
                df[col] = df[col].fillna(data['custom_value'])

        after = int(df.isnull().sum().sum())
        result_message = f'Missing values reduced from {before} to {after}'

    # ─── 2. Remove Duplicates ────────────────────────────────
    elif action == 'duplicates':
        keep = data['keep']
        before = len(df)

        if keep == 'false':
            df = df.drop_duplicates(keep=False)
        else:
            df = df.drop_duplicates(keep=keep)

        after = len(df)
        removed = before - after
        result_message = f'Removed {removed} duplicate rows ({before} → {after} rows)'

    # ─── 3. Convert Data Types ───────────────────────────────
    elif action == 'dtype':
        column = data['column']
        target = data['target']

        try:
            if target == 'string':
                df[column] = df[column].astype(str)
            elif target == 'integer':
                df[column] = pd.to_numeric(df[column], errors='coerce').astype('Int64')
            elif target == 'float':
                df[column] = pd.to_numeric(df[column], errors='coerce')
            elif target == 'datetime':
                df[column] = pd.to_datetime(df[column], errors='coerce')
            elif target == 'boolean':
                df[column] = df[column].astype(bool)

            result_message = f'Column "{column}" converted to {target}'
        except Exception as e:
            return jsonify({'error': str(e)}), 400

    # ─── 4. Standardize Formats ──────────────────────────────
    elif action == 'format':
        column = data['column']
        method = data['method']

        if df[column].dtype == object:
            if method == 'uppercase':
                df[column] = df[column].str.upper()
            elif method == 'lowercase':
                df[column] = df[column].str.lower()
            elif method == 'titlecase':
                df[column] = df[column].str.title()
            elif method == 'strip':
                df[column] = df[column].str.strip()

            result_message = f'Column "{column}" formatted to {method}'
        else:
            return jsonify({'error': f'Column "{column}" is not a text column'}), 400

    # ─── 5. Filter Invalid Data ──────────────────────────────
    elif action == 'filter':
        column = data['column']
        condition = data['condition']
        value = data['value']
        before = len(df)

        try:
            if condition == 'greater_than':
                df = df[pd.to_numeric(df[column], errors='coerce') > float(value)]
            elif condition == 'less_than':
                df = df[pd.to_numeric(df[column], errors='coerce') < float(value)]
            elif condition == 'equals':
                df = df[df[column].astype(str) == str(value)]
            elif condition == 'not_equals':
                df = df[df[column].astype(str) != str(value)]
            elif condition == 'contains':
                df = df[df[column].astype(str).str.contains(value, na=False)]
            elif condition == 'not_contains':
                df = df[~df[column].astype(str).str.contains(value, na=False)]

            after = len(df)
            result_message = f'Filtered "{column}": {before} → {after} rows remaining'
        except Exception as e:
            return jsonify({'error': str(e)}), 400

    # ─── Send back cleaned data ──────────────────────────────
    df = df.where(pd.notnull(df), None)
    rows = json.loads(df.to_json(orient='records', date_format='iso'))

    return jsonify({
        'columns': df.columns.tolist(),
        'rows': rows,
        'total_rows': len(df),
        'message': result_message
    })

@app.route('/export', methods=['POST'])
def export():
    data = request.get_json()
    df = pd.DataFrame(data['rows'])[data['columns']]
    format = data['format']

    if format == 'csv':
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name='cleaned_data.csv'
        )
    else:
        output = io.BytesIO()
        df.to_excel(output, index=False)
        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='cleaned_data.xlsx'
        )
@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    df = pd.DataFrame(data['rows'])

    total_rows = len(df)
    total_columns = len(df.columns)
    total_missing = int(df.isnull().sum().sum())
    total_cells = total_rows * total_columns
    completeness = round(((total_cells - total_missing) / total_cells) * 100, 1) if total_cells > 0 else 100

    numeric_cols = df.select_dtypes(include='number').columns.tolist()
    text_cols = df.select_dtypes(include='object').columns.tolist()

    # ── Numeric Statistics ────────────────────────────────
    numeric_stats = []
    for col in numeric_cols:
        mode_val = df[col].mode()
        numeric_stats.append({
            'column': col,
            'min': round(float(df[col].min()), 2) if pd.notnull(df[col].min()) else None,
            'max': round(float(df[col].max()), 2) if pd.notnull(df[col].max()) else None,
            'mean': round(float(df[col].mean()), 2) if pd.notnull(df[col].mean()) else None,
            'median': round(float(df[col].median()), 2) if pd.notnull(df[col].median()) else None,
            'std': round(float(df[col].std()), 2) if pd.notnull(df[col].std()) else None,
            'mode': round(float(mode_val[0]), 2) if len(mode_val) > 0 and pd.notnull(mode_val[0]) else None,
        })

    # ── Most Frequent Values (text + numeric) ─────────────
    frequent_values = []
    for col in df.columns:
        counts = df[col].dropna().value_counts().head(3)
        if len(counts) == 0:
            continue
        total_non_null = df[col].dropna().count()
        values = []
        for val, count in counts.items():
            pct = round((count / total_non_null) * 100, 1) if total_non_null > 0 else 0
            values.append({'value': str(val), 'count': int(count), 'percent': pct})
        frequent_values.append({'column': col, 'values': values})

    # ── Interpretations ───────────────────────────────────
    interpretations = []

    if total_missing == 0:
        interpretations.append('✅ The dataset has no missing values — it is complete and ready for analysis.')
    else:
        missing_pct = round((total_missing / total_cells) * 100, 1)
        interpretations.append(f'⚠️ The dataset has {total_missing} missing values ({missing_pct}% of all cells).')

    for col in df.columns:
        missing_count = int(df[col].isnull().sum())
        missing_pct = round((missing_count / total_rows) * 100, 1) if total_rows > 0 else 0
        if missing_pct > 30:
            interpretations.append(f'⚠️ Column "{col}" has a high missing rate of {missing_pct}% — consider dropping or imputing.')

    for col in text_cols:
        top = df[col].dropna().value_counts()
        if len(top) > 0:
            top_val = top.index[0]
            top_pct = round((top.iloc[0] / total_rows) * 100, 1)
            if top_pct > 50:
                interpretations.append(f'ℹ️ In column "{col}", the value "{top_val}" dominates at {top_pct}% of rows.')

    for col in numeric_cols:
        if df[col].std() == 0:
            interpretations.append(f'ℹ️ Column "{col}" has no variation — all values are the same.')
        elif df[col].std() > df[col].mean() * 2 and df[col].mean() != 0:
            interpretations.append(f'⚠️ Column "{col}" has high variability — there may be outliers.')

    if total_rows < 50:
        interpretations.append(f'ℹ️ The dataset is small ({total_rows} rows) — results may not be statistically significant.')

    # ── Trends & Patterns ────────────────────────────────
    trends = []

    if completeness == 100:
        trends.append({'type': 'good', 'message': 'Dataset is 100% complete with no missing values.'})
    elif completeness >= 90:
        trends.append({'type': 'info', 'message': f'Dataset is {completeness}% complete — mostly clean.'})
    else:
        trends.append({'type': 'warning', 'message': f'Dataset is only {completeness}% complete — significant missing data detected.'})

    if len(numeric_cols) > 0:
        most_variable = max(numeric_cols, key=lambda c: df[c].std() if pd.notnull(df[c].std()) else 0)
        trends.append({'type': 'info', 'message': f'Column "{most_variable}" has the highest variability among numeric columns.'})

    if len(text_cols) > 0:
        most_unique = max(text_cols, key=lambda c: df[c].nunique())
        unique_count = df[most_unique].nunique()
        trends.append({'type': 'info', 'message': f'Column "{most_unique}" has the most unique values ({unique_count}) among text columns.'})

    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        trends.append({'type': 'warning', 'message': f'{dup_count} duplicate rows still detected in the dataset.'})
    else:
        trends.append({'type': 'good', 'message': 'No duplicate rows detected.'})

    return jsonify({
        'total_rows': total_rows,
        'total_columns': total_columns,
        'total_missing': total_missing,
        'completeness': completeness,
        'numeric_columns': len(numeric_cols),
        'text_columns': len(text_cols),
        'numeric_stats': numeric_stats,
        'frequent_values': frequent_values,
        'interpretations': interpretations,
        'trends': trends
    })

if __name__ == '__main__':
	app.run(debug=True)
