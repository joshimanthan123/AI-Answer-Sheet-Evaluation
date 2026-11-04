import time
import uuid
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger("app.middleware")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to establish RequestState variables (request_id, start time)
    useful for tracing, structured logs, and exception telemetry.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Retrieve or generate unique trace ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        
        # 2. Store trace contexts inside the request state object
        request.state.request_id = request_id
        request.state.start_time = time.time()
        
        # 3. Process the next layer in ASGI pipeline
        response: Response = await call_next(request)
        
        # 4. Attach request_id header to response object
        response.headers["X-Request-ID"] = request_id
        return response


class TimingLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware running post-process, tracking latency values and writing
    structured logs detailing IP scopes, path methods, status values, and times.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        # Retrieve context from state
        request_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())
        start_time = getattr(request.state, "start_time", None) or time.time()
        
        response: Response = await call_next(request)
        
        # Calculate execution duration
        elapsed = time.time() - start_time
        
        # Fetch request credentials
        client_ip = request.client.host if request.client else "127.0.0.1"
        method = request.method
        path = request.url.path
        status_code = response.status_code
        
        # Record structured log entry
        logger.info(
            "Request %s - Client: %s - Method: %s - Path: %s - Status: %d - Processing Time: %.4fs",
            request_id, client_ip, method, path, status_code, elapsed
        )
        return response
