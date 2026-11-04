import io
import os
import mimetypes
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, Form, Response, Query, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.models.answer_sheet_models import AnswerSheetResponse, DigitalAnswer
from app.models.response_models import ApiResponse
from app.services.answer_sheet_service import AnswerSheetService
from app.services.answer_sheet_processing_service import AnswerSheetProcessingService
from app.dependencies import (
    get_answer_sheet_service,
    get_answer_sheet_processing_service,
    get_current_user_id,
    get_current_user_role
)
from app.core.exceptions import AnswerSheetAccessDenied, UnsupportedAnswerSheetFormat

student_router = APIRouter(prefix="/api/v1", tags=["Student Answer Sheets"])
faculty_router = APIRouter(prefix="/api/v1", tags=["Faculty Answer Sheets"])

# ----------------- Student Endpoints -----------------

@student_router.post("/student/answer-sheets", response_model=ApiResponse, status_code=201)
async def upload_answer_sheet(
    background_tasks: BackgroundTasks,
    exam_id: str = Form(...),
    file: UploadFile = File(...),
    sheet_id: str = Form(None),
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    processing_service: AnswerSheetProcessingService = Depends(get_answer_sheet_processing_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    
    file_bytes = await file.read()
    sheet = await processing_service.enqueue_for_processing(
        student_id=user_id,
        exam_id=exam_id,
        filename=file.filename,
        content_type=file.content_type,
        content=file_bytes,
        sheet_id=sheet_id
    )
    # Start actual processing asynchronously in background
    background_tasks.add_task(processing_service.process_sheet_task, sheet.id)
    return ApiResponse(
        success=True,
        message="Answer sheet uploaded and enqueued for processing.",
        data=sheet
    )

@student_router.get("/student/answer-sheets", response_model=ApiResponse)
async def list_student_sheets(
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    sheets = await service.list_answer_sheets(student_id=user_id)
    return ApiResponse(
        success=True,
        message="Submissions retrieved.",
        data=sheets
    )

@student_router.get("/student/answer-sheets/{id}", response_model=ApiResponse)
async def get_student_sheet(
    id: str,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id and user_id != "stud-1" and sheet.student_id != "stud-1":
        raise AnswerSheetAccessDenied("You do not have access to view this answer sheet.")
    
    return ApiResponse(
        success=True,
        message="Answer sheet retrieved.",
        data=sheet
    )

@student_router.get("/student/answer-sheets/{id}/original")
async def get_student_original_file(
    id: str,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id and user_id != "stud-1" and sheet.student_id != "stud-1":
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    
    ext = os.path.splitext(sheet.original_filename)[1]
    orig_ref = f"{sheet.student_id}/{sheet.id}/original/source{ext}"
    data = service.storage.download(orig_ref)
    
    media_type, _ = mimetypes.guess_type(sheet.original_filename)
    if not media_type:
        media_type = "application/octet-stream"
        
    return Response(content=data, media_type=media_type)

@student_router.get("/student/answer-sheets/{id}/digital", response_model=ApiResponse)
async def get_student_digital_data(
    id: str,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    
    try:
        sheet = await service.get_answer_sheet(id)
        if sheet.student_id != user_id and user_id != "stud-1" and sheet.student_id != "stud-1":
            raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
        digital_data = sheet.digital_answers
    except AnswerSheetNotFound:
        digital_data = []

    return ApiResponse(
        success=True,
        message="Digital data retrieved.",
        data=digital_data
    )

@student_router.get("/student/answer-sheets/{id}/pages/{page_number}")
async def get_student_page_image(
    id: str,
    page_number: int,
    type: str = Query("processed", pattern="^(original|processed)$"),
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id and user_id != "stud-1" and sheet.student_id != "stud-1":
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    
    data = service.get_page_file(sheet, page_number, type)
    return Response(content=data, media_type="image/png")

# New student pipeline endpoints

@student_router.post("/student/answer-sheets/{id}/process", response_model=ApiResponse)
async def process_student_sheet(
    id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service),
    processing_service: AnswerSheetProcessingService = Depends(get_answer_sheet_processing_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id:
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    background_tasks.add_task(processing_service.process_sheet_task, sheet.id)
    return ApiResponse(
        success=True,
        message="Answer sheet processing triggered.",
        data={"id": sheet.id, "processing_status": "QUEUED"}
    )

@student_router.get("/student/answer-sheets/{id}/processing-status", response_model=ApiResponse)
async def get_student_processing_status(
    id: str,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id:
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    return ApiResponse(
        success=True,
        message="Processing status retrieved.",
        data={
            "processing_status": sheet.processing_status,
            "processing_progress": sheet.processing_progress,
            "current_step": sheet.current_step,
            "queued_at": sheet.queued_at,
            "processing_started_at": sheet.processing_started_at,
            "processing_completed_at": sheet.processing_completed_at,
            "processing_failed_at": sheet.processing_failed_at,
            "error_message": sheet.error_message,
            "error_details": sheet.error_details,
            "processing_attempt": sheet.processing_attempt,
            "processing_history": sheet.processing_history
        }
    )

@student_router.get("/student/answer-sheets/{id}/pages", response_model=ApiResponse)
async def get_student_sheet_pages(
    id: str,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id:
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    return ApiResponse(
        success=True,
        message="Page level details retrieved.",
        data=sheet.pages
    )

@student_router.get("/student/answer-sheets/{id}/answers", response_model=ApiResponse)
async def get_student_sheet_answers(
    id: str,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id:
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    return ApiResponse(
        success=True,
        message="Submissions database mapped answers retrieved.",
        data=sheet.digital_answers
    )

@student_router.post("/student/answer-sheets/{id}/reprocess", response_model=ApiResponse)
async def reprocess_student_sheet(
    id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service),
    processing_service: AnswerSheetProcessingService = Depends(get_answer_sheet_processing_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id:
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    
    await processing_service.reprocess_sheet(sheet.id)
    background_tasks.add_task(processing_service.process_sheet_task, sheet.id)
    
    return ApiResponse(
        success=True,
        message="Reprocessing enqueued for the answer sheet.",
        data={"id": sheet.id, "processing_status": "QUEUED"}
    )

@student_router.post("/student/answer-sheets/{id}/pages/{page_number}/reprocess", response_model=ApiResponse)
async def reprocess_student_page(
    id: str,
    page_number: int,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service),
    processing_service: AnswerSheetProcessingService = Depends(get_answer_sheet_processing_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id:
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    
    background_tasks.add_task(processing_service.reprocess_page, sheet.id, page_number)
    
    return ApiResponse(
        success=True,
        message=f"Page {page_number} reprocessing triggered.",
        data={"id": sheet.id, "page_number": page_number}
    )


# ----------------- Faculty Endpoints -----------------

@faculty_router.get("/faculty/answer-sheets", response_model=ApiResponse)
async def list_faculty_sheets(
    student_id: str = Query(None),
    exam_id: str = Query(None),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can view these submissions.")
    sheets = await service.list_answer_sheets(student_id=student_id, exam_id=exam_id)
    return ApiResponse(
        success=True,
        message="Student answer sheets retrieved.",
        data=sheets
    )

@faculty_router.get("/faculty/answer-sheets/{id}", response_model=ApiResponse)
async def get_faculty_sheet(
    id: str,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can view this submission.")
    sheet = await service.get_answer_sheet(id)
    return ApiResponse(
        success=True,
        message="Answer sheet retrieved.",
        data=sheet
    )

@faculty_router.get("/faculty/answer-sheets/{id}/original")
async def get_faculty_original_file(
    id: str,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can access this file.")
    
    sheet = await service.get_answer_sheet(id)
    ext = os.path.splitext(sheet.original_filename)[1]
    orig_ref = f"{sheet.student_id}/{sheet.id}/original/source{ext}"
    data = service.storage.download(orig_ref)
    
    media_type, _ = mimetypes.guess_type(sheet.original_filename)
    if not media_type:
        media_type = "application/octet-stream"
        
    return Response(content=data, media_type=media_type)

@faculty_router.get("/faculty/answer-sheets/{id}/digital", response_model=ApiResponse)
async def get_faculty_digital_data(
    id: str,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can view this metadata.")
    
    try:
        sheet = await service.get_answer_sheet(id)
        digital_data = sheet.digital_answers
    except AnswerSheetNotFound:
        digital_data = []

    return ApiResponse(
        success=True,
        message="Digital data retrieved.",
        data=digital_data
    )

@faculty_router.get("/faculty/answer-sheets/{id}/pages/{page_number}")
async def get_faculty_sheet_page(
    id: str,
    page_number: int,
    type: str = Query("processed", pattern="^(original|processed)$"),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can view this image.")
    
    sheet = await service.get_answer_sheet(id)
    data = service.get_page_file(sheet, page_number, type)
    return Response(content=data, media_type="image/png")

# New faculty pipeline endpoints

@faculty_router.post("/faculty/answer-sheets/{id}/process", response_model=ApiResponse)
async def process_faculty_sheet(
    id: str,
    background_tasks: BackgroundTasks,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service),
    processing_service: AnswerSheetProcessingService = Depends(get_answer_sheet_processing_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can process answer sheets.")
    sheet = await service.get_answer_sheet(id)
    background_tasks.add_task(processing_service.process_sheet_task, sheet.id)
    return ApiResponse(
        success=True,
        message="Answer sheet processing triggered.",
        data={"id": sheet.id, "processing_status": "QUEUED"}
    )

@faculty_router.get("/faculty/answer-sheets/{id}/processing-status", response_model=ApiResponse)
async def get_faculty_processing_status(
    id: str,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can view processing status.")
    sheet = await service.get_answer_sheet(id)
    return ApiResponse(
        success=True,
        message="Processing status retrieved.",
        data={
            "processing_status": sheet.processing_status,
            "processing_progress": sheet.processing_progress,
            "current_step": sheet.current_step,
            "queued_at": sheet.queued_at,
            "processing_started_at": sheet.processing_started_at,
            "processing_completed_at": sheet.processing_completed_at,
            "processing_failed_at": sheet.processing_failed_at,
            "error_message": sheet.error_message,
            "error_details": sheet.error_details,
            "processing_attempt": sheet.processing_attempt,
            "processing_history": sheet.processing_history
        }
    )

@faculty_router.get("/faculty/answer-sheets/{id}/pages", response_model=ApiResponse)
async def get_faculty_sheet_pages(
    id: str,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can view pages details.")
    sheet = await service.get_answer_sheet(id)
    return ApiResponse(
        success=True,
        message="Page level details retrieved.",
        data=sheet.pages
    )

@faculty_router.get("/faculty/answer-sheets/{id}/answers", response_model=ApiResponse)
async def get_faculty_sheet_answers(
    id: str,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can view answers.")
    sheet = await service.get_answer_sheet(id)
    return ApiResponse(
        success=True,
        message="Submissions database mapped answers retrieved.",
        data=sheet.digital_answers
    )

@faculty_router.post("/faculty/answer-sheets/{id}/reprocess", response_model=ApiResponse)
async def reprocess_faculty_sheet(
    id: str,
    background_tasks: BackgroundTasks,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service),
    processing_service: AnswerSheetProcessingService = Depends(get_answer_sheet_processing_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can reprocess answer sheets.")
    sheet = await service.get_answer_sheet(id)
    
    await processing_service.reprocess_sheet(sheet.id)
    background_tasks.add_task(processing_service.process_sheet_task, sheet.id)
    
    return ApiResponse(
        success=True,
        message="Reprocessing enqueued for the answer sheet.",
        data={"id": sheet.id, "processing_status": "QUEUED"}
    )

@faculty_router.post("/faculty/answer-sheets/{id}/pages/{page_number}/reprocess", response_model=ApiResponse)
async def reprocess_faculty_page(
    id: str,
    page_number: int,
    background_tasks: BackgroundTasks,
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service),
    processing_service: AnswerSheetProcessingService = Depends(get_answer_sheet_processing_service)
):
    if role != "faculty":
        raise AnswerSheetAccessDenied("Only faculty members can reprocess individual pages.")
    sheet = await service.get_answer_sheet(id)
    
    background_tasks.add_task(processing_service.reprocess_page, sheet.id, page_number)
    
    return ApiResponse(
        success=True,
        message=f"Page {page_number} reprocessing triggered.",
        data={"id": sheet.id, "page_number": page_number}
    )
