import unittest
import asyncio
from unittest.mock import patch, MagicMock
from app.agentic.merchant_api import call_merchant_api

class TestMerchantApiLogging(unittest.TestCase):
    @patch("app.agentic.merchant_api._merchant_logger.error")
    @patch("httpx.AsyncClient.post")
    def test_400_error_logging_header_redaction_and_truncation(self, mock_post, mock_logger):
        # Create a mock 400 error response with a body > 2000 chars
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        long_body = "ERROR_LINE_" + ("x" * 2500)
        mock_resp.text = long_body
        mock_post.return_value = mock_resp

        headers = {
            "Authorization": "Bearer sensitive_merchant_token_999",
            "Content-Type": "application/json"
        }
        payload = {"cart_id": "cart_123", "items": [1, 2, 3]}

        resp = asyncio.run(
            call_merchant_api(
                "POST",
                "https://api.merchant.com/orders",
                headers=headers,
                json_body=payload,
                context="create_order"
            )
        )

        self.assertEqual(resp.status_code, 400)
        mock_logger.assert_called_once()
        log_message = mock_logger.call_args[0][0]

        # 1. Verify context & status code in log
        self.assertIn("[create_order] Merchant API error: POST https://api.merchant.com/orders -> 400", log_message)

        # 2. Verify Authorization header is redacted
        self.assertIn("'Authorization': '<redacted>'", log_message)
        self.assertNotIn("sensitive_merchant_token_999", log_message)

        # 3. Verify response body preview truncated at 2000 chars
        self.assertIn("Response body: ERROR_LINE_" + ("x" * (2000 - len("ERROR_LINE_"))), log_message)
        self.assertNotIn("x" * 2100, log_message)

    @patch("app.agentic.merchant_api._merchant_logger.error")
    @patch("httpx.AsyncClient.post")
    def test_password_redaction_in_logged_body(self, mock_post, mock_logger):
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = '{"error": "Unauthorized"}'
        mock_post.return_value = mock_resp

        payload = {"email": "customer@gmail.com", "password": "my_top_secret_pass"}

        resp = asyncio.run(
            call_merchant_api(
                "POST",
                "https://api.merchant.com/login",
                json_body=payload,
                redact_body_keys=["password"],
                context="merchant_login"
            )
        )

        self.assertEqual(resp.status_code, 401)
        mock_logger.assert_called_once()
        log_message = mock_logger.call_args[0][0]

        # 1. Verify password in logged body is redacted
        self.assertIn("'password': '<redacted>'", log_message)
        self.assertNotIn("my_top_secret_pass", log_message)

        # 2. Verify real payload was sent to outgoing httpx request
        mock_post.assert_called_once()
        kwargs = mock_post.call_args.kwargs
        self.assertEqual(kwargs["json"]["password"], "my_top_secret_pass")

    @patch("app.agentic.merchant_api._merchant_logger.error")
    @patch("httpx.AsyncClient.get")
    def test_200_success_logs_no_errors(self, mock_get, mock_logger):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"status": "ok"}'
        mock_get.return_value = mock_resp

        resp = asyncio.run(
            call_merchant_api(
                "GET",
                "https://api.merchant.com/products",
                context="search_products"
            )
        )

        self.assertEqual(resp.status_code, 200)
        mock_logger.assert_not_called()
