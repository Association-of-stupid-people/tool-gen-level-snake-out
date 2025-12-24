"""
Authentication API routes
Supports multiple auth methods based on configuration
"""
from flask import Blueprint, request, jsonify
import os

auth_bp = Blueprint('auth', __name__)

# Initialize auth based on environment (lazy import)
AUTH_METHOD = os.getenv('AUTH_METHOD', 'simple').lower()

if AUTH_METHOD == 'simple':
    from app.auth.simple_auth import SimpleAuth
    auth_handler = SimpleAuth()
elif AUTH_METHOD == 'jwt':
    from app.auth.jwt_auth import JWTAuth
    auth_handler = JWTAuth()
elif AUTH_METHOD == 'oauth':
    from app.auth.oauth_auth import OAuthAuth
    provider = os.getenv('OAUTH_PROVIDER', 'google')
    auth_handler = OAuthAuth(provider=provider)
else:
    from app.auth.simple_auth import SimpleAuth
    auth_handler = SimpleAuth()  # Default


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login endpoint - works for both simple and JWT auth"""
    try:
        data = request.get_json()
        
        if AUTH_METHOD == 'simple':
            # Simple password auth
            password = data.get('password', '').strip()  # Remove whitespace
            print(f"[DEBUG] Received password: '{password}' (length: {len(password)})")
            result = auth_handler.login(password)
            print(f"[DEBUG] Login result: {result}")
            return jsonify(result)
        
        elif AUTH_METHOD == 'jwt':
            # JWT username/password auth
            username = data.get('username', '')
            password = data.get('password', '')
            
            if not username or not password:
                return jsonify({
                    'success': False,
                    'message': 'Username and password required'
                }), 400
            
            result = auth_handler.login(username, password)
            if result['success']:
                return jsonify(result)
            else:
                return jsonify(result), 401
        
        else:
            return jsonify({'success': False, 'message': 'Unsupported auth method'}), 400
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register endpoint - only for JWT auth"""
    if AUTH_METHOD != 'jwt':
        return jsonify({
            'success': False,
            'message': 'Registration only available with JWT authentication'
        }), 400
    
    try:
        data = request.get_json()
        username = data.get('username', '')
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({
                'success': False,
                'message': 'Username and password required'
            }), 400
        
        if len(password) < 6:
            return jsonify({
                'success': False,
                'message': 'Password must be at least 6 characters'
            }), 400
        
        result = auth_handler.register_user(username, password)
        if result['success']:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@auth_bp.route('/verify', methods=['POST'])
def verify():
    """Verify token endpoint"""
    try:
        data = request.get_json()
        token = data.get('token', '')
        expires_at = data.get('expires_at')
        
        if not token:
            return jsonify({'valid': False, 'error': 'Token required'}), 400
        
        if AUTH_METHOD == 'simple':
            expires_at_int = int(expires_at) if expires_at else None
            result = auth_handler.verify_token(token, expires_at_int)
            return jsonify(result)
        
        elif AUTH_METHOD == 'jwt':
            result = auth_handler.verify_token(token)
            return jsonify(result)
        
        else:
            return jsonify({'valid': False, 'error': 'Unsupported auth method'}), 400
    
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 500


@auth_bp.route('/oauth/authorize', methods=['GET'])
def oauth_authorize():
    """OAuth authorization endpoint"""
    if AUTH_METHOD != 'oauth':
        return jsonify({'error': 'OAuth not configured'}), 400
    
    state = request.args.get('state', 'default')
    auth_url = auth_handler.get_auth_url(state)
    return jsonify({'auth_url': auth_url})


@auth_bp.route('/oauth/callback', methods=['GET'])
def oauth_callback():
    """OAuth callback endpoint"""
    if AUTH_METHOD != 'oauth':
        return jsonify({'error': 'OAuth not configured'}), 400
    
    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'Authorization code missing'}), 400
    
    # Exchange code for token
    token_result = auth_handler.exchange_code_for_token(code)
    if not token_result['success']:
        return jsonify({'error': token_result.get('error')}), 400
    
    # Get user info
    user_result = auth_handler.get_user_info(token_result['access_token'])
    if not user_result['success']:
        return jsonify({'error': user_result.get('error')}), 400
    
    # In production, you'd create/update user in database and return JWT
    return jsonify({
        'success': True,
        'user': user_result['user'],
        'message': 'OAuth authentication successful'
    })


@auth_bp.route('/method', methods=['GET'])
def get_auth_method():
    """Get current authentication method"""
    return jsonify({
        'method': AUTH_METHOD,
        'requires_username': AUTH_METHOD == 'jwt',
        'supports_registration': AUTH_METHOD == 'jwt',
        'supports_oauth': AUTH_METHOD == 'oauth'
    })

