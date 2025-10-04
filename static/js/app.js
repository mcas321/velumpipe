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
        this.MESSAGE_CHECK_INTERVAL = 5000; // 5 seconds
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
            
            // Update UI with user information
            this.updateUserInfo(cryptoResult.userId);
            this.updateUserStatus('encryption system active', 'success');
            
        } catch (error) {
            this.updateUserStatus('crypto system error', 'error');
            throw error;
        }
    }

    /**
     * Set up interface event listeners
     */
    setupUI() {
        // Formulario de envío de mensajes
        document.getElementById('sendMessageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Refresh messages button
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

        console.log('[APP] Event listeners configured');
    }

    /**
     * Update user information in the UI
     */
    updateUserInfo(userId) {
        document.getElementById('yourUserId').value = userId;
        
        // Activar tooltip para el botón de copiar
        const copyButton = document.getElementById('copyIdButton');
        new bootstrap.Tooltip(copyButton);
    }

    /**
     * Update user status
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
     * Send encrypted message with validation
     */
    async sendMessage() {
        try {
            const recipientId = document.getElementById('recipientId').value.trim();
            const messageText = document.getElementById('messageText').value.trim();
            const sendButton = document.getElementById('sendButton');

            // Basic validation
            if (!recipientId || !messageText) {
                this.showResult('Please complete all fields', 'error');
                return;
            }

            if (!this.isValidUUID(recipientId)) {
                this.showResult('Invalid recipient ID format', 'error');
                return;
            }

            // Character count validation
            if (messageText.length > 800) {
                this.showResult('Message too long. Max 800 characters allowed', 'error');
                return;
            }

            // Disable form during send
            sendButton.disabled = true;
            sendButton.innerHTML = '[ENCRYPTING] & [SENDING]...';
            
            console.log('[APP] Starting message send...');

            // Encrypt message
            const encryptedData = await window.velumPipeCrypto.encryptMessage(messageText, recipientId);
            
            // Send to server
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipient_id: recipientId,
                    encrypted_data: encryptedData,
                    sender_id: this.currentUserId // Optional for anonymity
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showResult('[SUCCESS] message encrypted and transmitted', 'success');
                
                // Clear form
                document.getElementById('sendMessageForm').reset();
                // Clear character counter
                const counter = document.querySelector('.char-counter');
                if (counter) counter.textContent = '0/800';
                
                console.log('[APP] ✅ Message sent successfully');
            } else {
                // Handle rate limit error specially
                if (response.status === 429 && result.wait_time) {
                    this.showResult(`[RATE LIMIT] wait ${Math.ceil(result.wait_time)} seconds before sending again`, 'error');
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            }

        } catch (error) {
            console.error('[APP] ❌ Error sending message:', error);
            this.showResult('[ERROR] transmission failed: ' + error.message, 'error');
        } finally {
            // Re-enable form
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
     * Display messages in the interface
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
            
            // Create a data object for the onclick handler
            const messageData = {
                id: message.id,
                encrypted_data: message.encrypted_data,
                sender_id: message.sender_id,
                timestamp: message.timestamp
            };
            
            messagesHTML += `
                <div class="message-item fade-in-up" data-message-id="${message.id}" onclick="app.openMessageFromList('${message.id}', ${index})">
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
        
        // Store messages for later access
        this.currentMessages = messages;
        console.log('[APP] Displaying', messages.length, 'new messages');
    }

    /**
     * Open message from the messages list
     */
    async openMessageFromList(messageId, messageIndex) {
        if (this.currentMessages && this.currentMessages[messageIndex]) {
            const message = this.currentMessages[messageIndex];
            await this.openMessage(messageId, message.encrypted_data, {
                sender_id: message.sender_id,
                timestamp: message.timestamp
            });
        }
    }

    /**
     * Open and decrypt a message
     */
    async openMessage(messageId, encryptedData, senderInfo = null) {
        try {
            console.log('[APP] Decrypting message:', messageId);
            
            // Show loading modal
            const modal = new bootstrap.Modal(document.getElementById('messageModal'));
            document.getElementById('decryptedMessage').innerHTML = `
                <div class="text-center">
                    <p>[DECRYPTING] processing encrypted data...</p>
                </div>
            `;
            
            // Show sender info if available
            const senderInfoDiv = document.getElementById('senderInfo');
            if (senderInfo && senderInfo.sender_id) {
                senderInfoDiv.style.display = 'block';
                document.getElementById('senderIdDisplay').textContent = senderInfo.sender_id;
                document.getElementById('copySenderIdBtn').setAttribute('data-sender-id', senderInfo.sender_id);
            } else {
                senderInfoDiv.style.display = 'none';
            }
            
            modal.show();

            // Decrypt message
            const decryptedText = await window.velumPipeCrypto.decryptMessage(encryptedData);
            
            // Show decrypted message
            document.getElementById('decryptedMessage').textContent = decryptedText;
            
            // Mark as read on server (for auto-destruction)
            await this.markMessageAsRead(messageId);
            
            // Store ID for auto-destruction on close
            document.getElementById('messageModal').setAttribute('data-message-id', messageId);
            
            console.log('[APP] Message decrypted and displayed successfully');

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
            
            // Update messages list
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
        
        // Auto-hide after 5 seconds
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
     * Validate message text character count
     */
    validateMessageText() {
        const input = document.getElementById('messageText');
        const value = input.value;
        const maxChars = 800;
        const charCount = value.length;
        
        if (charCount > maxChars) {
            input.classList.add('is-invalid');
        } else {
            input.classList.remove('is-invalid');
        }
        
        // Show character counter
        const counter = document.querySelector('.char-counter') || (() => {
            const counter = document.createElement('small');
            counter.className = 'form-text char-counter';
            input.parentNode.appendChild(counter);
            return counter;
        })();
        
        counter.textContent = `${charCount}/${maxChars}`;
        counter.className = charCount > maxChars ? 
            'form-text char-counter text-danger' : 
            'form-text char-counter text-muted';
    }

    /**
     * Copy sender ID to clipboard
     */
    async copySenderId() {
        const btn = document.getElementById('copySenderIdBtn');
        const senderId = btn.getAttribute('data-sender-id');
        
        if (!senderId) return;
        
        try {
            await navigator.clipboard.writeText(senderId);
            
            // Update button text temporarily
            const originalText = btn.textContent;
            btn.textContent = '[COPIED]';
            btn.classList.add('btn-success');
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('btn-success');
            }, 2000);
            
            console.log('[APP] Sender ID copied to clipboard');
        } catch (error) {
            console.error('[APP] Error copying sender ID:', error);
            this.showError('Failed to copy sender ID');
        }
    }

    /**
     * Auto-fill recipient ID with sender ID
     */
    replyToSender() {
        const btn = document.getElementById('copySenderIdBtn');
        const senderId = btn.getAttribute('data-sender-id');
        
        if (senderId) {
            document.getElementById('recipientId').value = senderId;
            
            // Close modal and focus on message text
            const modal = bootstrap.Modal.getInstance(document.getElementById('messageModal'));
            modal.hide();
            
            // Focus on message text after modal closes
            setTimeout(() => {
                document.getElementById('messageText').focus();
            }, 300);
            
            console.log('[APP] Reply mode activated for sender:', senderId.substring(0, 8) + '...');
        }
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