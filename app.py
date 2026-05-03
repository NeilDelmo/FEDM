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
    preview_df = df.head(100)
    # Use pandas JSON serializer so NaN/NaT become JSON null values.
    rows = json.loads(preview_df.to_json(orient='records', date_format='iso'))
    
    return jsonify({
        'columns': preview_df.columns.tolist(),
        'rows': rows,
        'total_rows': total_rows
    })


if __name__ == '__main__':
	app.run(debug=True)
