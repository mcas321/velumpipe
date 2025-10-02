/**
 * VelumPipe - Main Application
 * ============================
 * 
 * Controls the user interface and coordinates encryption operations,
 * sending and receiving anonymous messages.
 */

class VelumPipeApp {
    constructor() {
        this.currentUserId = null;
        this.isInitialized = false;
        this.messageCheckInterval = null;
        this.MESSAGE_CHECK_INTERVAL = 5000; // 5 segundos
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('[APP] Initializing VelumPipe...');
            
            // Verificar soporte de WebCrypto
            if (!VelumPipeCrypto.isWebCryptoSupported()) {
                this.showError('Tu navegador no soporta las funciones de cifrado necesarias.');
                return;
            }

            // Inicializar sistema criptográfico
            await this.initializeCrypto();
            
            // Configurar interfaz de usuario  
            this.setupUI();
            
            // Iniciar verificación periódica de mensajes
            this.startMessagePolling();
            
            this.isInitialized = true;
            console.log('[APP] VelumPipe initialized successfully');
            
        } catch (error) {
            console.error('[APP] ❌ Error inicializando aplicación:', error);
            this.showError('Error inicializando la aplicación: ' + error.message);
        }
    }

    /**
     * Initialize the cryptographic system
     */
    async initializeCrypto() {
        try {
            this.updateUserStatus('generating crypto keys...', 'loading');
            
            const cryptoResult = await window.velumPipeCrypto.initialize();
            this.currentUserId = cryptoResult.userId;
            
            // Actualizar UI con información del usuario
            this.updateUserInfo(cryptoResult.userId);
            this.updateUserStatus('encryption system active', 'success');
            
        } catch (error) {
            this.updateUserStatus('crypto system error', 'error');
            throw error;
        }
    }

    /**
     * Configura los event listeners de la interfaz
     */
    setupUI() {
        // Formulario de envío de mensajes
        document.getElementById('sendMessageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Botón de actualizar mensajes
        document.getElementById('refreshMessages').addEventListener('click', () => {
            this.checkForMessages();
        });

        // Botón de copiar ID
        document.getElementById('copyIdButton').addEventListener('click', () => {
            this.copyUserId();
        });

        // Manejar cierre del modal de mensaje (autodestrucción)
        const messageModal = document.getElementById('messageModal');
        messageModal.addEventListener('hidden.bs.modal', (e) => {
            this.handleMessageDestruction(e);
        });

        // Validación en tiempo real del formulario
        document.getElementById('recipientId').addEventListener('input', this.validateRecipientId);
        document.getElementById('messageText').addEventListener('input', this.validateMessageText);

        console.log('[APP] Event listeners configurados');
    }

    /**
     * Actualiza la información del usuario en la UI
     */
    updateUserInfo(userId) {
        document.getElementById('yourUserId').value = userId;
        
        // Activar tooltip para el botón de copiar
        const copyButton = document.getElementById('copyIdButton');
        new bootstrap.Tooltip(copyButton);
    }

    /**
     * Actualiza el estado del usuario
     */
    updateUserStatus(message, type = 'info') {
        const statusElement = document.getElementById('userStatus');
        const encryptionStatusElement = document.getElementById('encryptionStatus');
        
        let prefix, alertClass;
        
        switch (type) {
            case 'loading':
                prefix = '[INIT]';
                alertClass = 'alert-warning';
                break;
            case 'success':
                prefix = '[READY]';
                alertClass = 'alert-success';
                break;
            case 'error':
                prefix = '[ERROR]';
                alertClass = 'alert-danger';
                break;
            default:
                prefix = '[INFO]';
                alertClass = 'alert-info';
        }
        
        statusElement.innerHTML = `<span>${prefix} ${message}</span>`;
        
        encryptionStatusElement.className = `alert ${alertClass}`;
        encryptionStatusElement.innerHTML = `${prefix} ${message}`;
    }

    /**
     * Envía un mensaje cifrado
     */
    async sendMessage() {
        try {
            const recipientId = document.getElementById('recipientId').value.trim();
            const messageText = document.getElementById('messageText').value.trim();
            const sendButton = document.getElementById('sendButton');
            const resultDiv = document.getElementById('sendResult');

            // Validación
            if (!recipientId || !messageText) {
                this.showResult('Por favor, completa todos los campos', 'error');
                return;
            }

            if (!this.isValidUUID(recipientId)) {
                this.showResult('ID de destinatario no válido', 'error');
                return;
            }

            // Deshabilitar formulario durante el envío
            sendButton.disabled = true;
            sendButton.innerHTML = '[ENCRYPTING] & [SENDING]...';
            
            console.log('[APP] Iniciando envío de mensaje...');

            // Cifrar mensaje
            const encryptedData = await window.velumPipeCrypto.encryptMessage(messageText, recipientId);
            
            // Enviar al servidor
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipient_id: recipientId,
                    encrypted_data: encryptedData,
                    sender_id: this.currentUserId // Opcional: puede omitirse para anonimato total
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showResult('[SUCCESS] message encrypted and transmitted', 'success');
                
                // Limpiar formulario
                document.getElementById('sendMessageForm').reset();
                
                console.log('[APP] ✅ Mensaje enviado exitosamente');
            } else {
                throw new Error(result.error || 'Error desconocido');
            }

        } catch (error) {
            console.error('[APP] ❌ Error enviando mensaje:', error);
            this.showResult('[ERROR] transmission failed: ' + error.message, 'error');
        } finally {
            // Rehabilitar formulario
            const sendButton = document.getElementById('sendButton');
            sendButton.disabled = false;
            sendButton.innerHTML = '[ENCRYPT] & [SEND]';
        }
    }

    /**
     * Verifica si hay mensajes nuevos
     */
    async checkForMessages() {
        try {
            if (!this.isInitialized) return;

            console.log('[APP] Verificando mensajes nuevos...');

            const response = await fetch(`/api/get-messages/${this.currentUserId}`);
            const result = await response.json();

            if (result.success) {
                this.displayMessages(result.messages);
            } else {
                console.error('[APP] Error obteniendo mensajes:', result.error);
            }

        } catch (error) {
            console.error('[APP] ❌ Error verificando mensajes:', error);
        }
    }

    /**
     * Muestra los mensajes en la interfaz
     */
    displayMessages(messages) {
        const messagesList = document.getElementById('messagesList');
        
        if (messages.length === 0) {
            messagesList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <p>// no new messages found</p>
                    <p>// waiting for encrypted data...</p>
                </div>
            `;
            return;
        }

        let messagesHTML = '';
        messages.forEach((message, index) => {
            const timestamp = new Date(message.timestamp).toLocaleString();
            const senderInfo = message.sender_id ? 
                `<small class="text-muted">from: ${message.sender_id.substring(0, 8)}...</small>` : 
                `<small class="text-muted">// anonymous sender</small>`;
            
            messagesHTML += `
                <div class="message-item fade-in-up" data-message-id="${message.id}" onclick="app.openMessage('${message.id}', ${JSON.stringify(message.encrypted_data).replace(/"/g, '&quot;')})">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="message-preview">
                                [ENCRYPTED] click to decrypt and read
                            </div>
                            <div class="message-meta mt-2">
                                ${senderInfo}
                                <br><small class="text-muted">recv: ${timestamp}</small>
                            </div>
                        </div>
                        <div class="text-end">
                            <small>[NEW]</small>
                        </div>
                    </div>
                </div>
            `;
        });

        messagesList.innerHTML = messagesHTML;
        console.log('[APP] Mostrando', messages.length, 'mensajes nuevos');
    }

    /**
     * Abre y descifra un mensaje
     */
    async openMessage(messageId, encryptedData) {
        try {
            console.log('[APP] Descifrando mensaje:', messageId);
            
            // Mostrar modal de carga
            const modal = new bootstrap.Modal(document.getElementById('messageModal'));
            document.getElementById('decryptedMessage').innerHTML = `
                <div class="text-center">
                    <p>[DECRYPTING] processing encrypted data...</p>
                </div>
            `;
            modal.show();

            // Descifrar mensaje
            const decryptedText = await window.velumPipeCrypto.decryptMessage(encryptedData);
            
            // Mostrar mensaje descifrado
            document.getElementById('decryptedMessage').textContent = decryptedText;
            
            // Marcar como leído en el servidor (para autodestrucción)
            await this.markMessageAsRead(messageId);
            
            // Almacenar ID para autodestrucción al cerrar
            document.getElementById('messageModal').setAttribute('data-message-id', messageId);
            
            console.log('[APP] ✅ Mensaje descifrado y mostrado');

        } catch (error) {
            console.error('[APP] ❌ Error descifrando mensaje:', error);
            document.getElementById('decryptedMessage').innerHTML = `
                <div class="alert alert-danger">
                    [ERROR] decryption failed: ${error.message}
                </div>
            `;
        }
    }

    /**
     * Marca un mensaje como leído
     */
    async markMessageAsRead(messageId) {
        try {
            const response = await fetch('/api/mark-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.currentUserId,
                    message_id: messageId
                })
            });

            const result = await response.json();
            if (!result.success) {
                console.error('[APP] Error marcando mensaje como leído:', result.error);
            }

        } catch (error) {
            console.error('[APP] Error marcando mensaje como leído:', error);
        }
    }

    /**
     * Maneja la autodestrucción del mensaje al cerrar el modal
     */
    handleMessageDestruction(event) {
        const messageId = event.target.getAttribute('data-message-id');
        if (messageId) {
            console.log('[APP] 🔥 Mensaje autodestruido:', messageId);
            
            // Limpiar el modal
            document.getElementById('decryptedMessage').innerHTML = '';
            document.getElementById('senderInfo').style.display = 'none';
            event.target.removeAttribute('data-message-id');
            
            // Actualizar lista de mensajes
            this.checkForMessages();
        }
    }

    /**
     * Inicia la verificación periódica de mensajes
     */
    startMessagePolling() {
        this.messageCheckInterval = setInterval(() => {
            this.checkForMessages();
        }, this.MESSAGE_CHECK_INTERVAL);
        
        console.log('[APP] Verificación periódica de mensajes iniciada');
    }

    /**
     * Copia el ID del usuario al portapapeles
     */
    async copyUserId() {
        try {
            await navigator.clipboard.writeText(this.currentUserId);
            
            // Mostrar feedback visual
            const button = document.getElementById('copyIdButton');
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check text-success"></i>';
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 1500);
            
            console.log('[APP] ID copiado al portapapeles');
            
        } catch (error) {
            console.error('[APP] Error copiando ID:', error);
            alert('Tu ID es: ' + this.currentUserId);
        }
    }

    /**
     * Muestra resultado de operaciones
     */
    showResult(message, type = 'info') {
        const resultDiv = document.getElementById('sendResult');
        let alertClass, icon;
        
        switch (type) {
            case 'success':
                alertClass = 'alert-success';
                break;
            case 'error':
                alertClass = 'alert-danger';
                break;
            default:
                alertClass = 'alert-info';
        }
        
        resultDiv.innerHTML = `
            <div class="alert ${alertClass} fade-in-up">
                ${message}
            </div>
        `;
        resultDiv.style.display = 'block';
        
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 5000);
    }

    /**
     * Muestra errores críticos
     */
    showError(message) {
        const statusElement = document.getElementById('userStatus');
        statusElement.innerHTML = `
            <div class="alert alert-danger">
                [FATAL] ${message}
            </div>
        `;
    }

    /**
     * Validación de UUID
     */
    isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Validación del ID del destinatario
     */
    validateRecipientId() {
        const input = document.getElementById('recipientId');
        const value = input.value.trim();
        
        if (value && !app.isValidUUID(value)) {
            input.classList.add('is-invalid');
        } else {
            input.classList.remove('is-invalid');
        }
    }

    /**
     * Validación del texto del mensaje
     */
    validateMessageText() {
        const input = document.getElementById('messageText');
        const value = input.value.trim();
        const maxLength = 10000;
        
        if (value.length > maxLength) {
            input.classList.add('is-invalid');
        } else {
            input.classList.remove('is-invalid');
        }
        
        // Mostrar contador de caracteres
        const counter = document.querySelector('.char-counter') || (() => {
            const counter = document.createElement('small');
            counter.className = 'form-text char-counter';
            input.parentNode.appendChild(counter);
            return counter;
        })();
        
        counter.textContent = `${value.length}/${maxLength} caracteres`;
        counter.className = value.length > maxLength ? 
            'form-text char-counter text-danger' : 
            'form-text char-counter text-muted';
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[APP] DOM loaded, initializing VelumPipe...');
    
    window.app = new VelumPipeApp();
    await window.app.init();
});

// Limpiar interval al cerrar la página
window.addEventListener('beforeunload', () => {
    if (window.app && window.app.messageCheckInterval) {
        clearInterval(window.app.messageCheckInterval);
    }
});