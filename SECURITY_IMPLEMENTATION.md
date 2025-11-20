# Enterprise-Grade Security Implementation Guide

## Tour Booking System Security Architecture

This document outlines the comprehensive security implementation for the Bhutan Tourism Booking System, based on best practices from enterprise-grade applications.

---

## 1. Authentication & Authorization

### Password Security (bcrypt)

- All user passwords are hashed using bcrypt with 12 salt rounds before storage
- Plaintext passwords are never logged or stored
- Automatic password hashing in User model middleware

### Multi-Factor Authentication (MFA)

- Time-based One-Time Password (TOTP) verification using Speakeasy
- QR code generation for authenticator app setup
- MFA backup codes for account recovery
- 10 one-time backup codes generated per user
- 5-minute validity window for OTP codes

### JWT Token Management

- Access tokens expire in 15 minutes to limit token theft exposure
- Refresh tokens expire in 30 days for extended sessions
- Tokens stored in HttpOnly cookies to prevent XSS attacks
- Secure and SameSite flags enforced in production
- Token verification middleware on all protected routes

### Role-Based Access Control (RBAC)

- Two roles: `admin` and `user` with distinct permissions
- Middleware enforcement on all protected endpoints
- Admin can manage packages, bookings, and statistics
- Users can only view their own bookings and packages

---

## 2. Data Protection

### AES-256-GCM Encryption

- Sensitive booking details encrypted at rest:
  - Special requests
  - Contact email
  - Contact phone
- Random Initialization Vector (IV) per encryption operation
- Authentication tag for integrity verification
- Encryption key loaded from environment variables

### Secure Data Storage

- MongoDB connection with proper authentication
- No sensitive data stored in plaintext
- Encrypted fields automatically decrypted on authorized access

---

## 3. Input Validation & Output Sanitization

### Server-Side Validation

All endpoints validate inputs before processing:

- **Email**: RFC 5322 compliant format validation
- **Password**: Minimum 12 characters with uppercase, lowercase, numbers, and special characters
- **Phone**: International phone number format validation
- **Numeric Fields**: Range validation (min/max bounds)
- **String Fields**: Length validation and XSS prevention

### Output Sanitization

- HTML entities escaped to prevent XSS injection
- Special characters neutralized before storage
- Response data filtered to prevent information leakage

### Validation Middleware

- `validateSignup`: Registration form validation
- `validateLogin`: Login credential validation
- `validatePackageData`: Package creation/update validation
- `validateBookingData`: Booking submission validation

---

## 4. Session Management

### Secure Cookie Configuration

\`\`\`
HttpOnly: true // Prevents JavaScript access (XSS protection)
Secure: true // HTTPS only in production
SameSite: strict // CSRF protection
maxAge: 15 min // Auto-logout after inactivity
\`\`\`

### Token Expiration & Refresh

- Short-lived access tokens minimize exposure window
- Refresh tokens enable extended sessions with new access tokens
- Expired token handling triggers re-authentication

### Session Logout

- Cookie cleared immediately on logout
- Session invalidated even if token hasn't expired
- Logout events logged for audit trail

---

## 5. Secure Communication

### HTTPS Enforcement

- All production traffic redirected from HTTP to HTTPS
- TLS/SSL encryption for all client-server communication
- HSTS header with 1-year max-age and preload flag

### Security Headers (Helmet)

- **Content-Security-Policy**: Restricts resource loading
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Disables MIME type sniffing
- **Strict-Transport-Security**: Enforces HTTPS
- **X-XSS-Protection**: Browser XSS filter enforcement

### CORS Configuration

- Frontend origin whitelist enforcement
- Credentials allowed for cross-origin requests
- Allowed methods: GET, POST, PUT, PATCH, DELETE
- Allowed headers: Content-Type, Authorization

### Rate Limiting

- General API limit: 100 requests per 15 minutes
- Authentication endpoints: 5 attempts per 15 minutes
- Prevents brute-force and DDoS attacks

---

## 6. Error Handling & Logging

### Winston Structured Logging

- **Console Transport**: Real-time development logging
- **File Transport**: Daily rotating logs (5MB max per file)
- **Error Transport**: Separate error log file for critical issues
- **30-day retention**: Automatic cleanup of old logs

### Audit Trail

Logged events:

- Authentication attempts (success/failure)
- MFA verification results
- Password changes and resets
- Booking creation, updates, and cancellations
- Package management operations
- Unauthorized access attempts
- System errors and exceptions

### Sensitive Data Protection

Never logged:

- Plaintext passwords
- Raw OTP codes
- Raw JWT tokens
- Raw encryption keys
- Personal identifying information (PII) without necessity

---

## 7. Environment Variables

### Required Configuration

\`\`\`

# MongoDB

MONGODB_URI=your_mongodb_connection_string

# Server

PORT=5000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com

# JWT

JWT_SECRET=your_very_long_random_secret_key
JWT_REFRESH_SECRET=your_very_long_random_refresh_secret
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=30d

# Encryption

ENCRYPTION_KEY=your_32_byte_hex_key_for_aes_256

# Email (optional, for password reset)

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Logging

LOG_LEVEL=info
LOG_DIR=./logs
\`\`\`

---

## 8. Security Best Practices Implemented

| Security Aspect      | Implementation                      | Benefit                                       |
| -------------------- | ----------------------------------- | --------------------------------------------- |
| **Confidentiality**  | bcrypt + AES-256-GCM + HTTPS        | Passwords and data never exposed in plaintext |
| **Integrity**        | JWT tokens + RBAC + encryption tags | Only authorized users can access/modify data  |
| **Availability**     | Rate limiting + error handling      | System resilient against attacks              |
| **Auditing**         | Winston logs with audit trail       | Complete record of security events            |
| **Defense in Depth** | Multiple security layers            | Comprehensive protection across all vectors   |

---

## 9. Testing the Security Implementation

### Manual Testing Checklist

1. **Authentication**

   - Register with valid/invalid credentials
   - Login with correct/incorrect password
   - Verify MFA requirement
   - Test token expiration and refresh

2. **Authorization**

   - Access admin endpoints as user (should fail with 403)
   - Access user endpoints as admin (should succeed)
   - Try accessing other users' bookings (should fail with 403)

3. **Data Protection**

   - Verify encrypted data in MongoDB
   - Confirm decryption works on authorized access
   - Test encryption key rotation scenario

4. **Input Validation**

   - Submit invalid email format (should fail)
   - Submit weak password (should fail)
   - Submit XSS payload in special requests (should be escaped)
   - Test SQL injection attempts (should be sanitized)

5. **HTTPS & Headers**

   - Verify browser shows secure padlock
   - Check response headers for security configurations
   - Confirm HTTP requests redirect to HTTPS

6. **Rate Limiting**
   - Make 6 rapid login attempts (should be blocked)
   - Wait 15 minutes and try again (should succeed)

---

## 10. Deployment Checklist

Before deploying to production:

- [ ] Set all environment variables with secure values
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure MongoDB with authentication
- [ ] Set `NODE_ENV=production`
- [ ] Run `npm audit` and address vulnerabilities
- [ ] Enable logging rotation
- [ ] Configure backup strategy
- [ ] Set up monitoring for error logs
- [ ] Enable CORS for production domain only
- [ ] Test all authentication flows
- [ ] Verify encryption is working
- [ ] Test rate limiting

---

## 11. Security Incident Response

### If Credentials Are Compromised

1. Force password reset for affected user
2. Invalidate all existing tokens
3. Review audit logs for unauthorized access
4. Notify user of security incident

### If Encryption Key Is Leaked

1. Generate new encryption key
2. Rotate all encrypted data with new key
3. Audit all data access logs
4. Implement key rotation policy

### If Unauthorized Access Detected

1. Review audit logs to identify scope
2. Isolate affected user accounts
3. Implement emergency rate limiting
4. Alert security team

---

## 12. Compliance

This implementation supports compliance with:

- **GDPR**: User data encryption, audit trails, data access controls
- **HIPAA**: Not applicable for tourism bookings, but encryption protects sensitive PII
- **PCI DSS**: Not handling payment data, but security practices align with standards
- **SOC 2**: Audit logging, access controls, data protection

---

## Version History

- v1.0 - Initial enterprise security implementation
- Based on Grade Portal security architecture
- Implemented: 2025-11-20
