import os
from pathlib import Path
from app.config import settings
from app.core.exceptions import AnswerSheetAccessDenied
from app.services.base_storage import IStorage


class LocalStorage(IStorage):
    """
    Local filesystem implementation of IStorage.
    Protects against path traversal attacks by validating resolved paths against root directory.
    """
    
    def __init__(self, root_dir: Path = None):
        self.root_dir = Path(root_dir or settings.ANSWER_SHEET_STORAGE_DIR).resolve()
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, file_path: str) -> Path:
        """
        Safely resolves a file path against the storage root directory.
        Prevents path traversal escaping the root directory.
        """
        path_str = str(file_path).replace("\\", "/")
        
        # 1. Block absolute paths or drive letters
        if (
            Path(file_path).is_absolute()
            or path_str.startswith("/")
            or ":" in path_str
        ):
            raise AnswerSheetAccessDenied("Absolute paths not allowed.")
            
        # 2. Block path traversal components specifically
        parts = path_str.split("/")
        if ".." in parts:
            raise AnswerSheetAccessDenied("Path traversal attempt detected.")
            
        # Resolved absolute path
        resolved = (self.root_dir / Path(path_str)).resolve()
        
        # Verify it is strictly relative to root_dir
        try:
            resolved.relative_to(self.root_dir)
        except ValueError:
            raise AnswerSheetAccessDenied("Path traversal attempt detected.")
            
        return resolved

    def upload(self, file_path: str, data: bytes) -> str:
        target = self._resolve_path(file_path)
        # Create parent directories safely
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "wb") as f:
            f.write(data)
        # Return root-relative path string as reference
        return os.path.relpath(target, start=self.root_dir).replace("\\", "/")

    def download(self, file_ref: str) -> bytes:
        target = self._resolve_path(file_ref)
        if not target.is_file():
            from app.core.exceptions import AnswerSheetPageNotFound
            raise AnswerSheetPageNotFound(f"File key '{file_ref}' not found.")
        with open(target, "rb") as f:
            return f.read()

    def delete(self, file_ref: str) -> bool:
        target = self._resolve_path(file_ref)
        if target.is_file():
            os.remove(target)
            return True
        return False

    def exists(self, file_ref: str) -> bool:
        target = self._resolve_path(file_ref)
        return target.is_file()
