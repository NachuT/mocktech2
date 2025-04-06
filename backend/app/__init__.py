from flask import Flask
from flask_cors import CORS
from .routes import api

def create_app():
    app = Flask(__name__)
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Accept"],
            "supports_credentials": False
        }
    })
    app.register_blueprint(api, url_prefix='/api')
    return app 