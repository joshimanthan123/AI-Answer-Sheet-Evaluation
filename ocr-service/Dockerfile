# Python 3.11 FastAPI OCR Microservice Production Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for OpenCV, GL, and PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy OCR service source code
COPY . .

# Create storage, outputs, uploads, and logs directories
RUN mkdir -p uploads outputs logs storage

EXPOSE 8000

ENV HOST=0.0.0.0
ENV PORT=8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
