import uvicorn
from app.config import settings

if __name__ == "__main__":
    # Start the Uvicorn web server hosting our FastAPI application
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_config=None  # Hands off logging framework control to our custom setup in main.py
    )
