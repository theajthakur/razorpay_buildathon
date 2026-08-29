import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
import jwt
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.config import get_settings
from app.system.models import User, Onboarding, MerchantUserSession
from app.agentic.auth_utils import resolve_session_expiry
from app.agentic.crypto import encrypt_merchant_token

class TestAgenticAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.client = TestClient(app)
        cls.settings = get_settings()

        # Proactively clean up from dirty previous runs
        cls.test_user_id = "user_test_agentic_auth_888"
        cls.db.query(MerchantUserSession).filter(MerchantUserSession.merchant_id == cls.test_user_id).delete()
        cls.db.query(Onboarding).filter(Onboarding.user_id == cls.test_user_id).delete()
        cls.db.query(User).filter(User.id == cls.test_user_id).delete()
        cls.db.commit()

        # Create a test merchant user
        cls.test_user = User(
            id=cls.test_user_id,
            email="merchant_auth_test@razorpay.com",
            store_name="Test Auth Store",
            status="approved"
        )
        cls.db.add(cls.test_user)
        
        # Create onboarding config with auth configured
        cls.onboarding = Onboarding(
            user_id=cls.test_user_id,
            base_url="https://api.merchantstore.com/v1",
            auth_enabled=True,
            slug="test-auth-slug",
            auth_config={
                "auth_url": "/api/login",
                "identifier_field": "email",
                "password_field": "password",
                "token_path": "data.token"
            }
        )
        cls.db.add(cls.onboarding)
        cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.query(MerchantUserSession).filter(MerchantUserSession.merchant_id == cls.test_user_id).delete()
        cls.db.query(Onboarding).filter(Onboarding.user_id == cls.test_user_id).delete()
        cls.db.query(User).filter(User.id == cls.test_user_id).delete()
        cls.db.commit()
        cls.db.close()

    def setUp(self):
        # Clear sessions before each test
        self.db.query(MerchantUserSession).filter(MerchantUserSession.merchant_id == self.test_user_id).delete()
        self.db.commit()

    def test_resolve_session_expiry(self):
        # Case A: JWT merchant token with exp
        exp_time = int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp())
        jwt_token = jwt.encode({"exp": exp_time}, "some-secret", algorithm="HS256")
        expiry = resolve_session_expiry(jwt_token, {})
        self.assertAlmostEqual(expiry.timestamp(), exp_time, delta=5)

        # Case B: Opaque token with expires_in in the response
        expiry = resolve_session_expiry("opaque_token", {"expires_in": 1200})
        expected = (datetime.now(timezone.utc) + timedelta(seconds=1200)).timestamp()
        self.assertAlmostEqual(expiry.timestamp(), expected, delta=5)

        # Case C: Opaque token with no expiry info -> MAX_SESSION_TTL (1 hour)
        expiry = resolve_session_expiry("opaque_token", {})
        expected = (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()
        self.assertAlmostEqual(expiry.timestamp(), expected, delta=5)

    @patch("httpx.AsyncClient.request")
    def test_login_success(self, mock_request):
        # Mock merchant auth server response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "token": "merchant_api_token_12345"
            },
            "user_id": "customer_999"
        }
        mock_request.return_value = mock_response

        # Call endpoint
        response = self.client.post(
            "/api/public/auth/login",
            json={
                "merchant_id": self.test_user_id,
                "email": "customer@gmail.com",
                "password": "secretpassword"
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("token", data)
        self.assertIn("expires_at", data)

        # Verify database record
        session_row = self.db.query(MerchantUserSession).filter(
            MerchantUserSession.merchant_id == self.test_user_id
        ).first()
        self.assertIsNotNone(session_row)
        self.assertEqual(session_row.customer_ref, "customer_999")
        self.assertEqual(session_row.email, "customer@gmail.com")

    @patch("httpx.AsyncClient.request")
    def test_login_invalid_credentials_401(self, mock_request):
        # Mock 401 response from merchant auth server
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_request.return_value = mock_response

        response = self.client.post(
            "/api/public/auth/login",
            json={
                "merchant_id": self.test_user_id,
                "email": "customer@gmail.com",
                "password": "wrongpassword"
            }
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "invalid_credentials")

    def test_auth_dependencies(self):
        # 1. Create a dummy session in DB
        session_id = "test-session-id-555"
        expiry = datetime.now(timezone.utc) + timedelta(minutes=45)
        raw_token = "some-merchant-raw-token"
        db_session = MerchantUserSession(
            id=session_id,
            merchant_id=self.test_user_id,
            customer_ref="customer_555",
            email="cust555@test.com",
            merchant_token_encrypted=encrypt_merchant_token(raw_token),
            expires_at=expiry
        )
        self.db.add(db_session)
        self.db.commit()

        # 2. Encode local JWT
        client_jwt = jwt.encode(
            {
                "sub": session_id,
                "merchant_id": self.test_user_id,
                "customer_ref": "customer_555",
                "exp": int(expiry.timestamp()),
            },
            self.settings.JWT_SECRET,
            algorithm="HS256"
        )

        # 3. Test get_current_session directly in Python
        from app.agentic.deps import get_current_session, get_merchant_token
        session_info = get_current_session(authorization=f"Bearer {client_jwt}")
        self.assertEqual(session_info["session_id"], session_id)
        self.assertEqual(session_info["merchant_id"], self.test_user_id)
        self.assertEqual(session_info["customer_ref"], "customer_555")

        # 4. Test get_merchant_token directly in Python
        token = get_merchant_token(session=session_info, db=self.db)
        self.assertEqual(token, raw_token)

    def test_early_expired_session_fails(self):
        # 1. Create a session in DB that is already expired
        session_id = "test-session-id-expired"
        expiry = datetime.now(timezone.utc) - timedelta(minutes=10)  # Expired 10m ago
        db_session = MerchantUserSession(
            id=session_id,
            merchant_id=self.test_user_id,
            customer_ref="customer_exp",
            email="cust_exp@test.com",
            merchant_token_encrypted=encrypt_merchant_token("exp_token"),
            expires_at=expiry
        )
        self.db.add(db_session)
        self.db.commit()

        client_jwt = jwt.encode(
            {
                "sub": session_id,
                "merchant_id": self.test_user_id,
                "customer_ref": "customer_exp",
                "exp": int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp()),  # Client token not expired yet
            },
            self.settings.JWT_SECRET,
            algorithm="HS256"
        )

        # 2. Call dependency directly, should raise 401 and remove session from DB
        from fastapi import HTTPException
        from app.agentic.deps import get_current_session, get_merchant_token
        session_info = get_current_session(authorization=f"Bearer {client_jwt}")

        with self.assertRaises(HTTPException) as ctx:
            get_merchant_token(session=session_info, db=self.db)

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "merchant_session_expired")

        # Verify deleted
        deleted_row = self.db.query(MerchantUserSession).filter(MerchantUserSession.id == session_id).first()
        self.assertIsNone(deleted_row)

    def test_create_conversation(self):
        # 1. Create a dummy session in DB
        session_id = "test-session-id-convo"
        expiry = datetime.now(timezone.utc) + timedelta(minutes=45)
        db_session = MerchantUserSession(
            id=session_id,
            merchant_id=self.test_user_id,
            customer_ref="customer_convo_test@test.com",
            email="customer_convo_test@test.com",
            merchant_token_encrypted=encrypt_merchant_token("some_token"),
            expires_at=expiry
        )
        self.db.add(db_session)
        self.db.commit()

        # 2. Encode local JWT
        client_jwt = jwt.encode(
            {
                "sub": session_id,
                "merchant_id": self.test_user_id,
                "customer_ref": "customer_convo_test@test.com",
                "exp": int(expiry.timestamp()),
            },
            self.settings.JWT_SECRET,
            algorithm="HS256"
        )

        # 3. Call POST /agentic/conversations
        response = self.client.post(
            "/agentic/conversations",
            headers={"Authorization": f"Bearer {client_jwt}"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("conversation_id", data)

        convo_id = data["conversation_id"]

        # Verify database record
        from app.system.models import Conversation
        convo_row = self.db.query(Conversation).filter(Conversation.id == convo_id).first()
        self.assertIsNotNone(convo_row)
        self.assertEqual(convo_row.merchant_id, self.test_user_id)
        self.assertEqual(convo_row.user_email, "customer_convo_test@test.com")

        # Clean up
        self.db.delete(convo_row)
        self.db.commit()

    @patch("httpx.AsyncClient.request")
    def test_login_shape_mismatch_502(self, mock_request):
        # Mock merchant response lacking the configured "data.token" path
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "invalid_payload_key": "some_token"
        }
        mock_request.return_value = mock_response

        response = self.client.post(
            "/api/public/auth/login",
            json={
                "merchant_id": self.test_user_id,
                "email": "customer@gmail.com",
                "password": "secretpassword"
            }
        )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], "merchant_response_shape_mismatch")

    @patch("httpx.AsyncClient.get")
    def test_login_custom_http_method_get(self, mock_get):
        # 1. Temporarily change method to GET in onboarding
        old_config = self.onboarding.auth_config.copy()
        self.onboarding.auth_config = {
            "auth_url": "/api/login",
            "method": "GET",
            "identifier_field": "email",
            "password_field": "password",
            "token_path": "data.token"
        }
        self.db.commit()

        try:
            # Mock merchant auth server response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "data": {
                    "token": "get_merchant_api_token"
                },
                "user_id": "customer_get"
            }
            mock_get.return_value = mock_response

            # Call endpoint
            response = self.client.post(
                "/api/public/auth/login",
                json={
                    "merchant_id": self.test_user_id,
                    "email": "customer@gmail.com",
                    "password": "secretpassword"
                }
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn("token", data)

            # Confirm GET was called instead of POST
            mock_get.assert_called_once()
        finally:
            # Restore onboarding configuration
            self.onboarding.auth_config = old_config
            self.db.commit()

    def test_logout_purges_db_session(self):
        # 1. Create a dummy session in DB
        session_id = "test-session-logout-99"
        expiry = datetime.now(timezone.utc) + timedelta(minutes=45)
        db_session = MerchantUserSession(
            id=session_id,
            merchant_id=self.test_user_id,
            customer_ref="cust_logout@test.com",
            email="cust_logout@test.com",
            merchant_token_encrypted=encrypt_merchant_token("some_token"),
            expires_at=expiry
        )
        self.db.add(db_session)
        self.db.commit()

        # 2. Encode local JWT
        client_jwt = jwt.encode(
            {
                "sub": session_id,
                "merchant_id": self.test_user_id,
                "customer_ref": "cust_logout@test.com",
                "exp": int(expiry.timestamp()),
            },
            self.settings.JWT_SECRET,
            algorithm="HS256"
        )

        # 3. Call POST /agentic/auth/logout
        response = self.client.post(
            "/agentic/auth/logout",
            headers={"Authorization": f"Bearer {client_jwt}"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "success")

        # 4. Verify deleted
        deleted_row = self.db.query(MerchantUserSession).filter(MerchantUserSession.id == session_id).first()
        self.assertIsNone(deleted_row)

    def test_get_merchant_auth_headers_delivery(self):
        # 1. Temporarily configure token delivery in onboarding
        old_config = self.onboarding.auth_config.copy()
        self.onboarding.auth_config = {
            "auth_url": "/api/login",
            "method": "POST",
            "identifier_field": "email",
            "password_field": "password",
            "token_path": "data.token",
            "token_delivery": {
                "method": "header",
                "header_name": "X-Auth-Token",
                "bearer_prefix": False
            }
        }
        self.db.commit()

        # 2. Create session
        session_id = "test-session-headers-77"
        expiry = datetime.now(timezone.utc) + timedelta(minutes=45)
        raw_token = "raw-merchant-custom-token-val"
        db_session = MerchantUserSession(
            id=session_id,
            merchant_id=self.test_user_id,
            customer_ref="cust_headers@test.com",
            email="cust_headers@test.com",
            merchant_token_encrypted=encrypt_merchant_token(raw_token),
            expires_at=expiry
        )
        self.db.add(db_session)
        self.db.commit()

        # 3. Encode JWT
        client_jwt = jwt.encode(
            {
                "sub": session_id,
                "merchant_id": self.test_user_id,
                "customer_ref": "cust_headers@test.com",
                "exp": int(expiry.timestamp()),
            },
            self.settings.JWT_SECRET,
            algorithm="HS256"
        )

        try:
            # 4. Call get_merchant_auth_headers directly in Python
            from app.agentic.deps import get_current_session, get_merchant_auth_headers
            session_info = get_current_session(authorization=f"Bearer {client_jwt}")
            headers = get_merchant_auth_headers(session=session_info, db=self.db)
            
            # Should have X-Auth-Token as key, and no "Bearer " prefix!
            self.assertIn("X-Auth-Token", headers)
            self.assertEqual(headers["X-Auth-Token"], raw_token)
        finally:
            # Restore and clean up
            self.onboarding.auth_config = old_config
            self.db.delete(db_session)
            self.db.commit()


