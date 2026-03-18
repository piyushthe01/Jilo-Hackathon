from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse
import os

# Create rate limiter with Redis backend for production (fallback to memory for dev)
def get_rate_limiter():
    """Create rate limiter with configurable backend"""
    # Use Redis if available, otherwise in-memory
    redis_url = os.getenv("REDIS_URL")
    
    if redis_url:
        try:
            from slowapi.extension import Limiter
            from redis import Redis
            redis_client = Redis.from_url(redis_url)
            return Limiter(key_func=get_remote_address, storage_uri=redis_url)
        except Exception:
            pass
    
    # Fallback to in-memory storage
    return Limiter(key_func=get_remote_address)

# Rate limit configurations
RATE_LIMITS = {
    "health": "100/minute",  # Health checks should be frequent
    "patient_create": "10/minute",  # Patient creation - moderate
    "patient_update": "20/minute",  # Patient updates
    "followup_submit": "30/minute",  # Follow-up submissions
    "voice_call": "5/minute",  # Voice calls - expensive
    "report_generate": "10/minute",  # Report generation
    "admin": "100/minute",  # Admin operations
    "default": "60/minute"  # Default for other endpoints
}

def setup_rate_limiting(app: FastAPI):
    """Setup rate limiting for the FastAPI application"""
    limiter = get_rate_limiter()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    return limiter

# Custom rate limit exceeded response
def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded"""
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": "Too many requests. Please slow down.",
            "retry_after": exc.description if hasattr(exc, 'description') else 60
        }
    )
