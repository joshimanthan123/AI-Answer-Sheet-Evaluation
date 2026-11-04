from typing import List, Optional

def calculate_average_confidence(confidences: List[Optional[float]]) -> Optional[float]:
    """
    Calculate the arithmetic mean of available numeric confidence values, ignoring null/None.
    Returns None if no numeric values are present.
    """
    valid_scores = [c for c in confidences if c is not None]
    if not valid_scores:
        return None
    return round(sum(valid_scores) / len(valid_scores), 4)

def classify_confidence(score: Optional[float]) -> str:
    """
    Classify confidence score into categories:
    - 80-100 -> HIGH (if score is scaled 0-100) or 0.8-1.0 -> HIGH (if 0-1)
    - 50-79  -> MEDIUM
    - 0-49   -> LOW
    - None   -> UNKNOWN
    
    Since the prompt says:
    80–100 → HIGH
    50–79  → MEDIUM
    0–49   → LOW
    null   → UNKNOWN
    
    But some values could be 0.0 to 1.0 (since confidence in HWRLine is 0.0 to 1.0).
    We should support both 0-1 and 0-100 ranges. If score <= 1.0, we treat it as 0-1 and scale by 100
    unless it is 0.0, which remains LOW.
    """
    if score is None:
        return "UNKNOWN"
    
    # Scale if it is 0.0-1.0 based
    val = score
    if 0.0 < val <= 1.0:
        val = val * 100.0
        
    if val >= 80.0:
        return "HIGH"
    elif val >= 50.0:
        return "MEDIUM"
    else:
        return "LOW"
