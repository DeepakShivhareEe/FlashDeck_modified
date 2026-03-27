import unittest

from file_extractor import extract_content_from_bytes


class FileExtractorTests(unittest.TestCase):
    def test_txt_extraction(self):
        payload = b"FlashDeck test content"
        result = extract_content_from_bytes("notes.txt", payload)
        self.assertEqual(result["mode"], "text")
        self.assertIn("FlashDeck", result["content"])

    def test_unsupported_extension(self):
        with self.assertRaises(ValueError):
            extract_content_from_bytes("photo.png", b"image")


if __name__ == "__main__":
    unittest.main()
