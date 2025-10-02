# VelumPipe

Anonymous messaging web application with end-to-end encryption. Messages are encrypted on the client side before being sent to the server, ensuring only the sender and recipient can read them.

## Security Features

- End-to-end encryption: Messages are encrypted in the browser before transmission
- Anonymous: No emails, passwords, or personal data required
- Local keys: Private keys never leave the browser
- Ephemeral messages: Auto-delete after reading or 10 minutes timeout
- Privacy focused: No IP logging or precise timestamps
- Strong crypto: RSA-OAEP 2048-bit + AES-GCM 256-bit hybrid encryption

## Quick Start

### Installation

1. Clone or download the project
```bash
cd velumpipe
```

2. Install Python dependencies
```bash
pip install -r requirements.txt
```

3. Run the application
```bash
python app.py
```

4. Open your browser
```
http://127.0.0.1:5000
```

### Usage

1. When you open the app, it automatically generates your anonymous ID and encryption keys
2. To receive messages, share your anonymous ID with other users  
3. To send messages, enter the recipient's ID and your message
4. Messages are automatically encrypted before being sent to the server
5. When reading a message, it gets decrypted locally and then auto-deletes

## Technical Architecture

### Backend (Flask)
- app.py: Main server with REST API
- In-memory storage: For encrypted messages (no database)
- Auto-cleanup: Background thread runs every 60 seconds
- Secure APIs: No sensitive data storage

### Frontend
- HTML5 + Bootstrap 5: Responsive modern interface
- WebCrypto API: Native browser encryption
- JavaScript ES6+: Application logic and cryptography

### Hybrid Encryption
1. Key generation: RSA-OAEP 2048-bit per user
2. Message encryption: AES-GCM 256-bit (symmetric, fast)
3. Key encryption: RSA-OAEP with recipient's public key
4. Server transmission: Only encrypted data, never plaintext

## Project Structure

```
velumpipe/
├── app.py                 # Flask backend
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── templates/
│   └── index.html        # Main page
└── static/
    ├── css/
    │   └── style.css     # Custom styles
    └── js/
        ├── crypto.js     # E2EE cryptography module
        └── app.js        # Main application logic
```

## Security Details  

### End-to-End Encryption
- RSA-OAEP-2048: For asymmetric key encryption
- AES-GCM-256: For symmetric message encryption  
- SHA-256: For hash functions
- WebCrypto API: Native secure browser implementation

### Privacy and Anonymity
- UUID v4 IDs: Random identifiers with no personal data
- No authentication: No accounts or passwords required
- No IP logging: Server doesn't store connection information
- No persistence: Data stored only in memory

### Ephemeral Messages
- Auto-delete on read: Messages are deleted when decrypted
- Time-based deletion: Messages expire after 10 minutes
- Automatic cleanup: Background cleanup thread runs every 60 seconds

## Production Deployment

### Critical Production Requirements

1. HTTPS Required: VelumPipe should ONLY be used with HTTPS
```bash
# Example with gunicorn and SSL certificate
gunicorn --bind 0.0.0.0:443 --keyfile=private.key --certfile=certificate.crt app:app
```

2. WSGI Server: Don't use Flask's development server
```bash
pip install gunicorn
gunicorn --workers 4 --bind 0.0.0.0:8000 app:app
```

3. Reverse Proxy: Use nginx or Apache with SSL
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

4. Environment Variables
```bash
export FLASK_ENV=production
export SECRET_KEY="your-very-secure-secret-key"
```

### Additional Security Configurations

- Content Security Policy (CSP)
- HSTS Headers  
- Rate Limiting
- Web Application Firewall (WAF)

## Testing

### Test Locally
1. Open two browser windows in incognito mode
2. Go to `http://127.0.0.1:5000` in each window
3. Copy the ID from one window
4. In the other window, send a message to that ID
5. Refresh messages to see the encrypted message
6. Click the message to decrypt it

### Verify Encryption
- Open developer tools (F12)
- Go to the Network tab
- Send a message and verify the payload is encrypted

## Security Warnings

1. HTTPS Required: Never use HTTP in production
2. Modern Browsers: Requires WebCrypto API support
3. JavaScript Required: App doesn't work without JavaScript
4. Local Keys: If you lose your browser, you lose access to messages
5. No Backup: Messages cannot be recovered once deleted

## Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See `LICENSE` for details.

## References

- [WebCrypto API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.0/)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

**VelumPipe v1.0** - Anonymous secure messaging with end-to-end encryption