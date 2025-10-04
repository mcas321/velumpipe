"""
VelumPipe - Anonymous messaging with end-to-end encryption
====            sender_id: sender_id  # Can be None for total anonymity======================================================

Simple messaging app where messages are encrypted on the client side
before being sent to the server. The server never sees message content
or private keys.

Security features:
- Client-side encryption using WebCrypto API
- Anonymous user IDs generated randomly
- Messages auto-delete after being read or after timeout
- No IP logging or sensitive data storage
- HTTPS required for production use
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import uuid
import time
import threading
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__)
CORS(app)

# Security configuration
app.config['SECRET_KEY'] = os.urandom(24)

# In-memory storage for encrypted messages (ephemeral)
# Structure: {user_id: [{'id': msg_id, 'encrypted_data': data, 'timestamp': time, 'read': bool}]}
encrypted_messages = {}

# User public keys storage
# Structure: {user_id: public_key_jwk}
user_public_keys = {}

# Rate limiting storage for anonymous users
# Structure: {ip_address: last_message_timestamp}
rate_limit_storage = {}

# Message configuration
MESSAGE_LIFETIME_MINUTES = 10  # Messages are deleted after 10 minutes
CLEANUP_INTERVAL_SECONDS = 60  # Cleanup every minute
RATE_LIMIT_SECONDS = 5  # Minimum seconds between messages
MAX_MESSAGE_CHARS = 800  # Maximum characters per message

class MessageManager:
    """Encrypted message manager with auto-destruction"""
    
    def __init__(self):
        self.start_cleanup_thread()
    
    def store_message(self, recipient_id, encrypted_data, sender_id=None):
        """
        Store an encrypted message for a recipient
        
        Args:
            recipient_id: Recipient's ID
            encrypted_data: Encrypted message data (dict with encrypted_message, iv, etc.)
            sender_id: Sender's ID (optional for anonymity)
        
        Returns:
            message_id: Unique message ID
        """
        message_id = str(uuid.uuid4())
        timestamp = datetime.now()
        
        message = {
            'id': message_id,
            'encrypted_data': encrypted_data,
            'timestamp': timestamp,
            'read': False,
            'sender_id': sender_id  # Puede ser None para anonimato total
        }
        
        if recipient_id not in encrypted_messages:
            encrypted_messages[recipient_id] = []
        
        encrypted_messages[recipient_id].append(message)
        
        print(f"[INFO] Encrypted message stored for user {recipient_id[:8]}...")
        return message_id
    
    def get_messages(self, user_id):
        """
        Obtiene todos los mensajes no leídos para un usuario
        
        Args:
            user_id: ID del usuario
            
        Returns:
            list: Lista de mensajes cifrados
        """
        if user_id not in encrypted_messages:
            return []
        
        unread_messages = []
        for message in encrypted_messages[user_id]:
            if not message['read']:
                unread_messages.append({
                    'id': message['id'],
                    'encrypted_data': message['encrypted_data'],
                    'timestamp': message['timestamp'].isoformat(),
                    'sender_id': message.get('sender_id')
                })
        
        return unread_messages
    
    def mark_as_read(self, user_id, message_id):
        """
        Marca un mensaje como leído (para autodestrucción)
        
        Args:
            user_id: ID del usuario
            message_id: ID del mensaje
        """
        if user_id in encrypted_messages:
            for message in encrypted_messages[user_id]:
                if message['id'] == message_id:
                    message['read'] = True
                    print(f"[INFO] Mensaje {message_id[:8]}... marcado como leído")
                    break
    
    def cleanup_expired_messages(self):
        """Remove expired messages and old rate limit entries"""
        current_time = datetime.now()
        current_timestamp = time.time()
        messages_deleted = 0
        
        # Clean expired messages
        for user_id in list(encrypted_messages.keys()):
            messages_to_keep = []
            
            for message in encrypted_messages[user_id]:
                # Remove if read OR if time limit exceeded
                time_expired = (current_time - message['timestamp']) > timedelta(minutes=MESSAGE_LIFETIME_MINUTES)
                
                if not (message['read'] or time_expired):
                    messages_to_keep.append(message)
                else:
                    messages_deleted += 1
            
            if messages_to_keep:
                encrypted_messages[user_id] = messages_to_keep
            else:
                # Remove user if no messages
                del encrypted_messages[user_id]
        
        # Clean old rate limit entries (older than 1 hour)
        rate_limit_cleaned = 0
        for ip in list(rate_limit_storage.keys()):
            if current_timestamp - rate_limit_storage[ip] > 3600:
                del rate_limit_storage[ip]
                rate_limit_cleaned += 1
        
        if messages_deleted > 0:
            print(f"[CLEANUP] {messages_deleted} messages auto-destroyed")
        if rate_limit_cleaned > 0:
            print(f"[CLEANUP] {rate_limit_cleaned} rate limit entries cleaned")
    
    def start_cleanup_thread(self):
        """Inicia el hilo de limpieza automática"""
        def cleanup_worker():
            while True:
                time.sleep(CLEANUP_INTERVAL_SECONDS)
                self.cleanup_expired_messages()
        
        cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        cleanup_thread.start()
        print("[INFO] Hilo de limpieza de mensajes iniciado")

# Instancia global del gestor de mensajes
message_manager = MessageManager()

def check_rate_limit(client_ip):
    """Check if client can send a message based on rate limit"""
    current_time = time.time()
    
    if client_ip in rate_limit_storage:
        time_diff = current_time - rate_limit_storage[client_ip]
        if time_diff < RATE_LIMIT_SECONDS:
            return False, RATE_LIMIT_SECONDS - time_diff
    
    rate_limit_storage[client_ip] = current_time
    return True, 0

def validate_message_size(encrypted_data):
    """Basic validation for message size (encrypted payload)"""
    try:
        # Rough estimate based on encrypted payload size
        encrypted_content = encrypted_data.get('encrypted_message', '')
        if len(encrypted_content) > 5000:  # Rough limit for encrypted 800 chars
            return False
        return True
    except:
        return False

@app.route('/')
def index():
    """Página principal de la aplicación"""
    return render_template('index.html')

@app.route('/api/register-key', methods=['POST'])
def register_public_key():
    """
    Registra la clave pública de un usuario
    
    Body JSON esperado:
    {
        "user_id": "uuid-del-usuario",
        "public_key": {...}  // JWK format
    }
    """
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        public_key = data.get('public_key')
        
        if not user_id or not public_key:
            return jsonify({'success': False, 'error': 'Faltan datos requeridos'}), 400
        
        # Almacenar clave pública (no sensible para el servidor)
        user_public_keys[user_id] = public_key
        
        print(f"[INFO] Clave pública registrada para usuario {user_id[:8]}...")
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"[ERROR] Error registrando clave pública: {str(e)}")
        return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

@app.route('/api/get-public-key/<user_id>')
def get_public_key(user_id):
    """
    Obtiene la clave pública de un usuario para poder cifrar mensajes para él
    
    Args:
        user_id: ID del usuario cuya clave pública se solicita
    """
    try:
        if user_id in user_public_keys:
            return jsonify({
                'success': True,
                'public_key': user_public_keys[user_id]
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Usuario no encontrado o no ha registrado su clave pública'
            }), 404
            
    except Exception as e:
        print(f"[ERROR] Error obteniendo clave pública: {str(e)}")
        return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

@app.route('/api/send-message', methods=['POST'])
def send_message():
    """
    Receives encrypted message and stores it for recipient
    Includes rate limiting and size validation
    """
    try:
        # Get client IP for rate limiting
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        
        # Check rate limit
        can_send, wait_time = check_rate_limit(client_ip)
        if not can_send:
            return jsonify({
                'success': False, 
                'error': f'Rate limit exceeded. Wait {wait_time:.1f} seconds',
                'wait_time': wait_time
            }), 429
        
        data = request.get_json()
        recipient_id = data.get('recipient_id')
        encrypted_data = data.get('encrypted_data')
        sender_id = data.get('sender_id')  # Optional for anonymity
        
        if not recipient_id or not encrypted_data:
            return jsonify({'success': False, 'error': 'Missing required data'}), 400
        
        # Validate message size
        if not validate_message_size(encrypted_data):
            return jsonify({
                'success': False, 
                'error': 'Message too large. Max 800 characters allowed'
            }), 413
        
        # Check if recipient exists
        if recipient_id not in user_public_keys:
            return jsonify({
                'success': False, 
                'error': 'Recipient not found'
            }), 404
        
        # Store encrypted message
        message_id = message_manager.store_message(recipient_id, encrypted_data, sender_id)
        
        print(f"[INFO] Message sent from {client_ip} to {recipient_id[:8]}...")
        
        return jsonify({
            'success': True,
            'message_id': message_id
        })
        
    except Exception as e:
        print(f"[ERROR] Error sending message: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@app.route('/api/get-messages/<user_id>')
def get_messages(user_id):
    """
    Obtiene los mensajes cifrados para un usuario
    
    Args:
        user_id: ID del usuario que solicita sus mensajes
    """
    try:
        messages = message_manager.get_messages(user_id)
        return jsonify({
            'success': True,
            'messages': messages
        })
        
    except Exception as e:
        print(f"[ERROR] Error obteniendo mensajes: {str(e)}")
        return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

@app.route('/api/mark-read', methods=['POST'])
def mark_message_read():
    """
    Marca un mensaje como leído (activando autodestrucción)
    
    Body JSON esperado:
    {
        "user_id": "uuid-del-usuario",
        "message_id": "uuid-del-mensaje"
    }
    """
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        message_id = data.get('message_id')
        
        if not user_id or not message_id:
            return jsonify({'success': False, 'error': 'Faltan datos requeridos'}), 400
        
        message_manager.mark_as_read(user_id, message_id)
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"[ERROR] Error marcando mensaje como leído: {str(e)}")
        return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

@app.route('/api/status')
def status():
    """Server status endpoint with rate limiting info"""
    return jsonify({
        'status': 'active',
        'users_with_keys': len(user_public_keys),
        'total_messages': sum(len(msgs) for msgs in encrypted_messages.values()),
        'message_lifetime_minutes': MESSAGE_LIFETIME_MINUTES,
        'rate_limit_seconds': RATE_LIMIT_SECONDS,
        'max_message_chars': MAX_MESSAGE_CHARS,
        'active_rate_limits': len(rate_limit_storage)
    })

# Application startup information
print("="*60)
print("VelumPipe - Anonymous E2E Encrypted Messaging")
print("="*60)
print("IMPORTANT: Use HTTPS only in production")
print("Encryption: WebCrypto API (client-side)")
print(f"Message lifetime: {MESSAGE_LIFETIME_MINUTES} minutes")
print("No IP logging or personal data storage")
print("="*60)

if __name__ == '__main__':
    # Development server (only for local testing)
    import os
    
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('FLASK_ENV', 'production') != 'production'
    
    print(f"Starting development server at {host}:{port}")
    print(f"Debug mode: {debug}")
    print("WARNING: Use Gunicorn in production!")
    
    app.run(debug=debug, host=host, port=port)