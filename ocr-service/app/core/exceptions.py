from app.exception_handlers import OCRServiceException

class AnswerKeyNotFound(OCRServiceException):
    """Exception raised when an answer key is not found or is soft-deleted."""
    def __init__(self, message: str = "Answer key not found."):
        super().__init__(message, "ANSWER_KEY_NOT_FOUND", 404)

class DuplicateQuestionNumber(OCRServiceException):
    """Exception raised when multiple questions contain duplicate question numbers."""
    def __init__(self, message: str = "Duplicate question number found in answer key."):
        super().__init__(message, "DUPLICATE_QUESTION_NUMBER", 400)

class DuplicateKeyword(OCRServiceException):
    """Exception raised when duplicate keywords are defined in a single question."""
    def __init__(self, message: str = "Duplicate keyword found in question."):
        super().__init__(message, "DUPLICATE_KEYWORD", 400)

class InvalidMarks(OCRServiceException):
    """Exception raised when question marks are invalid or<= 0."""
    def __init__(self, message: str = "Invalid marks configuration."):
        super().__init__(message, "INVALID_MARKS", 400)

class PromptTemplateNotFound(OCRServiceException):
    """Exception raised when a prompt template file cannot be found."""
    def __init__(self, message: str = "Template not found."):
        super().__init__(message, "PROMPT_TEMPLATE_NOT_FOUND", 404)

class PromptTemplateInvalid(OCRServiceException):
    """Exception raised when a prompt template is corrupted, invalid or contains unknown placeholders."""
    def __init__(self, message: str = "Prompt template invalid."):
        super().__init__(message, "PROMPT_TEMPLATE_INVALID", 500)

class PromptPlaceholderMissing(OCRServiceException):
    """Exception raised when a required placeholder variable is missing from the template."""
    def __init__(self, message: str = "Prompt placeholder missing."):
        super().__init__(message, "PROMPT_PLACEHOLDER_MISSING", 400)

class PromptTooLarge(OCRServiceException):
    """Exception raised when a rendered prompt size exceeds allowed token limits."""
    def __init__(self, message: str = "Rendered prompt size is too large."):
        super().__init__(message, "PROMPT_TOO_LARGE", 400)


class LLMProviderError(OCRServiceException):
    """General error for LLM providers."""
    def __init__(self, message: str = "LLM provider error occurred."):
        super().__init__(message, "LLM_PROVIDER_ERROR", 500)


class LLMProviderUnavailable(OCRServiceException):
    """Exception raised when selected LLM provider is offline or unreachable."""
    def __init__(self, message: str = "LLM provider is currently unavailable."):
        super().__init__(message, "LLM_PROVIDER_UNAVAILABLE", 503)


class LLMProviderTimeout(OCRServiceException):
    """Exception raised when selected LLM provider request times out."""
    def __init__(self, message: str = "LLM provider request timed out."):
        super().__init__(message, "LLM_PROVIDER_TIMEOUT", 504)


class LLMProviderAuthenticationError(OCRServiceException):
    """Exception raised when API key or credentials for LLM provider are invalid."""
    def __init__(self, message: str = "LLM provider authentication failed."):
        super().__init__(message, "LLM_AUTHENTICATION_ERROR", 401)


class LLMProviderRateLimitError(OCRServiceException):
    """Exception raised when LLM provider rate limit is exceeded."""
    def __init__(self, message: str = "LLM provider rate limit exceeded."):
        super().__init__(message, "LLM_RATE_LIMIT_ERROR", 429)


class LLMInvalidResponse(OCRServiceException):
    """Exception raised when LLM provider returns a malformed or invalid response."""
    def __init__(self, message: str = "LLM provider returned an invalid response."):
        super().__init__(message, "LLM_INVALID_RESPONSE", 502)


class LLMProviderNotConfigured(OCRServiceException):
    """Exception raised when required LLM provider credentials or URL are missing."""
    def __init__(self, message: str = "LLM provider is not configured."):
        super().__init__(message, "LLM_PROVIDER_NOT_CONFIGURED", 400)


class UnsupportedLLMProvider(OCRServiceException):
    """Exception raised when requested LLM provider is not supported."""
    def __init__(self, message: str = "LLM provider is not supported."):
        super().__init__(message, "UNSUPPORTED_LLM_PROVIDER", 400)


# =========================================================================
# Phase 3D Evaluation Exception Classes
# =========================================================================

class EvaluationError(OCRServiceException):
    """Base exception for all evaluation errors."""
    def __init__(self, message: str = "Evaluation error occurred.", error_code: str = "EVALUATION_ERROR", status_code: int = 500):
        super().__init__(message, error_code, status_code)

class EvaluationResponseParseError(EvaluationError):
    """Exception raised when LLM response JSON is malformed."""
    def __init__(self, message: str = "Failed to parse evaluation response JSON."):
        super().__init__(message, "EVALUATION_RESPONSE_PARSE_ERROR", 502)

class EvaluationResponseValidationError(EvaluationError):
    """Exception raised when LLM response content fails schema validation."""
    def __init__(self, message: str = "Evaluation response schema validation failed."):
        super().__init__(message, "EVALUATION_RESPONSE_VALIDATION_ERROR", 400)

class MarksOutOfRange(EvaluationError):
    """Exception raised when marks awarded do not fall within 0 and maximum_marks."""
    def __init__(self, message: str = "Awarded marks must be between 0 and maximum marks."):
        super().__init__(message, "MARKS_OUT_OF_RANGE", 400)

class EvaluationAnswerKeyNotFound(EvaluationError):
    """Exception raised when the target evaluation answer key is missing."""
    def __init__(self, message: str = "Evaluation answer key not found."):
        super().__init__(message, "EVALUATION_ANSWER_KEY_NOT_FOUND", 404)

class EvaluationQuestionNotFound(EvaluationError):
    """Exception raised when target evaluation question cannot be found."""
    def __init__(self, message: str = "Evaluation question not found."):
        super().__init__(message, "EVALUATION_QUESTION_NOT_FOUND", 404)

class EmptyStudentAnswer(EvaluationError):
    """Exception raised when student answer is completely blank."""
    def __init__(self, message: str = "Student answer is empty or whitespace-only."):
        super().__init__(message, "EMPTY_STUDENT_ANSWER", 400)

class EvaluationFailed(EvaluationError):
    """Exception raised when the overall evaluation orchestration fails."""
    def __init__(self, message: str = "Evaluation orchestration failed."):
        super().__init__(message, "EVALUATION_FAILED", 500)


# =========================================================================
# Phase 4A Answer Sheet Exception Classes
# =========================================================================

class AnswerSheetNotFound(OCRServiceException):
    """Exception raised when an answer sheet is not found."""
    def __init__(self, message: str = "Answer sheet not found."):
        super().__init__(message, "ANSWER_SHEET_NOT_FOUND", 404)


class UnsupportedAnswerSheetFormat(OCRServiceException):
    """Exception raised when the file format or MIME type is not supported."""
    def __init__(self, message: str = "Unsupported answer sheet file format."):
        super().__init__(message, "UNSUPPORTED_ANSWER_SHEET_FORMAT", 415)


class AnswerSheetTooLarge(OCRServiceException):
    """Exception raised when the file size exceeds allowed limits."""
    def __init__(self, message: str = "Answer sheet size exceeds the limit."):
        super().__init__(message, "ANSWER_SHEET_TOO_LARGE", 413)


class AnswerSheetProcessingError(OCRServiceException):
    """Exception raised when any error occurs over the PDF segmentation pipelines."""
    def __init__(self, message: str = "Error occurred while processing answer sheet."):
        super().__init__(message, "ANSWER_SHEET_PROCESSING_ERROR", 500)


class AnswerSheetAccessDenied(OCRServiceException):
    """Exception raised when student/faculty access checks fail."""
    def __init__(self, message: str = "Access denied to the requested answer sheet."):
        super().__init__(message, "ANSWER_SHEET_ACCESS_DENIED", 403)


class AnswerSheetPageNotFound(OCRServiceException):
    """Exception raised when specific page indices are missing/out of bounds."""
    def __init__(self, message: str = "Target page not found in answer sheet."):
        super().__init__(message, "ANSWER_SHEET_PAGE_NOT_FOUND", 404)


class InvalidAnswerSheetFile(OCRServiceException):
    """Exception raised when the file upload stream itself is corrupted or malformed."""
    def __init__(self, message: str = "Invalid answer sheet file."):
        super().__init__(message, "INVALID_ANSWER_SHEET_FILE", 400)




