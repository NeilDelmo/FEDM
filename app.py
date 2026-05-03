from flask import Flask, render_template, request, jsonify
import pandas as pd
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
	if file.filename == '':
		return jsonify({'error': 'No file selected for uploading'
        }), 400
	file = request.files['file']
	
    filename = file.filename.lower()

	if filename.endswith('.csv'):
		df = pd.read_csv(file)
	else:
		df = pd.read_excel(file)
		
	df = df.where(pd.notnull(df), None)
	total_rows = len(df)
	preview_df = df.head(100)
	return jsonify ({
		'columns': df.columns.tolist(),
		'rows': preview_df.to_dict(orient='records'),
		'total_rows': total_rows
	})


if __name__ == '__main__':
	app.run(debug=True)
