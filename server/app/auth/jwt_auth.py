"""
Option 2: JWT Token Authentication
User accounts with JWT tokens - recommended for production
"""
import os
import jwt
import hashlib
import sqlite3
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from pathlib import Path

class JWTAuth:
    """JWT-based authentication with user management"""
    
    def __init__(self, secret_key=None, db_path='users.db'):
        """
        Initialize JWT auth
        Args:
            secret_key: JWT secret key (defaults to env or generated)
            db_path: Path to SQLite database
        """
        self.secret_key = secret_key or os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database for users"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def _hash_password(password: str) -> str:
        """Hash password using SHA256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def register_user(self, username: str, password: str) -> dict:
        """
        Register a new user
        Returns: {'success': bool, 'message': str, 'user_id': int}
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if username exists
            cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
            if cursor.fetchone():
                conn.close()
                return {'success': False, 'message': 'Username already exists'}
            
            # Create user
            password_hash = self._hash_password(password)
            cursor.execute(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                (username, password_hash)
            )
            user_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return {
                'success': True,
                'message': 'User registered successfully',
                'user_id': user_id
            }
        except Exception as e:
            return {'success': False, 'message': f'Registration failed: {str(e)}'}
    
    def login(self, username: str, password: str) -> dict:
        """
        Authenticate user and return JWT token
        Returns: {'success': bool, 'message': str, 'token': str, 'user': dict}
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Find user
            cursor.execute(
                'SELECT id, username, password_hash FROM users WHERE username = ?',
                (username,)
            )
            user = cursor.fetchone()
            
            if not user:
                conn.close()
                return {'success': False, 'message': 'Invalid username or password'}
            
            user_id, db_username, password_hash = user
            
            # Verify password
            if self._hash_password(password) != password_hash:
                conn.close()
                return {'success': False, 'message': 'Invalid username or password'}
            
            # Update last login
            cursor.execute(
                'UPDATE users SET last_login = ? WHERE id = ?',
                (datetime.now().isoformat(), user_id)
            )
            conn.commit()
            conn.close()
            
            # Generate JWT token
            token = self._generate_token(user_id, username)
            
            return {
                'success': True,
                'message': 'Login successful',
                'token': token,
                'user': {
                    'id': user_id,
                    'username': username
                }
            }
        except Exception as e:
            return {'success': False, 'message': f'Login failed: {str(e)}'}
    
    def _generate_token(self, user_id: int, username: str, expires_in_days: int = 7) -> str:
        """Generate JWT token"""
        payload = {
            'user_id': user_id,
            'username': username,
            'exp': datetime.utcnow() + timedelta(days=expires_in_days),
            'iat': datetime.utcnow()
        }
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    def verify_token(self, token: str) -> dict:
        """
        Verify JWT token
        Returns: {'valid': bool, 'user_id': int, 'username': str} or None
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return {
                'valid': True,
                'user_id': payload['user_id'],
                'username': payload['username']
            }
        except jwt.ExpiredSignatureError:
            return {'valid': False, 'error': 'Token expired'}
        except jwt.InvalidTokenError:
            return {'valid': False, 'error': 'Invalid token'}
    
    def require_auth(self, f):
        """Decorator to protect routes with JWT auth"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get token from header
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({'error': 'Authentication required'}), 401
            
            # Extract token
            try:
                token = auth_header.split(' ')[1]  # Remove 'Bearer ' prefix
            except IndexError:
                return jsonify({'error': 'Invalid authorization header'}), 401
            
            # Verify token
            result = self.verify_token(token)
            if not result.get('valid'):
                return jsonify({'error': result.get('error', 'Invalid token')}), 401
            
            # Add user info to request context
            request.current_user = {
                'user_id': result['user_id'],
                'username': result['username']
            }
            
            return f(*args, **kwargs)
        return decorated_function

