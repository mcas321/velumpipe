/**
 * SafeSender - Módulo de Criptografía E2EE
 * ==========================================
 * 
 * Este módulo maneja todo el cifrado y descifrado usando WebCrypto API.
 * Las claves privadas NUNCA salen del navegador del usuario.
 * 
 * Algoritmos utilizados:
 * - RSA-OAEP para cifrado asimétrico (claves de 2048 bits)
 * - AES-GCM para cifrado simétrico (claves de 256 bits)
 * - Híbrido: se cifra el mensaje con AES y la clave AES con RSA
 */

class SafeSenderCrypto {
    constructor() {
        this.keyPair = null;
        this.userId = null;
        this.isInitialized = false;
    }

    /**
     * Inicializa el sistema criptográfico generando un par de claves RSA
     * y un ID de usuario anónimo
     */
    async initialize() {
        try {
            console.log('[CRYPTO] Inicializando sistema criptográfico...');
            
            // Generar ID de usuario anónimo
            this.userId = this.generateUserId();
            console.log('[CRYPTO] ID de usuario generado:', this.userId);
            
            // Generar par de claves RSA-OAEP de 2048 bits
            this.keyPair = await window.crypto.subtle.generateKey(
                {
                    name: 'RSA-OAEP',
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([1, 0, 1]), // 65537
                    hash: 'SHA-256'
                },
                true, // extractable (solo la pública será exportada)
                ['encrypt', 'decrypt']
            );
            
            console.log('[CRYPTO] Par de claves RSA generado exitosamente');
            
            // Exportar clave pública para registro en el servidor
            const publicKeyJWK = await window.crypto.subtle.exportKey('jwk', this.keyPair.publicKey);
            console.log('[CRYPTO] Clave pública exportada');
            
            // Registrar clave pública en el servidor
            await this.registerPublicKey(publicKeyJWK);
            
            this.isInitialized = true;
            console.log('[CRYPTO] ✅ Sistema criptográfico inicializado correctamente');
            
            return {
                userId: this.userId,
                publicKey: publicKeyJWK
            };
            
        } catch (error) {
            console.error('[CRYPTO] ❌ Error inicializando criptografía:', error);
            throw new Error('Error inicializando sistema de cifrado: ' + error.message);
        }
    }

    /**
     * Genera un ID de usuario anónimo usando UUID v4
     */
    generateUserId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Registra la clave pública en el servidor
     */
    async registerPublicKey(publicKeyJWK) {
        try {
            const response = await fetch('/api/register-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    public_key: publicKeyJWK
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Error registrando clave pública');
            }
            
            console.log('[CRYPTO] Clave pública registrada en el servidor');
            
        } catch (error) {
            console.error('[CRYPTO] Error registrando clave pública:', error);
            throw error;
        }
    }

    /**
     * Obtiene la clave pública de otro usuario del servidor
     */
    async getPublicKey(userId) {
        try {
            const response = await fetch(`/api/get-public-key/${userId}`);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Error obteniendo clave pública');
            }
            
            // Importar la clave pública JWK
            const publicKey = await window.crypto.subtle.importKey(
                'jwk',
                result.public_key,
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-256'
                },
                false,
                ['encrypt']
            );
            
            console.log('[CRYPTO] Clave pública del destinatario obtenida e importada');
            return publicKey;
            
        } catch (error) {
            console.error('[CRYPTO] Error obteniendo clave pública:', error);
            throw error;
        }
    }

    /**
     * Cifra un mensaje usando cifrado híbrido (AES + RSA)
     * 
     * @param {string} message - Mensaje en texto plano
     * @param {string} recipientId - ID del destinatario
     * @returns {Object} Datos cifrados listos para enviar
     */
    async encryptMessage(message, recipientId) {
        try {
            if (!this.isInitialized) {
                throw new Error('Sistema criptográfico no inicializado');
            }

            console.log('[CRYPTO] Iniciando cifrado híbrido del mensaje...');
            
            // 1. Obtener clave pública del destinatario
            const recipientPublicKey = await this.getPublicKey(recipientId);
            
            // 2. Generar clave AES-GCM de 256 bits para cifrado simétrico
            const aesKey = await window.crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true, // extractable para poder cifrarla con RSA
                ['encrypt', 'decrypt']
            );
            
            // 3. Generar IV aleatorio para AES-GCM
            const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96 bits para GCM
            
            // 4. Cifrar el mensaje con AES-GCM
            const messageBuffer = new TextEncoder().encode(message);
            const encryptedMessage = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                aesKey,
                messageBuffer
            );
            
            // 5. Exportar la clave AES para cifrarla con RSA
            const aesKeyBuffer = await window.crypto.subtle.exportKey('raw', aesKey);
            
            // 6. Cifrar la clave AES con la clave pública RSA del destinatario
            const encryptedAESKey = await window.crypto.subtle.encrypt(
                {
                    name: 'RSA-OAEP'
                },
                recipientPublicKey,
                aesKeyBuffer
            );
            
            // 7. Preparar los datos cifrados para envío
            const encryptedData = {
                encrypted_message: this.arrayBufferToBase64(encryptedMessage),
                encrypted_key: this.arrayBufferToBase64(encryptedAESKey),
                iv: this.arrayBufferToBase64(iv),
                algorithm: 'AES-GCM-256-RSA-OAEP-2048'
            };
            
            console.log('[CRYPTO] ✅ Mensaje cifrado exitosamente con cifrado híbrido');
            console.log('[CRYPTO] Tamaño mensaje cifrado:', encryptedData.encrypted_message.length, 'caracteres base64');
            console.log('[CRYPTO] Tamaño clave cifrada:', encryptedData.encrypted_key.length, 'caracteres base64');
            
            return encryptedData;
            
        } catch (error) {
            console.error('[CRYPTO] ❌ Error cifrando mensaje:', error);
            throw new Error('Error cifrando mensaje: ' + error.message);
        }
    }

    /**
     * Descifra un mensaje usando cifrado híbrido (RSA + AES)
     * 
     * @param {Object} encryptedData - Datos cifrados recibidos
     * @returns {string} Mensaje descifrado en texto plano
     */
    async decryptMessage(encryptedData) {
        try {
            if (!this.isInitialized) {
                throw new Error('Sistema criptográfico no inicializado');
            }

            console.log('[CRYPTO] Iniciando descifrado híbrido del mensaje...');
            
            // 1. Convertir datos base64 a ArrayBuffer
            const encryptedMessage = this.base64ToArrayBuffer(encryptedData.encrypted_message);
            const encryptedAESKey = this.base64ToArrayBuffer(encryptedData.encrypted_key);
            const iv = this.base64ToArrayBuffer(encryptedData.iv);
            
            // 2. Descifrar la clave AES con nuestra clave privada RSA
            const aesKeyBuffer = await window.crypto.subtle.decrypt(
                {
                    name: 'RSA-OAEP'
                },
                this.keyPair.privateKey,
                encryptedAESKey
            );
            
            // 3. Importar la clave AES descifrada
            const aesKey = await window.crypto.subtle.importKey(
                'raw',
                aesKeyBuffer,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['decrypt']
            );
            
            // 4. Descifrar el mensaje con AES-GCM
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                aesKey,
                encryptedMessage
            );
            
            // 5. Convertir a texto plano
            const decryptedMessage = new TextDecoder().decode(decryptedBuffer);
            
            console.log('[CRYPTO] ✅ Mensaje descifrado exitosamente');
            return decryptedMessage;
            
        } catch (error) {
            console.error('[CRYPTO] ❌ Error descifrando mensaje:', error);
            throw new Error('Error descifrando mensaje: ' + error.message);
        }
    }

    /**
     * Convierte ArrayBuffer a string Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convierte string Base64 a ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Genera un hash seguro de una cadena para verificación
     */
    async generateHash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
        return this.arrayBufferToBase64(hashBuffer);
    }

    /**
     * Verifica que WebCrypto API esté disponible
     */
    static isWebCryptoSupported() {
        return !!(window.crypto && window.crypto.subtle);
    }

    /**
     * Obtiene información sobre las capacidades criptográficas
     */
    getCryptoInfo() {
        return {
            isInitialized: this.isInitialized,
            userId: this.userId,
            hasKeyPair: !!this.keyPair,
            webCryptoSupported: SafeSenderCrypto.isWebCryptoSupported(),
            algorithms: {
                asymmetric: 'RSA-OAEP-2048',
                symmetric: 'AES-GCM-256',
                hash: 'SHA-256'
            }
        };
    }
}

// Instancia global del sistema criptográfico
window.safeSenderCrypto = new SafeSenderCrypto();

// Verificar soporte de WebCrypto al cargar
if (!SafeSenderCrypto.isWebCryptoSupported()) {
    console.error('[CRYPTO] ❌ WebCrypto API no soportada en este navegador');
    alert('Tu navegador no soporta WebCrypto API. Necesitas un navegador moderno para usar SafeSender.');
} else {
    console.log('[CRYPTO] ✅ WebCrypto API disponible');
}