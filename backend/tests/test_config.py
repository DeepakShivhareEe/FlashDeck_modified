import unittest

from config import parse_cors_origins, sanitize_chat_message


class ConfigHelpersTest(unittest.TestCase):
    def test_parse_cors_origins_default(self):
        result = parse_cors_origins(None)
        self.assertIn("http://localhost:5173", result)

    def test_parse_cors_origins_commas(self):
        result = parse_cors_origins("https://app.example.com, https://admin.example.com")
        self.assertEqual(result, ["https://app.example.com", "https://admin.example.com"])

    def test_sanitize_chat_message_trim_and_limit(self):
        msg = "  hello  "
        self.assertEqual(sanitize_chat_message(msg, max_chars=3), "hel")


if __name__ == "__main__":
    unittest.main()
