import time
import psutil
import os
from datetime import datetime
from typing import Dict, Any
from functools import lru_cache

class SystemMonitor:
    """Enhanced system monitoring and health checks"""
    
    def __init__(self):
        self.start_time = time.time()
        self.request_count = 0
        self.error_count = 0
        self.api_calls = {
            "openai": {"success": 0, "failed": 0},
            "elevenlabs": {"success": 0, "failed": 0},
            "twilio": {"success": 0, "failed": 0},
            "smtp": {"success": 0, "failed": 0}
        }
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get comprehensive system metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_mb": memory.available / (1024 * 1024),
                "disk_percent": disk.percent,
                "disk_free_gb": disk.free / (1024 * 1024 * 1024),
                "uptime_seconds": time.time() - self.start_time
            }
        except Exception as e:
            return {"error": f"Failed to get system metrics: {str(e)}"}
    
    def get_application_metrics(self) -> Dict[str, Any]:
        """Get application-specific metrics"""
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "error_rate": (self.error_count / max(self.request_count, 1)) * 100,
            "api_calls": self.api_calls.copy(),
            "uptime_hours": (time.time() - self.start_time) / 3600
        }
    
    def record_request(self):
        """Record a successful request"""
        self.request_count += 1
    
    def record_error(self):
        """Record an error"""
        self.error_count += 1
    
    def record_api_call(self, service: str, success: bool):
        """Record an API call"""
        if service in self.api_calls:
            if success:
                self.api_calls[service]["success"] += 1
            else:
                self.api_calls[service]["failed"] += 1

# Global monitor instance
system_monitor = SystemMonitor()

def get_enhanced_health_check() -> Dict[str, Any]:
    """Get comprehensive health status"""
    from app.database import engine
    from sqlalchemy import text
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }
    
    # Database check
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            health_status["checks"]["database"] = "connected"
    except Exception as e:
        health_status["checks"]["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # System resources
    try:
        metrics = system_monitor.get_system_metrics()
        health_status["checks"]["system"] = metrics
        
        # Alert if resources are critical
        if metrics.get("memory_percent", 0) > 90:
            health_status["checks"]["system"]["alert"] = "High memory usage"
        if metrics.get("disk_percent", 0) > 90:
            health_status["checks"]["system"]["alert"] = "High disk usage"
            
    except Exception as e:
        health_status["checks"]["system"] = f"error: {str(e)}"
    
    # Application metrics
    app_metrics = system_monitor.get_application_metrics()
    health_status["checks"]["application"] = app_metrics
    
    # API services status
    health_status["checks"]["api_services"] = check_api_services()
    
    return health_status

def check_api_services() -> Dict[str, str]:
    """Check status of external API services"""
    import os
    
    services = {}
    
    # Check OpenAI
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and openai_key != "your_openai_api_key_here":
        services["openai"] = "configured"
    else:
        services["openai"] = "not_configured"
    
    # Check ElevenLabs
    eleven_key = os.getenv("ELEVENLABS_API_KEY")
    if eleven_key and eleven_key != "your_elevenlabs_api_key_here":
        services["elevenlabs"] = "configured"
    else:
        services["elevenlabs"] = "optional_not_configured"
    
    # Check Twilio
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    if twilio_sid and twilio_sid != "your_twilio_account_sid":
        services["twilio"] = "configured"
    else:
        services["twilio"] = "optional_not_configured"
    
    # Check SMTP
    smtp_user = os.getenv("SMTP_USERNAME")
    if smtp_user and smtp_user != "your_email@gmail.com":
        services["smtp"] = "configured"
    else:
        services["smtp"] = "optional_not_configured"
    
    return services

@lru_cache(maxsize=1)
def get_disease_catalog_stats() -> Dict[str, Any]:
    """Get disease catalog statistics"""
    from app.clinical_data import load_disease_catalog
    
    try:
        catalog = load_disease_catalog()
        return {
            "total_diseases": len(catalog.get("disease_rows", {})),
            "total_precautions": len(catalog.get("precautions", {})),
            "status": "loaded"
        }
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
        }
