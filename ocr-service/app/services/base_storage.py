from abc import ABC, abstractmethod

class IStorage(ABC):
    @abstractmethod
    def upload(self, file_path: str, data: bytes) -> str:
        """
        Uploads file data to target file_path.
        
        Args:
            file_path: The workspace relative target path.
            data: Binary payload.
            
        Returns:
            str: Reference path key of stored object.
        """
        pass

    @abstractmethod
    def download(self, file_ref: str) -> bytes:
        """
        Downloads data stored under file_ref key.
        
        Args:
            file_ref: Reference path key of the object.
            
        Returns:
            bytes: Content binary structure.
        """
        pass

    @abstractmethod
    def delete(self, file_ref: str) -> bool:
        """
        Deletes the target storage object if present.
        
        Args:
            file_ref: Reference path key of the object.
            
        Returns:
            bool: True if deleted successfully, False otherwise.
        """
        pass

    @abstractmethod
    def exists(self, file_ref: str) -> bool:
        """
        Verifies if an object represents an active file key context.
        
        Args:
            file_ref: Reference path key of the object.
            
        Returns:
            bool: True if exists, else False.
        """
        pass
