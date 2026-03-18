import logging
import os
from datetime import datetime

# Create logs directory if it doesn't exist
os.makedirs("logs", exist_ok=True)

# Configure logging
def setup_logging():
    """Setup comprehensive logging for the application"""
    
    # Create a logger
    logger = logging.getLogger("medical_assistant")
    logger.setLevel(logging.INFO)
    
    # Prevent duplicate handlers
    if logger.handlers:
        return logger
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # File handler for detailed logs
    file_handler = logging.FileHandler(
        f"logs/medical_assistant_{datetime.now().strftime('%Y%m%d')}.log"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(detailed_formatter)
    
    # Console handler for important logs
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(simple_formatter)
    
    # Error file handler
    error_handler = logging.FileHandler(
        f"logs/errors_{datetime.now().strftime('%Y%m%d')}.log"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(detailed_formatter)
    
    # Add handlers to logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    logger.addHandler(error_handler)
    
    return logger

# Initialize logger
logger = setup_logging()

def log_api_call(api_name: str, endpoint: str, status: str, response_time: float = None, error: str = None):
    """Log API calls with consistent format"""
    if error:
        logger.error(f"API_CALL - {api_name} - {endpoint} - FAILED - {error}")
    else:
        time_info = f" - {response_time:.2f}s" if response_time else ""
        logger.info(f"API_CALL - {api_name} - {endpoint} - {status}{time_info}")

def log_patient_action(patient_id: int, action: str, details: str = None):
    """Log patient-related actions"""
    details_info = f" - {details}" if details else ""
    logger.info(f"PATIENT_ACTION - ID:{patient_id} - {action}{details_info}")

def log_medical_alert(patient_id: int, risk_level: str, reason: str):
    """Log medical alerts for audit trail"""
    logger.warning(f"MEDICAL_ALERT - PATIENT:{patient_id} - RISK:{risk_level} - REASON:{reason}")

def log_system_error(error: Exception, context: str = None):
    """Log system errors with context"""
    context_info = f" - Context: {context}" if context else ""
    logger.error(f"SYSTEM_ERROR - {type(error).__name__}: {str(error)}{context_info}")

def call_with_logging(api_func, *args, **kwargs):
    """Decorator/wrapper for API calls with automatic logging"""
    import time
    
    start_time = time.time()
    api_name = getattr(api_func, '__name__', 'unknown_api')
    
    try:
        result = api_func(*args, **kwargs)
        response_time = time.time() - start_time
        log_api_call(api_name, "success", "SUCCESS", response_time)
        return result
    except Exception as e:
        response_time = time.time() - start_time
        log_api_call(api_name, "failed", "FAILED", response_time, str(e))
        raise
