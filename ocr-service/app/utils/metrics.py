import re

def levenshtein_distance(seq1: list | str, seq2: list | str) -> int:
    """
    Computes standard Levenshtein edit distance between two sequences (strings or word lists).
    Uses dynamic programming with memory space optimization O(min(N, M)).
    
    Args:
        seq1: Reference sequence.
        seq2: Hypothesis sequence.
        
    Returns:
        int: Total edit distance (substitutions + deletions + insertions).
    """
    if seq1 == seq2:
        return 0
        
    len1, len2 = len(seq1), len(seq2)
    if len1 == 0:
        return len2
    if len2 == 0:
        return len1

    # Keep track of previous and current dynamic programming row
    previous_row = list(range(len2 + 1))
    
    for i, c1 in enumerate(seq1):
        current_row = [i + 1] * (len2 + 1)
        for j, c2 in enumerate(seq2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (0 if c1 == c2 else 1)
            current_row[j + 1] = min(insertions, deletions, substitutions)
        previous_row = current_row

    return previous_row[len2]


def normalize_text(text: str) -> str:
    """
    Normalizes whitespace and converts newline characters into spaces.
    
    Args:
        text: Raw input text.
        
    Returns:
        str: Normalized text string.
    """
    if not text:
        return ""
    # Replace multiple spaces/newlines with single space
    normalized = re.sub(r"\s+", " ", text.strip())
    return normalized


def calculate_cer(reference: str, hypothesis: str, normalize: bool = True) -> tuple[float, float, int]:
    """
    Calculates Character Error Rate (CER) and Character Accuracy.
    
    CER = (Substitutions + Deletions + Insertions) / Total characters in reference
    Character Accuracy = max(0.0, 1.0 - CER)
    
    Args:
        reference: Ground-truth text.
        hypothesis: OCR recognized text.
        normalize: Whether to normalize whitespace before computation.
        
    Returns:
        tuple[float, float, int]: (cer, char_accuracy, edit_distance)
    """
    ref = normalize_text(reference) if normalize else reference
    hyp = normalize_text(hypothesis) if normalize else hypothesis
    
    if len(ref) == 0:
        if len(hyp) == 0:
            return 0.0, 1.0, 0
        return 1.0, 0.0, len(hyp)
        
    dist = levenshtein_distance(ref, hyp)
    cer = dist / float(len(ref))
    char_accuracy = max(0.0, 1.0 - cer)
    
    return cer, char_accuracy, dist


def calculate_wer(reference: str, hypothesis: str, normalize: bool = True) -> tuple[float, float, int]:
    """
    Calculates Word Error Rate (WER) and Word Accuracy.
    
    WER = (Substitutions + Deletions + Insertions) / Total words in reference
    Word Accuracy = max(0.0, 1.0 - WER)
    
    Args:
        reference: Ground-truth text.
        hypothesis: OCR recognized text.
        normalize: Whether to normalize whitespace before computation.
        
    Returns:
        tuple[float, float, int]: (wer, word_accuracy, edit_distance)
    """
    ref = normalize_text(reference) if normalize else reference
    hyp = normalize_text(hypothesis) if normalize else hypothesis
    
    ref_words = ref.split()
    hyp_words = hyp.split()
    
    if len(ref_words) == 0:
        if len(hyp_words) == 0:
            return 0.0, 1.0, 0
        return 1.0, 0.0, len(hyp_words)
        
    dist = levenshtein_distance(ref_words, hyp_words)
    wer = dist / float(len(ref_words))
    word_accuracy = max(0.0, 1.0 - wer)
    
    return wer, word_accuracy, dist
