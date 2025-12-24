"""
Authentication middleware - handles auth method selection
"""
import os
from flask import request, jsonify

class AuthMiddleware:
    """Middleware to handle different authentication methods"""
    
    def __init__(self):
        """Initialize with auth method from environment"""
        self.auth_method = os.getenv('AUTH_METHOD', 'simple').lower()
        
        # Lazy import - only import what's needed
        if self.auth_method == 'simple':
            from .simple_auth import SimpleAuth
            self.auth = SimpleAuth()
        elif self.auth_method == 'jwt':
            from .jwt_auth import JWTAuth
            self.auth = JWTAuth()
        elif self.auth_method == 'oauth':
            from .oauth_auth import OAuthAuth
            provider = os.getenv('OAUTH_PROVIDER', 'google')
            self.auth = OAuthAuth(provider=provider)
        else:
            raise ValueError(f"Unknown auth method: {self.auth_method}")
    
    def require_auth(self, f):
        """Decorator that uses the configured auth method"""
        return self.auth.require_auth(f)
    
    def get_auth_handler(self):
        """Get the current auth handler instance"""
        return self.auth

# Global middleware instance
auth_middleware = AuthMiddleware()

