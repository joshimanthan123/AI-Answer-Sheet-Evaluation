from abc import ABC, abstractmethod
from uuid import UUID
from app.models.answer_key_models import AnswerKeyResponse

class IAnswerKeyRepository(ABC):
    """
    Abstract interface for Answer Key persistence storage.
    Defines common CRUD operations. Accessible asynchronously.
    """

    @abstractmethod
    async def create(self, answer_key: AnswerKeyResponse) -> AnswerKeyResponse:
        """Persists a new answer key."""
        pass

    @abstractmethod
    async def update(self, key_id: UUID, updated_fields: dict) -> AnswerKeyResponse | None:
        """
        Updates given fields in an answer key.
        Returns the updated AnswerKeyResponse or None if not found or deleted.
        """
        pass

    @abstractmethod
    async def delete(self, key_id: UUID) -> bool:
        """
        Soft-deletes an answer key by setting is_deleted=True.
        Returns True if deleted successfully, False if not found.
        """
        pass

    @abstractmethod
    async def get(self, key_id: UUID) -> AnswerKeyResponse | None:
        """
        Retrieves a non-deleted answer key by its unique ID.
        Returns None if not found or soft-deleted.
        """
        pass

    @abstractmethod
    async def list(self) -> list[AnswerKeyResponse]:
        """Retrieves all non-deleted answer keys."""
        pass

    @abstractmethod
    async def exists(self, key_id: UUID) -> bool:
        """Checks if a non-deleted answer key exists by ID."""
        pass

    @abstractmethod
    async def count(self) -> int:
        """Returns total count of active (non-deleted) answer keys."""
        pass


class MemoryAnswerKeyRepository(IAnswerKeyRepository):
    """
    In-memory implementation of IAnswerKeyRepository.
    Ideal for rapid local development, testing, and mock evaluation pipelines.
    """

    def __init__(self) -> None:
        self._storage: dict[UUID, AnswerKeyResponse] = {}

    async def create(self, answer_key: AnswerKeyResponse) -> AnswerKeyResponse:
        # Deep copy to ensure memory isolation
        saved_copy = answer_key.model_copy(deep=True)
        self._storage[saved_copy.id] = saved_copy
        return saved_copy.model_copy(deep=True)

    async def update(self, key_id: UUID, updated_fields: dict) -> AnswerKeyResponse | None:
        if key_id not in self._storage or self._storage[key_id].is_deleted:
            return None
        
        current_data = self._storage[key_id]
        # Perform updates using model_copy update parameter
        updated_dict = current_data.model_dump()
        for field, value in updated_fields.items():
            if field in updated_dict:
                updated_dict[field] = value
        
        updated_model = AnswerKeyResponse(**updated_dict)
        self._storage[key_id] = updated_model
        return updated_model.model_copy(deep=True)

    async def delete(self, key_id: UUID) -> bool:
        if key_id not in self._storage or self._storage[key_id].is_deleted:
            return False
        self._storage[key_id].is_deleted = True
        return True

    async def get(self, key_id: UUID) -> AnswerKeyResponse | None:
        if key_id not in self._storage or self._storage[key_id].is_deleted:
            return None
        return self._storage[key_id].model_copy(deep=True)

    async def list(self) -> list[AnswerKeyResponse]:
        return [
            item.model_copy(deep=True)
            for item in self._storage.values()
            if not item.is_deleted
        ]

    async def exists(self, key_id: UUID) -> bool:
        return key_id in self._storage and not self._storage[key_id].is_deleted

    async def count(self) -> int:
        return sum(1 for item in self._storage.values() if not item.is_deleted)
