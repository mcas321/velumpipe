# SafeSender 🔒

Una aplicación web de mensajería anónima y segura con **cifrado extremo a extremo (E2EE)** que garantiza que solo el emisor y el receptor puedan leer los mensajes.

## 🛡️ Características de Seguridad

- **Cifrado E2EE**: Los mensajes se cifran en el navegador antes de enviarse al servidor
- **Completamente Anónimo**: Sin emails, contraseñas ni datos personales
- **Claves Locales**: Las claves privadas nunca salen del navegador
- **Mensajes Efímeros**: Se autodestruyen tras ser leídos o después de 10 minutos
- **Sin Logs Sensibles**: No se almacenan IPs ni timestamps precisos
- **Algoritmos Seguros**: RSA-OAEP 2048 bits + AES-GCM 256 bits

## 🚀 Inicio Rápido

### Instalación

1. **Clona o descarga el proyecto**
```bash
cd safesender
```

2. **Instala las dependencias de Python**
```bash
pip install -r requirements.txt
```

3. **Ejecuta la aplicación**
```bash
python app.py
```

4. **Abre tu navegador**
```
http://127.0.0.1:5000
```

### Uso

1. **Al abrir la aplicación**: Se genera automáticamente tu ID anónimo y claves de cifrado
2. **Para recibir mensajes**: Comparte tu ID anónimo con otros usuarios
3. **Para enviar mensajes**: Ingresa el ID del destinatario y tu mensaje
4. **Los mensajes se cifran automáticamente** antes de enviarse al servidor
5. **Al leer un mensaje**, se descifra localmente y se autodestruye

## 🔧 Arquitectura Técnica

### Backend (Flask)
- **app.py**: Servidor principal con API REST
- **Almacenamiento en memoria**: Para mensajes cifrados (sin base de datos)
- **Autodestrucción automática**: Hilo de limpieza cada 60 segundos
- **APIs seguras**: Sin almacenamiento de datos sensibles

### Frontend
- **HTML5 + Bootstrap 5**: Interfaz responsive y moderna
- **WebCrypto API**: Cifrado nativo del navegador
- **JavaScript ES6+**: Lógica de aplicación y criptografía

### Cifrado Híbrido
1. **Generación de claves**: RSA-OAEP 2048 bits por usuario
2. **Cifrado del mensaje**: AES-GCM 256 bits (simétrico, rápido)
3. **Cifrado de la clave AES**: RSA-OAEP con clave pública del destinatario
4. **Envío al servidor**: Solo datos cifrados, nunca texto plano

## 📁 Estructura del Proyecto

```
safesender/
├── app.py                 # Backend Flask
├── requirements.txt       # Dependencias Python
├── README.md             # Este archivo
├── templates/
│   └── index.html        # Página principal
└── static/
    ├── css/
    │   └── style.css     # Estilos personalizados
    └── js/
        ├── crypto.js     # Módulo de criptografía E2EE
        └── app.js        # Lógica principal de la aplicación
```

## 🔐 Detalles de Seguridad

### Cifrado Extremo a Extremo
- **RSA-OAEP-2048**: Para cifrado asimétrico de claves
- **AES-GCM-256**: Para cifrado simétrico de mensajes
- **SHA-256**: Para funciones hash
- **WebCrypto API**: Implementación nativa y segura del navegador

### Privacidad y Anonimato
- **IDs UUID v4**: Identificadores aleatorios sin datos personales
- **Sin autenticación**: No requiere cuentas ni contraseñas
- **Sin logs de IP**: El servidor no almacena información de conexión
- **Sin persistencia**: Los datos se almacenan solo en memoria

### Mensajes Efímeros
- **Autodestrucción por lectura**: Se eliminan al ser descifrados
- **Autodestrucción por tiempo**: Se eliminan tras 10 minutos
- **Limpieza automática**: Hilo de limpieza cada 60 segundos

## 🚀 Despliegue en Producción

### Requisitos Críticos para Producción

1. **HTTPS Obligatorio**: SafeSender SOLO debe usarse con HTTPS
```bash
# Ejemplo con gunicorn y certificado SSL
gunicorn --bind 0.0.0.0:443 --keyfile=private.key --certfile=certificate.crt app:app
```

2. **Servidor WSGI**: No usar el servidor de desarrollo de Flask
```bash
pip install gunicorn
gunicorn --workers 4 --bind 0.0.0.0:8000 app:app
```

3. **Proxy Reverso**: Usar nginx o Apache con SSL
```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

4. **Variables de Entorno**
```bash
export FLASK_ENV=production
export SECRET_KEY="tu-clave-secreta-muy-segura"
```

### Configuraciones Adicionales de Seguridad

- **Content Security Policy (CSP)**
- **HSTS Headers**
- **Rate Limiting**
- **Firewall de Aplicación Web (WAF)**

## 🧪 Testing

### Probar Localmente
1. Abre dos ventanas de navegador en modo incógnito
2. En cada ventana, ve a `http://127.0.0.1:5000`
3. Copia el ID de una ventana
4. En la otra ventana, envía un mensaje a ese ID
5. Actualiza los mensajes para ver el mensaje cifrado
6. Haz clic en el mensaje para descifrarlo

### Verificar Cifrado
- Abre las herramientas de desarrollador (F12)
- Ve a la pestaña "Network"
- Envía un mensaje y verifica que el payload esté cifrado

## ⚠️ Advertencias de Seguridad

1. **HTTPS Obligatorio**: Nunca uses HTTP en producción
2. **Navegadores Modernos**: Requiere soporte de WebCrypto API
3. **JavaScript Habilitado**: La aplicación no funciona sin JavaScript
4. **Claves Locales**: Si pierdes el navegador, pierdes acceso a los mensajes
5. **Sin Respaldo**: Los mensajes no se pueden recuperar una vez eliminados

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🔗 Referencias

- [WebCrypto API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.0/)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

**SafeSender v1.0** - Mensajería anónima y segura con cifrado extremo a extremo 🔒