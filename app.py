from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import json
import os
import io
import time

app = Flask(__name__, static_folder='statics', static_url_path='/statics')

MISSING_MARKERS = ['', ' ', 'NA', 'N/A', 'NULL', 'None', 'none', 'null', 'nan', 'NaN']


@app.context_processor
def inject_static_version():
    return {'static_version': int(time.time())}


def normalize_missing_values(df):
    return df.replace(MISSING_MARKERS, pd.NA).replace(r'^\s*$', pd.NA, regex=True)


def validate_column(df, column):
    if column not in df.columns:
        raise ValueError(f'Column "{column}" was not found in the dataset')


def numeric_series_for_cleaning(series):
    numeric = pd.to_numeric(series, errors='coerce')
    non_missing = series.notna()
    invalid_count = int((non_missing & numeric.isna()).sum())
    return numeric, invalid_count


def build_dataset_payload(df, message=None):
    df = normalize_missing_values(df.copy())
    total_rows = len(df)
    total_columns = len(df.columns)
    total_missing = int(df.isnull().sum().sum())
    total_duplicates = int(df.duplicated().sum())

    clean_df = df.where(pd.notnull(df), None)
    rows = json.loads(clean_df.to_json(orient='records', date_format='iso'))

    column_details = []
    for col in df.columns:
        missing_count = int(df[col].isnull().sum())
        missing_percent = round((missing_count / total_rows) * 100, 2) if total_rows > 0 else 0
        column_details.append({
            'name': col,
            'dtype': str(df[col].dtype),
            'missing': missing_count,
            'missing_percent': missing_percent,
            'unique': int(df[col].nunique())
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

    payload = {
        'columns': df.columns.tolist(),
        'rows': rows,
        'total_rows': total_rows,
        'total_columns': total_columns,
        'total_missing': total_missing,
        'total_duplicates': total_duplicates,
        'column_details': column_details,
        'stats': stats
    }

    if message is not None:
        payload['message'] = message

    return payload


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

    return jsonify(build_dataset_payload(df))

@app.route('/clean', methods=['POST'])
def clean():
    data = request.get_json()
    
    # Rebuild dataframe from the rows sent by frontend
    df = normalize_missing_values(pd.DataFrame(data['rows']))
    action = data['action']
    result_message = ''

    # ─── 1. Handle Missing Values ───────────────────────────
    if action == 'missing':
        column = data['column']
        method = data['method']
        before = int(df.isnull().sum().sum())
        before_rows = len(df)

        if column == 'all':
            cols = list(df.columns)
        else:
            try:
                validate_column(df, column)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
            cols = [column]

        skipped = []
        for col in cols:
            if method == 'drop':
                df = df.dropna(subset=[col])
            elif method == 'mean':
                numeric, invalid_count = numeric_series_for_cleaning(df[col])
                if invalid_count > 0 or numeric.dropna().empty:
                    skipped.append(col)
                    continue
                df[col] = numeric.fillna(numeric.mean())
            elif method == 'median':
                numeric, invalid_count = numeric_series_for_cleaning(df[col])
                if invalid_count > 0 or numeric.dropna().empty:
                    skipped.append(col)
                    continue
                df[col] = numeric.fillna(numeric.median())
            elif method == 'mode':
                mode_values = df[col].mode(dropna=True)
                if not mode_values.empty:
                    df[col] = df[col].fillna(mode_values.iloc[0])
            elif method == 'custom':
                df[col] = df[col].fillna(data['custom_value'])
            else:
                return jsonify({'error': f'Unsupported missing-value method: {method}'}), 400

        if skipped and len(skipped) == len(cols):
            return jsonify({'error': 'Mean/median can only be applied to numeric columns or numeric-looking values'}), 400

        after = int(df.isnull().sum().sum())
        removed_rows = before_rows - len(df)
        fixed = before - after
        result_message = f'Missing values reduced from {before} to {after}; {fixed} cells filled or cleared'
        if removed_rows:
            result_message += f'; {removed_rows} rows removed'
        if skipped:
            result_message += f'; skipped non-numeric columns: {", ".join(skipped)}'

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
        result_message = f'Removed {removed} duplicate rows ({before} to {after} rows)'

    # ─── 3. Convert Data Types ───────────────────────────────
    elif action == 'dtype':
        column = data['column']
        target = data['target']

        try:
            validate_column(df, column)
            before_missing = int(df[column].isnull().sum())
            if target == 'string':
                df[column] = df[column].astype('string')
            elif target == 'integer':
                df[column] = pd.to_numeric(df[column], errors='coerce').astype('Int64')
            elif target == 'float':
                df[column] = pd.to_numeric(df[column], errors='coerce')
            elif target == 'datetime':
                df[column] = pd.to_datetime(df[column], errors='coerce')
            elif target == 'boolean':
                bool_map = {
                    'true': True, 'yes': True, 'y': True, '1': True,
                    'false': False, 'no': False, 'n': False, '0': False
                }
                normalized = df[column].astype('string').str.strip().str.lower()
                df[column] = normalized.map(bool_map)
            else:
                return jsonify({'error': f'Unsupported target data type: {target}'}), 400

            after_missing = int(df[column].isnull().sum())
            new_invalid = max(after_missing - before_missing, 0)
            result_message = f'Column "{column}" converted to {target}'
            if new_invalid:
                result_message += f'; {new_invalid} invalid values became blank'
        except Exception as e:
            return jsonify({'error': str(e)}), 400

    # ─── 4. Standardize Formats ──────────────────────────────
    elif action == 'format':
        column = data['column']
        method = data['method']
        try:
            validate_column(df, column)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        if df[column].dtype == object or pd.api.types.is_string_dtype(df[column]):
            before_values = df[column].copy()
            text_series = df[column].astype('string')
            if method == 'uppercase':
                df[column] = text_series.str.upper()
            elif method == 'lowercase':
                df[column] = text_series.str.lower()
            elif method == 'titlecase':
                df[column] = text_series.str.strip().str.replace(r'\s+', ' ', regex=True).str.title()
            elif method == 'strip':
                df[column] = text_series.str.strip().str.replace(r'\s+', ' ', regex=True)
            else:
                return jsonify({'error': f'Unsupported format method: {method}'}), 400

            changed = int((before_values.astype('string') != df[column].astype('string')).fillna(False).sum())
            result_message = f'Column "{column}" formatted to {method}; {changed} cells changed'
        else:
            return jsonify({'error': f'Column "{column}" is not a text column'}), 400

    # ─── 5. Filter Invalid Data ──────────────────────────────
    elif action == 'filter':
        column = data['column']
        condition = data['condition']
        value = data['value']
        before = len(df)

        try:
            validate_column(df, column)
            if condition == 'greater_than':
                df = df[pd.to_numeric(df[column], errors='coerce') > float(value)]
            elif condition == 'less_than':
                df = df[pd.to_numeric(df[column], errors='coerce') < float(value)]
            elif condition == 'equals':
                df = df[df[column].astype(str) == str(value)]
            elif condition == 'not_equals':
                df = df[df[column].astype(str) != str(value)]
            elif condition == 'contains':
                df = df[df[column].astype(str).str.contains(value, na=False, regex=False)]
            elif condition == 'not_contains':
                df = df[~df[column].astype(str).str.contains(value, na=False, regex=False)]
            elif condition == 'is_empty':
                df = df[df[column].isna()]
            elif condition == 'not_empty':
                df = df[df[column].notna()]
            else:
                return jsonify({'error': f'Unsupported filter condition: {condition}'}), 400

            after = len(df)
            removed = before - after
            result_message = f'Filtered "{column}": {before} to {after} rows remaining; {removed} rows removed'
        except Exception as e:
            return jsonify({'error': str(e)}), 400

    else:
        return jsonify({'error': f'Unsupported cleaning action: {action}'}), 400

    # ─── Send back cleaned data ──────────────────────────────
    df = df.where(pd.notnull(df), None)

    return jsonify(build_dataset_payload(df, result_message))

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
