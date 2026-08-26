# CloudAsset Backend - Docker Image

# Use official lightweight Python image
FROM python:3.14-slim

# Set working directory inside container
WORKDIR /app

# Copy requirements first (better layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the Flask port
EXPOSE 5000

# Start the application
CMD ["python", "app.py"]
