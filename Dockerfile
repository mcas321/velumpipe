# SafeSender - Docker Image
FROM python:3.12-slim

# Información del mantenedor
LABEL maintainer="SafeSender"
LABEL description="Secure Anonymous E2EE Messaging"

# Directorio de trabajo
WORKDIR /app

# Copiar requirements primero (para cache de Docker)
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto de la aplicación
COPY . .

# Crear usuario no-root para seguridad
RUN useradd --create-home --shell /bin/bash safesender && \
    chown -R safesender:safesender /app

# Cambiar a usuario no-root
USER safesender

# Exponer puerto
EXPOSE 5000

# Variables de entorno por defecto
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Comando de arranque
CMD ["python", "app.py"]