import re
import logging
from typing import Tuple, Optional
from app.config import settings

logger = logging.getLogger("app.utils.question_detector")

# Comprehensive Roman numeral matching list (1 to 20) in order of descending length to avoid subset cuts
ROMAN_NUMERALS_PATTERN = r'\b(XVIII|XVII|XIII|XVIII|VIII|XIV|XIX|XVI|XII|XV|VII|III|IV|IX|VI|XI|XX|X|V|II|I)\b'

def clean_ocr_header(line: str) -> str:
    """
    Cleans common OCR reading/scanning mistakes in question prefixes.
    
    Args:
        line: The raw textual line.
        
    Returns:
        str: Corrected line.
    """
    cleaned = line.strip()
    if not cleaned:
        return cleaned

    # 1. Ql -> Q1, Ql. -> Q1, QI -> Q1, O1 -> Q1 corrections
    cleaned = re.sub(r'^[qQ]l(?=\b|[.\-\s\d])', 'Q1', cleaned)
    cleaned = re.sub(r'^[qQ]I(?=\b|[.\-\s\d])', 'Q1', cleaned)
    cleaned = re.sub(r'^[oO]1(?=\b|[.\-\s\d])', 'Q1', cleaned)
    
    # 2. l. -> 1. correction
    cleaned = re.sub(r'^l\b(?=[.\)])', '1', cleaned)
    
    # 3. Section typos correction
    cleaned = re.sub(r'^[sS]ect?[io]o?n\b', 'Section', cleaned)
    
    return cleaned

def parse_question_number(line: str) -> Optional[Tuple[str, str]]:
    """
    Detects if a given line starts with or is a question header.
    Normalizes matched headers based on parser priorities.
    
    Priority Matching:
      1. Section markers (e.g., 'Section A', 'Part B') -> SecA
      2. Standard Q prefixes with subquestions (e.g., 'Q1(a)', 'Q. 2 (b)') -> Q1(a)
      3. Standard Q prefixes (e.g., 'Q.1', 'Question 1') -> Q1
      4. Sub-questions alone (e.g., '2(a)', '2.b') -> Q2(a)
      5. Numeric headers alone (e.g., '1.', '2)') -> Q1
      6. Roman numerals (e.g., 'II.', 'III)') -> RomanII (if enabled)

    Args:
        line: The original line text.
        
    Returns:
        Optional[Tuple[str, str]]: A tuple of (original_matched_header, normalized_question_number) or None.
    """
    orig_stripped = line.strip()
    cleaned = clean_ocr_header(orig_stripped)
    if not cleaned:
        return None

    # Priority 1: Section markers
    sec_match = re.match(r'^(Section|Part)\s*[.\-\s]*([A-Z]\b)', cleaned, re.IGNORECASE)
    if sec_match:
        tag = sec_match.group(1).title() # Section or Part
        group = sec_match.group(2).upper()
        # Enforce SecA or PartA style
        norm = f"{tag[:3]}{group}"
        return orig_stripped[:sec_match.end()].strip(), norm

    # Priority 2: Standard Q prefixes with subquestions (e.g. Q1(a), Q-2(b))
    if settings.SEGMENTATION_ALLOW_SUBQUESTIONS:
        q_sub_match = re.match(
            r'^[qQ](?:uestion)?\s*[.\-\s]*([0-9]+)\s*[.\-\s]*[\(]?([a-zA-Z])[\)?\s]', 
            cleaned, 
            re.IGNORECASE
        )
        if q_sub_match:
            num = q_sub_match.group(1)
            letter = q_sub_match.group(2).lower()
            norm = f"Q{num}({letter})"
            # Original header is matched prefix
            return orig_stripped[:q_sub_match.end()].strip(), norm

    # Priority 3: Standard Q prefixes (e.g. Q.1, Question 1)
    q_match = re.match(r'^[qQ](?:uestion)?\s*[.\-\s]*([0-9]+)\s*[.\-\)]*', cleaned, re.IGNORECASE)
    if q_match:
        num = q_match.group(1)
        norm = f"Q{num}"
        return orig_stripped[:q_match.end()].strip(), norm

    # Priority 4: Sub-questions without Q (e.g. 2(a), 2.b)
    if settings.SEGMENTATION_ALLOW_SUBQUESTIONS:
        sub_match = re.match(r'^([0-9]+)\s*[.\-\s]*[\(]([a-zA-Z])[\)]', cleaned)
        if not sub_match:
            # support spaces/dots separated format: e.g. "2 a) " or "2.b "
            sub_match = re.match(r'^([0-9]+)\s*[.\-\s]+([a-zA-Z])(?=\b|[)\-\s])', cleaned)
        if sub_match:
            num = sub_match.group(1)
            letter = sub_match.group(2).lower()
            norm = f"Q{num}({letter})"
            return orig_stripped[:sub_match.end()].strip(), norm

    # Priority 5: Numeric headers (e.g. 1. or 2) )
    num_match = re.match(r'^([0-9]+)\b\s*[.\)\-:]+', cleaned)
    if num_match:
        num = num_match.group(1)
        suffix = cleaned[num_match.end():].strip()
        false_positive_indicators = [
            r'^(first|second|third|fourth|fifth|firstly|secondly|thirdly|another)\b',
            r'^(advantage|disadvantage|type|method|point|reason|step|part|example|definition|option|feature|characteristic|pro|con|benefit|drawback)\b',
            r'^following\s+(are|points|advantages|disadvantages|types|methods|reasons|steps|parts|examples|features)\b'
        ]
        is_false_positive = False
        for pattern in false_positive_indicators:
            if re.search(pattern, suffix, re.IGNORECASE):
                is_false_positive = True
                break
        
        if suffix and suffix[0].islower():
            is_false_positive = True
            
        if not is_false_positive:
            norm = f"Q{num}"
            return orig_stripped[:num_match.end()].strip(), norm

    # Priority 6: Roman numerals (e.g. II., III) )
    if settings.SEGMENTATION_ALLOW_ROMAN:
        roman_regex = r'^' + ROMAN_NUMERALS_PATTERN + r'\s*[.\)\-]+'
        roman_match = re.match(roman_regex, cleaned, re.IGNORECASE)
        if roman_match:
            roman_val = roman_match.group(1).upper()
            norm = f"Roman{roman_val}"
            # Ensure it is not mistaken inside normal language (e.g. "I. am writing...")
            # We match strictly Roman index patterns
            return orig_stripped[:roman_match.end()].strip(), norm

    return None
