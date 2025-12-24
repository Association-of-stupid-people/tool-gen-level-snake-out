"""
Test script to verify Simple Auth is working
"""
from app.auth.simple_auth import SimpleAuth

# Test password
test_password = 'gm25_01_a_snake-out-escape-maze'

print("=" * 50)
print("Testing Simple Auth")
print("=" * 50)

# Initialize auth
auth = SimpleAuth()

# Test 1: Check password hash
print(f"\n1. Testing password: '{test_password}'")
print(f"   Length: {len(test_password)}")

# Test 2: Verify password
result = auth.verify_password(test_password)
print(f"\n2. Password verification: {result}")

# Test 3: Login
login_result = auth.login(test_password)
print(f"\n3. Login result:")
print(f"   Success: {login_result['success']}")
print(f"   Message: {login_result['message']}")
print(f"   Token: {login_result.get('token', 'N/A')}")

# Test 4: Wrong password
wrong_result = auth.login('wrong_password')
print(f"\n4. Wrong password test:")
print(f"   Success: {wrong_result['success']}")
print(f"   Message: {wrong_result['message']}")

# Test 5: Password with spaces
spaced_password = '  gm25_01_a_snake-out-escape-maze  '
print(f"\n5. Testing password with spaces: '{spaced_password}'")
result_spaced = auth.login(spaced_password)
print(f"   Success: {result_spaced['success']}")

print("\n" + "=" * 50)
print("Test completed!")
print("=" * 50)

