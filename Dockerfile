# VelumPipe - Docker Image
FROM python:3.12-slim

# Maintainer information
LABEL maintainer="VelumPipe"
LABEL description="Secure Anonymous E2EE Messaging"

# Directorio de trabajo
WORKDIR /app

# Copiar requirements primero (para cache de Docker)
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto de la aplicación
COPY . .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash velumpipe && \
    chown -R velumpipe:velumpipe /app

# Switch to non-root user
USER velumpipe

# Exponer puerto
EXPOSE 5000

# Default environment variables
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Startup command
CMD ["python", "app.py"]