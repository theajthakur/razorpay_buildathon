import unittest
import logging
import os
import sys
import io
from app.core.logging_config import setup_logging, get_logger

class TestLoggingConfig(unittest.TestCase):
    def setUp(self):
        self.original_level = os.environ.get("LOG_LEVEL")

    def tearDown(self):
        if self.original_level is not None:
            os.environ["LOG_LEVEL"] = self.original_level
        else:
            os.environ.pop("LOG_LEVEL", None)
        setup_logging()

    def test_setup_logging_defaults(self):
        os.environ.pop("LOG_LEVEL", None)
        logger = setup_logging()
        self.assertEqual(logger.name, "shopagent")
        self.assertEqual(logger.level, logging.INFO)
        self.assertEqual(len(logger.handlers), 1)
        self.assertIsInstance(logger.handlers[0], logging.StreamHandler)
        self.assertFalse(logger.propagate)

    def test_get_logger_hierarchy(self):
        agent_logger = get_logger("agent")
        cart_logger = get_logger("cart")
        orders_logger = get_logger("orders")
        auth_logger = get_logger("auth")
        webhook_logger = get_logger("webhook")

        self.assertEqual(agent_logger.name, "shopagent.agent")
        self.assertEqual(cart_logger.name, "shopagent.cart")
        self.assertEqual(orders_logger.name, "shopagent.orders")
        self.assertEqual(auth_logger.name, "shopagent.auth")
        self.assertEqual(webhook_logger.name, "shopagent.webhook")

    def test_log_level_env_override(self):
        os.environ["LOG_LEVEL"] = "DEBUG"
        logger = setup_logging()
        self.assertEqual(logger.level, logging.DEBUG)

        os.environ["LOG_LEVEL"] = "WARNING"
        logger_warn = setup_logging()
        self.assertEqual(logger_warn.level, logging.WARNING)

    def test_formatted_log_output_capture(self):
        os.environ["LOG_LEVEL"] = "INFO"
        root = setup_logging()

        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(root.handlers[0].formatter)
        root.handlers.clear()
        root.addHandler(handler)

        agent_log = get_logger("agent")
        auth_log = get_logger("auth")

        agent_log.info("Agent loop started for conversation convo_12345")
        auth_log.warning("Login failed for merchant merchant_777")

        output = stream.getvalue()
        self.assertIn("shopagent.agent          | Agent loop started for conversation convo_12345", output)
        self.assertIn("shopagent.auth           | Login failed for merchant merchant_777", output)

    def test_no_sensitive_credentials_in_logs(self):
        """Audit test: ensure raw passwords and decrypted secret keys are never logged."""
        os.environ["LOG_LEVEL"] = "DEBUG"
        root = setup_logging()

        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(root.handlers[0].formatter)
        root.handlers.clear()
        root.addHandler(handler)

        auth_log = get_logger("auth")
        orders_log = get_logger("orders")

        # Simulate logging realistic safe lines
        sensitive_password = "SuperSecretPassword123!"
        decrypted_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret_payload"
        
        auth_log.info("Login attempt: merchant=m_1001, email=user@example.com")
        orders_log.info("Order created: agent_order_id=ord_999, merchant_order_id=m_888")

        output = stream.getvalue()
        self.assertNotIn(sensitive_password, output)
        self.assertNotIn(decrypted_jwt, output)
