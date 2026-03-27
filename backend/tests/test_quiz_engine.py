import unittest

from quiz_engine import _normalize_quiz_items, is_correct_answer


class QuizEngineTests(unittest.TestCase):
    def test_normalize_quiz_items(self):
        raw = [
            {
                "question": "What is HTTP 200?",
                "options": ["Success", "Error", "Redirect", "Timeout"],
                "correct_index": 0,
                "explanation": "200 means success.",
            }
        ]
        quiz = _normalize_quiz_items(raw)
        self.assertEqual(len(quiz), 1)
        self.assertEqual(quiz[0]["correct_index"], 0)
        self.assertEqual(len(quiz[0]["options"]), 4)

    def test_answer_validation(self):
        q = {
            "question": "2+2?",
            "options": ["3", "4", "5", "6"],
            "correct_index": 1,
            "explanation": "2+2 equals 4.",
        }
        self.assertTrue(is_correct_answer(q, 1))
        self.assertFalse(is_correct_answer(q, 0))


if __name__ == "__main__":
    unittest.main()
