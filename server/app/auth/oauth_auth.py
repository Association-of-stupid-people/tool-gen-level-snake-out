"""
Option 3: OAuth2 Authentication
Third-party authentication (Google, GitHub, etc.)
"""
import os
import requests
from functools import wraps
from flask import request, jsonify, redirect, url_for

class OAuthAuth:
    """OAuth2-based authentication"""
    
    def __init__(self, provider='google'):
        """
        Initialize OAuth auth
        Args:
            provider: 'google' or 'github'
        """
        self.provider = provider
        self._setup_provider()
    
    def _setup_provider(self):
        """Setup OAuth provider configuration"""
        if self.provider == 'google':
            self.client_id = os.getenv('GOOGLE_CLIENT_ID')
            self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
            self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5000/api/auth/oauth/callback')
            self.auth_url = 'https://accounts.google.com/o/oauth2/v2/auth'
            self.token_url = 'https://oauth2.googleapis.com/token'
            self.userinfo_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        elif self.provider == 'github':
            self.client_id = os.getenv('GITHUB_CLIENT_ID')
            self.client_secret = os.getenv('GITHUB_CLIENT_SECRET')
            self.redirect_uri = os.getenv('GITHUB_REDIRECT_URI', 'http://localhost:5000/api/auth/oauth/callback')
            self.auth_url = 'https://github.com/login/oauth/authorize'
            self.token_url = 'https://github.com/login/oauth/access_token'
            self.userinfo_url = 'https://api.github.com/user'
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
    
    def get_auth_url(self, state=None) -> str:
        """
        Get OAuth authorization URL
        Returns: URL to redirect user to
        """
        if self.provider == 'google':
            params = {
                'client_id': self.client_id,
                'redirect_uri': self.redirect_uri,
                'response_type': 'code',
                'scope': 'openid email profile',
                'state': state or 'default'
            }
        else:  # GitHub
            params = {
                'client_id': self.client_id,
                'redirect_uri': self.redirect_uri,
                'scope': 'user:email',
                'state': state or 'default'
            }
        
        query_string = '&'.join([f'{k}={v}' for k, v in params.items()])
        return f"{self.auth_url}?{query_string}"
    
    def exchange_code_for_token(self, code: str) -> dict:
        """
        Exchange authorization code for access token
        Returns: {'success': bool, 'access_token': str, 'error': str}
        """
        try:
            if self.provider == 'google':
                data = {
                    'code': code,
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'redirect_uri': self.redirect_uri,
                    'grant_type': 'authorization_code'
                }
                response = requests.post(self.token_url, data=data)
            else:  # GitHub
                data = {
                    'code': code,
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'redirect_uri': self.redirect_uri
                }
                headers = {'Accept': 'application/json'}
                response = requests.post(self.token_url, data=data, headers=headers)
            
            if response.status_code == 200:
                token_data = response.json()
                access_token = token_data.get('access_token')
                return {'success': True, 'access_token': access_token}
            else:
                return {'success': False, 'error': 'Failed to exchange code'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def get_user_info(self, access_token: str) -> dict:
        """
        Get user information from OAuth provider
        Returns: {'success': bool, 'user': dict, 'error': str}
        """
        try:
            if self.provider == 'google':
                headers = {'Authorization': f'Bearer {access_token}'}
                response = requests.get(self.userinfo_url, headers=headers)
            else:  # GitHub
                headers = {'Authorization': f'token {access_token}'}
                response = requests.get(self.userinfo_url, headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                if self.provider == 'google':
                    return {
                        'success': True,
                        'user': {
                            'id': user_data.get('id'),
                            'email': user_data.get('email'),
                            'name': user_data.get('name'),
                            'picture': user_data.get('picture')
                        }
                    }
                else:  # GitHub
                    return {
                        'success': True,
                        'user': {
                            'id': user_data.get('id'),
                            'email': user_data.get('email') or user_data.get('login'),
                            'name': user_data.get('name') or user_data.get('login'),
                            'avatar': user_data.get('avatar_url')
                        }
                    }
            else:
                return {'success': False, 'error': 'Failed to get user info'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def require_auth(self, f):
        """Decorator to protect routes with OAuth (requires session)"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # This would typically check session for OAuth user
            # For now, return a placeholder
            # In production, you'd check session/cookie for authenticated user
            return jsonify({'error': 'OAuth authentication required'}), 401
        return decorated_function

