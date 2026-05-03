from flask import Flask, render_template, request, jsonify
import pandas as pd
import json
import os


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


if __name__ == '__main__':
	app.run(debug=True)
