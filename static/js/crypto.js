/**
 * VelumPipe - E2E Encryption Module
 * ==================================
 * 
 * Handles all encryption and decryption using WebCrypto API.
 * Private keys NEVER leave the user's browser.
 * 
 * Algorithms used:
 * - RSA-OAEP for asymmetric encryption (2048-bit keys)
 * - AES-GCM for symmetric encryption (256-bit keys)
 * - Hybrid: encrypt message with AES and AES key with RSA
 */

class VelumPipeCrypto {
    constructor() {
        this.keyPair = null;
        this.userId = null;
        this.isInitialized = false;
    }

    /**
     * Initialize cryptographic system by generating RSA key pair
     * and anonymous user ID
     */
    async initialize() {
        try {
            console.log('[CRYPTO] Initializing cryptographic system...');
            
            // Generate anonymous user ID
            this.userId = this.generateUserId();
            console.log('[CRYPTO] User ID generated:', this.userId);
            
            // Generate RSA-OAEP key pair (2048-bit)
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
     * Generate anonymous user ID using UUID v4
     */
    generateUserId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Register public key on the server
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
     * Get another user's public key from the server
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
     * Encrypt message using hybrid encryption (AES + RSA)
     * 
     * @param {string} message - Plaintext message
     * @param {string} recipientId - Recipient ID
     * @returns {Object} Encrypted data ready to send
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
     * Decrypt message using hybrid encryption (RSA + AES)
     * 
     * @param {Object} encryptedData - Encrypted data received
     * @returns {string} Decrypted plaintext message
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
     * Convert ArrayBuffer to Base64 string
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
     * Convert Base64 string to ArrayBuffer
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
     * Generate secure hash of a string for verification
     */
    async generateHash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
        return this.arrayBufferToBase64(hashBuffer);
    }

    /**
     * Check if WebCrypto API is available
     */
    static isWebCryptoSupported() {
        return !!(window.crypto && window.crypto.subtle);
    }

    /**
     * Get information about cryptographic capabilities
     */
    getCryptoInfo() {
        return {
            isInitialized: this.isInitialized,
            userId: this.userId,
            hasKeyPair: !!this.keyPair,
            webCryptoSupported: VelumPipeCrypto.isWebCryptoSupported(),
            algorithms: {
                asymmetric: 'RSA-OAEP-2048',
                symmetric: 'AES-GCM-256',
                hash: 'SHA-256'
            }
        };
    }
}

// Global instance of the cryptographic system
window.velumPipeCrypto = new VelumPipeCrypto();

// Check WebCrypto support on load
if (!VelumPipeCrypto.isWebCryptoSupported()) {
    console.error('[CRYPTO] WebCrypto API not supported in this browser');
    alert('Your browser does not support WebCrypto API. You need a modern browser to use VelumPipe.');
} else {
    console.log('[CRYPTO] WebCrypto API available');
}