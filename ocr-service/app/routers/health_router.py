import time
from fastapi import APIRouter, Depends
from app.config import Settings
from app.dependencies import get_settings
from app.models.response_models import ApiResponse
from app.models.api_models import OCRHealthResponse, OCRVersionResponse

# Record service global startup time
START_TIME = time.time()

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=ApiResponse)
def check_health(config: Settings = Depends(get_settings)):
    """
    Check the current service health status and active OCR provider engine.
    """
    uptime = time.time() - START_TIME
    health_data = OCRHealthResponse(
        provider=config.HWR_PROVIDER,
        uptime=round(uptime, 2)
    )
    return ApiResponse(
        success=True,
        message="Service health diagnostics compiled.",
        data=health_data.model_dump()
    )

@router.get("/version", response_model=ApiResponse)
def check_version(config: Settings = Depends(get_settings)):
    """
    Exposes VCS builds and SemVer mapping information.
    """
    version_data = OCRVersionResponse(
        build="mock-git-sha-f83a21b",
        provider=config.HWR_PROVIDER
    )
    return ApiResponse(
        success=True,
        message="Service version details loaded.",
        data=version_data.model_dump()
    )
