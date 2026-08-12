import unittest
import os
import shutil
import tempfile
from pathlib import Path
from app.config import settings
from app.storage.local_storage import LocalStorage

class TestAnswerSheetStorage(unittest.TestCase):
    def setUp(self) -> None:
        self.storage = LocalStorage()
        self.original_dir = settings.ANSWER_SHEET_STORAGE_DIR
        self.test_dir = tempfile.mkdtemp()
        settings.ANSWER_SHEET_STORAGE_DIR = Path(self.test_dir)
        settings.ANSWER_SHEET_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    def tearDown(self) -> None:
        if settings.ANSWER_SHEET_STORAGE_DIR.exists():
            shutil.rmtree(self.test_dir)
        settings.ANSWER_SHEET_STORAGE_DIR = self.original_dir

    def test_upload_download(self):
        file_ref = "student-123/sheet-abc/original/file.txt"
        data = b"Testing local storage upload and download content"
        ref = self.storage.upload(file_ref, data)
        self.assertEqual(ref, file_ref)
        
        self.assertTrue(self.storage.exists(file_ref))
        downloaded = self.storage.download(file_ref)
        self.assertEqual(downloaded, data)

    def test_delete(self):
        file_ref = "student-123/sheet-abc/original/file.txt"
        data = b"content to delete"
        self.storage.upload(file_ref, data)
        self.assertTrue(self.storage.exists(file_ref))
        
        deleted = self.storage.delete(file_ref)
        self.assertTrue(deleted)
        self.assertFalse(self.storage.exists(file_ref))

    def test_path_traversal_prevention(self):
        bad_refs = [
            "../../../etc/passwd",
            "..\\..\\Windows\\win.ini",
            "student/../../passwd",
            "/absolute/path/traversal"
        ]
        for ref in bad_refs:
            # Should guard and either raise ValueError or isolate inside storage dir cleanly
            # Our path traversal checker raises ValueError for absolute paths and path components containing traversal
            with self.assertRaises(ValueError, msg=f"Should raise ValueError on: {ref}"):
                self.storage._resolve_path(ref)
