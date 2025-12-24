"""
Test API endpoint directly
"""
import requests
import json

API_URL = 'http://localhost:5000/api/auth/login'

# Test data
test_data = {
    'password': 'gm25_01_a_snake-out-escape-maze'
}

print("=" * 50)
print("Testing API Endpoint")
print("=" * 50)

try:
    print(f"\nSending POST to: {API_URL}")
    print(f"Payload: {json.dumps(test_data, indent=2)}")
    
    response = requests.post(
        API_URL,
        json=test_data,
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
except requests.exceptions.ConnectionError:
    print("\n❌ ERROR: Cannot connect to server")
    print("   Make sure server is running: python run.py")
except Exception as e:
    print(f"\n❌ ERROR: {e}")

print("\n" + "=" * 50)

