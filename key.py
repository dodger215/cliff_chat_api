import secrets

# Generating a secret key for jwt 
secret_key = secrets.token_urlsafe(32)
# Printing out the secret key
print(secret_key)