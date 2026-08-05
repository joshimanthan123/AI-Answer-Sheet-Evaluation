from pydantic import BaseModel
from typing import Any

class ApiResponse(BaseModel):
    """
    Standard envelope format wrapped around every API payload response.
    """
    success: bool
    message: str
    data: Any
