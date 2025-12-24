from flask import Flask
from flask_cors import CORS
import os
from pathlib import Path

def create_app():
    # Load environment variables from .env file if it exists
    env_path = Path(__file__).parent.parent.parent / '.env'
    if env_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path)
        except ImportError:
            # python-dotenv not installed, skip loading .env file
            pass
    
    app = Flask(__name__)
    # Configure CORS to allow all origins (for development with ngrok)
    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Register API routes
    from .api.routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # Register auth routes
    from .api.auth_routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    return app
