"""
Authentication module - supports multiple auth methods
"""
# Lazy imports to avoid loading unnecessary dependencies
def get_simple_auth():
    from .simple_auth import SimpleAuth
    return SimpleAuth

def get_jwt_auth():
    from .jwt_auth import JWTAuth
    return JWTAuth

def get_oauth_auth():
    from .oauth_auth import OAuthAuth
    return OAuthAuth

__all__ = ['get_simple_auth', 'get_jwt_auth', 'get_oauth_auth']

