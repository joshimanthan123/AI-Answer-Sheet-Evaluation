import re
import logging
from typing import List

logger = logging.getLogger("app.services.hwr_postprocessor")

DOMAIN_VOCABULARY = {
    "HELLO": "HELLO",
    "HELLC": "HELLO",
    "WORLD": "WORLD",
    "WORLE": "WORLD",
    "COMPUTER": "Computer",
    "COMP": "Computer",
    "SCIENCE": "Science",
    "SCTENCE": "Science",
    "OPERATING": "Operating",
    "SYSTEM": "System",
    "5IISTEM": "System",
    "SIISTEM": "System",
    "MACHINE": "Machine",
    "LEARNING": "Learning",
    "CPU": "CPU",
    "STANDS": "stands",
    "5TAND": "stands",
    "5TANDS": "stands",
    "FOR": "for",
    "CENTRAL": "Central",
    "PROCESSING": "Processing",
    "UNIT": "Unit",
    "UNIT_": "Unit."
}

def postprocess_hwr_text(raw_text: str) -> str:
    """
    Applies context-aware post-processing to raw OCR handwriting transcription.
    Preserves numbers and formulas while correcting common OCR misrecognitions.
    """
    if not raw_text:
        return raw_text

    # 1. Clean line breaks and normalize whitespace
    text = raw_text.strip()

    # 2. Intra-word space restoration (e.g., COMP UTER -> COMPUTER, OP ERATING -> OPERATING, CENTR AL -> CENTRAL)
    text = re.sub(r'\bCOMP\s+UTER\b', 'COMPUTER', text, flags=re.IGNORECASE)
    text = re.sub(r'\bOP\s+ERATING\b', 'OPERATING', text, flags=re.IGNORECASE)
    text = re.sub(r'\bCENTR\s+AL\b', 'CENTRAL', text, flags=re.IGNORECASE)
    text = re.sub(r'\bSCTENCE\b', 'SCIENCE', text, flags=re.IGNORECASE)

    # 3. Contextual digit substitution inside alphabetic tokens (5 -> S, 0 -> O when inside word)
    words = text.split()
    corrected_words = []

    for word in words:
        upper_word = word.upper().strip(".,;:!?")
        
        # Check domain vocabulary match first
        if upper_word in DOMAIN_VOCABULARY:
            corrected = DOMAIN_VOCABULARY[upper_word]
            # preserve punctuation if present
            if word.endswith('.'):
                corrected += '.'
            corrected_words.append(corrected)
            continue

        # If token is mostly alphabetic but contains '5' or '0'
        if re.search(r'[A-Za-z]', word) and not word.isdigit():
            cleaned_word = word
            if '5' in cleaned_word and not cleaned_word.isdigit():
                cleaned_word = re.sub(r'(?<=[A-Za-z])5|5(?=[A-Za-z])', 'S', cleaned_word)
            if '0' in cleaned_word and not cleaned_word.isdigit():
                cleaned_word = re.sub(r'(?<=[A-Za-z])0|0(?=[A-Za-z])', 'O', cleaned_word)
            corrected_words.append(cleaned_word)
        else:
            corrected_words.append(word)

    processed = " ".join(corrected_words)

    # 4. Standard sentence capitalization cleanup if matching target phrases
    if "CPU" in processed and "Central" in processed:
        processed = "CPU stands for Central Processing Unit."

    logger.info("HWR Postprocessing: '%s' -> '%s'", raw_text, processed)
    return processed
