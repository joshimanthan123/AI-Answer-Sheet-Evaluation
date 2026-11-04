import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.core.exceptions import (
    AnswerKeyNotFound,
    DuplicateQuestionNumber,
    DuplicateKeyword,
    InvalidMarks,
)
from app.models.answer_key_models import (
    CreateAnswerKeyRequest,
    UpdateAnswerKeyRequest,
    AnswerKeyResponse,
    AnswerKeyQuestion,
)
from app.repositories.answer_key_repository import IAnswerKeyRepository

logger = logging.getLogger("app.services.answer_key_service")

class AnswerKeyService:
    """
    Service class executing business logic and validation rules for Answer Keys.
    """

    def __init__(self, repository: IAnswerKeyRepository) -> None:
        self._repository = repository

    def _validate_questions(self, questions: list[AnswerKeyQuestion]) -> None:
        """
        Validates business rules for a list of questions:
        1. No duplicate normalized question numbers.
        2. Unique normalized keyword values per question.
        3. Positive maximum marks configuration.
        """
        seen_question_numbers = set()

        for q in questions:
            # 1. Normalize and check duplicate question numbers
            normalized_qnum = q.question_number.strip().upper()
            if normalized_qnum in seen_question_numbers:
                logger.error("Validation error: Duplicate question number '%s' encountered.", normalized_qnum)
                raise DuplicateQuestionNumber(
                    f"Duplicate question number '{normalized_qnum}' found in the answer key."
                )
            seen_question_numbers.add(normalized_qnum)

            # 2. Check positive maximum marks
            if q.maximum_marks <= 0:
                logger.error("Validation error: Question '%s' has non-positive marks '%s'.", normalized_qnum, q.maximum_marks)
                raise InvalidMarks(
                    f"Question number '{normalized_qnum}' must have maximum marks greater than 0."
                )

            # 3. Check duplicate keywords per question (normalized lower and stripped)
            seen_keywords = set()
            for kw_item in q.keywords:
                norm_keyword = kw_item.keyword.lower().strip()
                if norm_keyword in seen_keywords:
                    logger.error(
                        "Validation error: Duplicate keyword '%s' in question '%s'.",
                        norm_keyword,
                        normalized_qnum,
                    )
                    raise DuplicateKeyword(
                        f"Duplicate keyword '{kw_item.keyword}' in question '{normalized_qnum}'."
                    )
                seen_keywords.add(norm_keyword)

    async def create_answer_key(self, request: CreateAnswerKeyRequest) -> AnswerKeyResponse:
        """
        Creates a new Answer Key after validating business rules.
        Generates UUID and timestamps. Logs success.
        """
        logger.info("Initiating AnswerKey creation flow for exam '%s'...", request.exam_name)
        
        # Enforce service-level business rules
        self._validate_questions(request.questions)

        new_id = uuid4()
        now = datetime.now(timezone.utc)

        # Convert Create request to full Response model schema
        response_model = AnswerKeyResponse(
            id=new_id,
            subject=request.subject.strip(),
            subject_code=request.subject_code.strip() if request.subject_code else None,
            exam_name=request.exam_name.strip(),
            exam_type=request.exam_type.strip() if request.exam_type else None,
            semester=request.semester.strip() if request.semester else None,
            academic_year=request.academic_year.strip() if request.academic_year else None,
            faculty_name=request.faculty_name.strip(),
            status=request.status,
            version=request.version,
            questions=request.questions,
            created_at=now,
            updated_at=now,
            is_deleted=False
        )

        persisted = await self._repository.create(response_model)

        logger.info(
            "Created AnswerKey - ID %s - Faculty %s - Exam %s - Question Count %d",
            persisted.id,
            persisted.faculty_name,
            persisted.exam_name,
            len(persisted.questions)
        )
        return persisted

    async def update_answer_key(self, key_id: UUID, request: UpdateAnswerKeyRequest) -> AnswerKeyResponse:
        """
        Updates an existing Answer Key. Validates modified parameters.
        Raises AnswerKeyNotFound if not active. Logs updates.
        """
        logger.info("Initiating Update flow for AnswerKey ID '%s'...", key_id)
        
        existing = await self._repository.get(key_id)
        if not existing:
            logger.error("Update failed: AnswerKey ID '%s' not found or deleted.", key_id)
            raise AnswerKeyNotFound(f"Answer key matching ID '{key_id}' was not found.")

        # Gather update fields
        updated_fields = {}
        
        # If questions list is updated, run validations first
        if request.questions is not None:
            self._validate_questions(request.questions)
            updated_fields["questions"] = request.questions

        # Strip strings if provided
        for field in ["subject", "subject_code", "exam_name", "exam_type", "semester", "academic_year", "faculty_name"]:
            val = getattr(request, field)
            if val is not None:
                updated_fields[field] = val.strip()

        if request.status is not None:
            updated_fields["status"] = request.status

        if request.version is not None:
            updated_fields["version"] = request.version

        if not updated_fields:
            # No changes provided, return existing after deep copy
            return existing

        # Update timestamps
        updated_fields["updated_at"] = datetime.now(timezone.utc)

        # Persist edits via repository
        updated_key = await self._repository.update(key_id, updated_fields)
        if not updated_key:
            logger.error("Update failed: AnswerKey ID '%s' could not be modified.", key_id)
            raise AnswerKeyNotFound(f"Answer key matching ID '{key_id}' was not found.")

        logger.info(
            "Updated AnswerKey - ID %s - Faculty %s - Exam %s - Status %s",
            updated_key.id,
            updated_key.faculty_name,
            updated_key.exam_name,
            updated_key.status
        )
        return updated_key

    async def delete_answer_key(self, key_id: UUID) -> None:
        """
        Performs soft-delete of an Answer Key.
        Raises AnswerKeyNotFound if not active. Logs removal.
        """
        logger.info("Initiating soft-delete for AnswerKey ID '%s'...", key_id)
        
        # Check active status first
        active = await self._repository.exists(key_id)
        if not active:
            logger.error("Delete failed: AnswerKey ID '%s' not found or already deleted.", key_id)
            raise AnswerKeyNotFound(f"Answer key matching ID '{key_id}' was not found.")

        deleted_ok = await self._repository.delete(key_id)
        if not deleted_ok:
            logger.error("Delete failed: Repository could not delete AnswerKey ID '%s'.", key_id)
            raise AnswerKeyNotFound(f"Answer key matching ID '{key_id}' was not found.")

        logger.info("Deleted AnswerKey - ID %s", key_id)

    async def get_answer_key(self, key_id: UUID) -> AnswerKeyResponse:
        """
        Retrieves active Answer Key.
        Raises AnswerKeyNotFound if deleted or non-existent.
        """
        logger.info("Fetching AnswerKey ID '%s'...", key_id)
        result = await self._repository.get(key_id)
        if not result:
            logger.error("Fetch failed: AnswerKey ID '%s' not found.", key_id)
            raise AnswerKeyNotFound(f"Answer key matching ID '{key_id}' was not found.")
        
        logger.info("Fetched AnswerKey - ID %s", key_id)
        return result

    async def list_answer_keys(self) -> list[AnswerKeyResponse]:
        """
        Lists all active (non-deleted) Answer Keys.
        """
        logger.info("Listing all active AnswerKeys...")
        return await self._repository.list()

    async def get_count(self) -> int:
        """
        Gets count of active Answer Keys.
        """
        count_val = await self._repository.count()
        logger.info("Count of active AnswerKeys requested. Current count: %d", count_val)
        return count_val
