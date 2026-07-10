FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for caching
COPY web-server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy everything else (frontend files + web-server)
COPY . .

# HF Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:7860/api/health || exit 1

# Run the web server
CMD ["python", "web-server/server.py"]
