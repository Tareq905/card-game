FROM python:3.11-slim

WORKDIR /app

# System dependencies (needed for psycopg2/postgres driver)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Fly.io will set the PORT env variable; default to 8000 for local testing
ENV PORT=8000
EXPOSE 8000

# Run the FastAPI app with uvicorn
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]