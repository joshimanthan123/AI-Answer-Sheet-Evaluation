import unittest
from uuid import uuid4
from datetime import datetime, timezone
from app.models.answer_sheet_models import AnswerSheetStatus, AnswerSheetResponse
from app.repositories.answer_sheet_repository import MemoryAnswerSheetRepository


class TestAnswerSheetRepository(unittest.TestCase):
    def setUp(self):
        self.repo = MemoryAnswerSheetRepository()

    async def test_crud_lifecycle(self):
        sheet_id = uuid4()
        sheet = AnswerSheetResponse(
            id=sheet_id,
            student_id="student-1",
            exam_id="exam-a",
            original_filename="ans.pdf",
            original_format="pdf",
            file_size=5000,
            page_count=2,
            processing_status=AnswerSheetStatus.UPLOADED,
            uploaded_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        
        # 1. Create
        created = await self.repo.create(sheet)
        self.assertEqual(created.id, sheet_id)
        
        # 2. Get
        fetched = await self.repo.get(sheet_id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.student_id, "student-1")
        
        # 3. Update
        updated = await self.repo.update(sheet_id, {"processing_status": AnswerSheetStatus.COMPLETED})
        self.assertEqual(updated.processing_status, AnswerSheetStatus.COMPLETED)
        
        # 4. List (and filters)
        all_sheets = await self.repo.list()
        self.assertEqual(len(all_sheets), 1)
        
        filtered = await self.repo.list(student_id="student-1")
        self.assertEqual(len(filtered), 1)
        
        empty_filtered = await self.repo.list(student_id="student-2")
        self.assertEqual(len(empty_filtered), 0)
        
        # 5. Delete
        deleted = await self.repo.delete(sheet_id)
        self.assertTrue(deleted)
        
        fetched_after_delete = await self.repo.get(sheet_id)
        self.assertIsNone(fetched_after_delete)

    # Wrap async test runner
    def test_run_crud(self):
        import asyncio
        asyncio.run(self.test_crud_lifecycle())
