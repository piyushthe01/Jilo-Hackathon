from datetime import datetime, timedelta, timezone
import re


DEFAULT_CADENCE_HOURS = 24


def utc_now():
    return datetime.now(timezone.utc)


def ensure_aware(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def parse_cadence_hours(cadence_text: str | None):
    text = (cadence_text or "").strip().lower()
    if not text:
        return DEFAULT_CADENCE_HOURS

    times_per_day_match = re.search(r"(\d+)\s+times?\s+(?:a|per)\s+day", text)
    if times_per_day_match:
        occurrences = max(int(times_per_day_match.group(1)), 1)
        return max(round(24 / occurrences), 1)

    every_match = re.search(
        r"every\s+(\d+)\s*(hour|hours|hr|hrs|day|days|week|weeks)",
        text,
    )
    if every_match:
        amount = int(every_match.group(1))
        unit = every_match.group(2)
        return convert_to_hours(amount, unit)

    generic_match = re.search(
        r"(\d+)\s*(hour|hours|hr|hrs|day|days|week|weeks)",
        text,
    )
    if generic_match:
        amount = int(generic_match.group(1))
        unit = generic_match.group(2)
        return convert_to_hours(amount, unit)

    if "twice daily" in text:
        return 12
    if "daily" in text or "every day" in text:
        return 24
    if "weekly" in text or "every week" in text:
        return 24 * 7

    return DEFAULT_CADENCE_HOURS


def convert_to_hours(amount: int, unit: str):
    normalized_unit = unit.lower()
    if normalized_unit in {"hour", "hours", "hr", "hrs"}:
        return max(amount, 1)
    if normalized_unit in {"day", "days"}:
        return max(amount * 24, 1)
    if normalized_unit in {"week", "weeks"}:
        return max(amount * 24 * 7, 1)
    return DEFAULT_CADENCE_HOURS


def next_run_from(reference_time: datetime | None, cadence_hours: int | None):
    base_time = ensure_aware(reference_time) or utc_now()
    hours = max(cadence_hours or DEFAULT_CADENCE_HOURS, 1)
    return base_time + timedelta(hours=hours)


def resolved_cadence_hours(workflow):
    cadence_text = getattr(workflow, "cadence", None)
    if cadence_text:
        return parse_cadence_hours(cadence_text)
    return max(getattr(workflow, "cadence_hours", DEFAULT_CADENCE_HOURS) or DEFAULT_CADENCE_HOURS, 1)


def workflow_is_due(workflow, now: datetime | None = None):
    reference_time = ensure_aware(now) or utc_now()
    next_run_at = ensure_aware(getattr(workflow, "next_run_at", None))
    if next_run_at is None:
        return True

    return next_run_at <= reference_time


def workflow_schedule_status(workflow, assignment_count: int, now: datetime | None = None):
    if getattr(workflow, "status", "ACTIVE") != "ACTIVE":
        return "PAUSED"
    if assignment_count <= 0:
        return "UNASSIGNED"
    if workflow_is_due(workflow, now=now):
        return "DUE"
    return "SCHEDULED"
