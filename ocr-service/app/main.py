import logging
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI
from app.config import settings

# Import Middlewares
from app.middleware import RequestContextMiddleware, TimingLoggingMiddleware
# Import Exception Handlers
from app.exception_handlers import register_exception_handlers
# Import Routers
from app.routers.health_router import router as health_router
from app.routers.pipeline_router import router as pipeline_router
from app.api.routes.answer_key import router as answer_key_router
from app.api.routes.prompt import router as prompt_router
from app.api.routes.llm import router as llm_router
from app.api.routes.evaluation import router as evaluation_router
from app.api.routes.answer_sheet import student_router, faculty_router




def setup_logging() -> None:
    """
    Configures console and file-based Logging with rotating handlers.
    Formats logs with timestamp, log level, caller module name, and line numbers.
    """
    log_formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Configure root logger
    root_logger = logging.getLogger()
    # Set to debug mode if configured, else info
    root_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # Prevent duplicating logs when running FastAPI inside Uvicorn's worker process
    root_logger.handlers = []

    # Console Logger Handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)
    root_logger.addHandler(console_handler)

    # File Logger Handler with Rotation (max 10MB per file, keeping up to 5 logs)
    log_file_path = settings.LOG_DIR / "ocr_service.log"
    file_handler = RotatingFileHandler(
        log_file_path,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setFormatter(log_formatter)
    root_logger.addHandler(file_handler)

    # Reduce Uvicorn default request log verbosity, route all output to standard formats
    for uvicorn_log in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        logger = logging.getLogger(uvicorn_log)
        logger.handlers = root_logger.handlers
        logger.propagate = False

    logging.info("Logging successfully configured. Log file written to: %s", log_file_path)

# Initialize logs before FastAPI boots
setup_logging()

# Instantiate FastAPI application
app = FastAPI(
    title=settings.SERVICE_NAME,
    version=settings.VERSION,
    description=(
        "An independent Python OCR Microservice built on FastAPI. "
        "Intended for handwritten answer sheet recognition."
    ),
    docs_url="/docs",
    redoc_url="/redoc"
)

# Exception handlers hook registration
register_exception_handlers(app)

# Middleware registry (TimingLoggingMiddleware handles logging, RequestContextMiddleware context states)
app.add_middleware(TimingLoggingMiddleware)
app.add_middleware(RequestContextMiddleware)

# Route registrations
app.include_router(health_router)
app.include_router(pipeline_router)
app.include_router(answer_key_router)
app.include_router(prompt_router)
app.include_router(llm_router)
app.include_router(evaluation_router)
app.include_router(student_router)
app.include_router(faculty_router)


@app.on_event("startup")
async def validate_hwr_configuration() -> None:
    """
    Fail-fast on boot if HWR_PROVIDER=azure but the Document Intelligence
    endpoint/key are missing or the SDK is unavailable. This prevents the
    service from silently appearing to do real OCR while it cannot. The mock
    provider always passes. The API key is never logged.
    """
    from app.services.hwr_service import HandwritingRecognitionService, HWRServiceError

    try:
        HandwritingRecognitionService.validate_configuration()
    except HWRServiceError as exc:
        logging.error("HWR provider configuration is invalid: %s", exc)
        raise



