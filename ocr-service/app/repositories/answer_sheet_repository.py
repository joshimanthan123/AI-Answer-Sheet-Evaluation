from abc import ABC, abstractmethod
from uuid import UUID
from app.models.answer_sheet_models import AnswerSheetResponse

class IAnswerSheetRepository(ABC):
    """
    Abstract interface for Answer Sheet persistence storage.
    Defines common CRUD operations. Accessible asynchronously.
    """

    @abstractmethod
    async def create(self, answer_sheet: AnswerSheetResponse) -> AnswerSheetResponse:
        """Persists a new answer sheet."""
        pass

    @abstractmethod
    async def update(self, sheet_id: str, updated_fields: dict) -> AnswerSheetResponse | None:
        """
        Updates given fields in an answer sheet.
        Returns the updated AnswerSheetResponse or None if not found.
        """
        pass

    @abstractmethod
    async def delete(self, sheet_id: str) -> bool:
        """
        Deletes an answer sheet.
        Returns True if deleted successfully, False if not found.
        """
        pass

    @abstractmethod
    async def get(self, sheet_id: str) -> AnswerSheetResponse | None:
        """
        Retrieves an answer sheet by its unique ID.
        Returns None if not found.
        """
        pass

    @abstractmethod
    async def list(self, **filters) -> list[AnswerSheetResponse]:
        """Retrieves all answer sheets, optionally filtered by fields."""
        pass

    @abstractmethod
    async def exists(self, sheet_id: str) -> bool:
        """Checks if an answer sheet exists by ID."""
        pass


class MemoryAnswerSheetRepository(IAnswerSheetRepository):
    """
    In-memory implementation of IAnswerSheetRepository.
    Ideal for rapid local development, testing, and mock evaluation pipelines.
    """

    def __init__(self) -> None:
        self._storage: dict[str, AnswerSheetResponse] = {}

    async def create(self, answer_sheet: AnswerSheetResponse) -> AnswerSheetResponse:
        # Deep copy to ensure memory isolation
        saved_copy = answer_sheet.model_copy(deep=True)
        self._storage[str(saved_copy.id)] = saved_copy
        return saved_copy.model_copy(deep=True)

    async def update(self, sheet_id: str, updated_fields: dict) -> AnswerSheetResponse | None:
        sheet_id_str = str(sheet_id)
        if sheet_id_str not in self._storage:
            return None
        
        current_data = self._storage[sheet_id_str]
        updated_dict = current_data.model_dump()
        for field, value in updated_fields.items():
            if field in updated_dict:
                updated_dict[field] = value
        
        updated_model = AnswerSheetResponse(**updated_dict)
        self._storage[sheet_id_str] = updated_model
        return updated_model.model_copy(deep=True)

    async def delete(self, sheet_id: str) -> bool:
        sheet_id_str = str(sheet_id)
        if sheet_id_str not in self._storage:
            return False
        del self._storage[sheet_id_str]
        return True

    async def get(self, sheet_id: str) -> AnswerSheetResponse | None:
        sheet_id_str = str(sheet_id)
        if sheet_id_str not in self._storage:
            return None
        return self._storage[sheet_id_str].model_copy(deep=True)

    async def list(self, **filters) -> list[AnswerSheetResponse]:
        results = list(self._storage.values())
        for key, value in filters.items():
            if value is not None:
                results = [r for r in results if getattr(r, key, None) == str(value)]
        return [
            item.model_copy(deep=True)
            for item in results
        ]

    async def exists(self, sheet_id: str) -> bool:
        return str(sheet_id) in self._storage
