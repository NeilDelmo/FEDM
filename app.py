from flask import Flask, render_template


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


if __name__ == '__main__':
	app.run(debug=True)
