from cryptography.fernet import Fernet
from app.core.config import get_settings

settings = get_settings()
_fernet = Fernet(settings.MERCHANT_TOKEN_ENCRYPTION_KEY)

def encrypt_merchant_token(token: str) -> str:
    """
    Encrypts the plaintext token before storing in database.
    """
    return _fernet.encrypt(token.encode()).decode()

def decrypt_merchant_token(encrypted: str) -> str:
    """
    Decrypts the database ciphertext token back to plaintext for outgoing HTTP calls.
    Never log or output the decrypted value.
    """
    return _fernet.decrypt(encrypted.encode()).decode()
