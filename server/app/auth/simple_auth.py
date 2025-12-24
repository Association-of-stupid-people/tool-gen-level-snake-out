"""
Option 1: Simple Password Authentication
Single password for all users - simplest approach
"""
import os
import hashlib
import time
from functools import wraps
from flask import request, jsonify

class SimpleAuth:
    """Simple password-based authentication"""
    
    def __init__(self, password_hash=None, token_timeout_hours=None):
        """
        Initialize with password hash.
        If not provided, reads from environment variable AUTH_PASSWORD
        
        Args:
            password_hash: Pre-hashed password (optional)
            token_timeout_hours: Token expiry in hours (default: 24, or from AUTH_TOKEN_TIMEOUT_HOURS)
        """
        if password_hash:
            self.password_hash = password_hash
        else:
            # Get password from env, default to project password
            password = os.getenv('AUTH_PASSWORD', 'gm25_01_a_snake-out-escape-maze')
            self.password_hash = self._hash_password(password)
        
        # Token timeout in hours (default: 24 hours)
        timeout = token_timeout_hours or int(os.getenv('AUTH_TOKEN_TIMEOUT_HOURS', '24'))
        self.token_timeout_seconds = timeout * 3600  # Convert to seconds
    
    @staticmethod
    def _hash_password(password: str) -> str:
        """Hash password using SHA256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def verify_password(self, password: str) -> bool:
        """Verify if provided password matches"""
        return self._hash_password(password) == self.password_hash
    
    def login(self, password: str) -> dict:
        """
        Verify password and return success status with token and expiry
        Returns: {'success': bool, 'message': str, 'token': str, 'expires_at': int}
        """
        if self.verify_password(password):
            current_time = int(time.time())
            expires_at = current_time + self.token_timeout_seconds
            
            return {
                'success': True,
                'message': 'Authentication successful',
                'token': 'simple_auth_token',  # Simple token for frontend
                'expires_at': expires_at,  # Unix timestamp
                'expires_in': self.token_timeout_seconds  # Seconds until expiry
            }
        return {
            'success': False,
            'message': 'Invalid password'
        }
    
    def verify_token(self, token: str, expires_at: int = None) -> dict:
        """
        Verify if token is valid and not expired
        Returns: {'valid': bool, 'error': str}
        """
        if token != 'simple_auth_token':
            return {'valid': False, 'error': 'Invalid token'}
        
        # Check expiry if provided
        if expires_at:
            current_time = int(time.time())
            if current_time > expires_at:
                return {'valid': False, 'error': 'Token expired'}
        
        return {'valid': True}
    
    def require_auth(self, f):
        """Decorator to protect routes with simple auth"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Check for token in header or request
            auth_header = request.headers.get('Authorization') or request.args.get('token')
            
            if not auth_header:
                return jsonify({'error': 'Authentication required'}), 401
            
            # Remove 'Bearer ' prefix if present
            token = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header
            
            # Get expiry from header if provided (X-Token-Expires)
            expires_at = request.headers.get('X-Token-Expires')
            expires_at_int = int(expires_at) if expires_at and expires_at.isdigit() else None
            
            # Verify token
            result = self.verify_token(token, expires_at_int)
            if not result['valid']:
                return jsonify({'error': result.get('error', 'Invalid token')}), 401
            
            return f(*args, **kwargs)
        return decorated_function

