import io
import os
import mimetypes
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, Form, Response, Query, HTTPException
from fastapi.responses import StreamingResponse
from app.models.answer_sheet_models import AnswerSheetResponse, DigitalAnswer
from app.models.response_models import ApiResponse
from app.services.answer_sheet_service import AnswerSheetService
from app.dependencies import (
    get_answer_sheet_service,
    get_current_user_id,
    get_current_user_role
)
from app.core.exceptions import AnswerSheetAccessDenied, UnsupportedAnswerSheetFormat

student_router = APIRouter(prefix="/api/v1", tags=["Student Answer Sheets"])
faculty_router = APIRouter(prefix="/api/v1", tags=["Faculty Answer Sheets"])

# ----------------- Student Endpoints -----------------

@student_router.post("/student/answer-sheets", response_model=ApiResponse, status_code=201)
async def upload_answer_sheet(
    exam_id: str = Form(...),
    file: UploadFile = File(...),
    sheet_id: str = Form(None),
    user_id: str = Depends(get_current_user_id),
    role: str = Depends(get_current_user_role),
    service: AnswerSheetService = Depends(get_answer_sheet_service)
):
    if role != "student":
        raise HTTPException(status_code=403, detail="Student role context required.")
    
    file_bytes = await file.read()
    sheet = await service.process_answer_sheet(
        student_id=user_id,
        exam_id=exam_id,
        filename=file.filename,
        content_type=file.content_type,
        content=file_bytes,
        sheet_id=sheet_id
    )
    return ApiResponse(
        success=True,
        message="Answer sheet uploaded and processed.",
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
    if sheet.student_id != user_id:
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
    if sheet.student_id != user_id:
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
    
    sheet = await service.get_answer_sheet(id)
    if sheet.student_id != user_id:
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    
    return ApiResponse(
        success=True,
        message="Digital data retrieved.",
        data=sheet.digital_answers
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
    if sheet.student_id != user_id:
        raise AnswerSheetAccessDenied("You do not have access to this answer sheet.")
    
    data = service.get_page_file(sheet, page_number, type)
    return Response(content=data, media_type="image/png")


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
    
    sheet = await service.get_answer_sheet(id)
    return ApiResponse(
        success=True,
        message="Digital data retrieved.",
        data=sheet.digital_answers
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
