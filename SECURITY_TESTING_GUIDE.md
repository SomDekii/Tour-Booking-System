# Security Testing Guide

## Overview
This guide provides step-by-step instructions for testing all security features implemented in the Tour Booking System.

---

## 1. Password Security Testing

### Test: Password Hashing
```bash
# Register a new user and check database
# Password should be hashed, not plain text
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Test@123456789"}'

# Check MongoDB - password should be bcrypt hash
```

### Test: Password Strength Validation
```bash
# Should fail - password too short
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test2@example.com","password":"short"}'

# Should fail - missing uppercase
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test3@example.com","password":"test@123456789"}'
```

### Test: Brute Force Protection
```bash
# Try 6 login attempts with wrong password
# 6th attempt should return 429 (Too Many Requests)
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

---

## 2. RBAC Testing

### Test: Admin Access
```bash
# Login as admin
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}' | jq -r '.token')

# Should succeed - admin can access all bookings
curl -X GET http://localhost:5000/api/bookings \
  -H "Authorization: Bearer $TOKEN"
```

### Test: User Access Restrictions
```bash
# Login as regular user
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"User@123456789"}' | jq -r '.token')

# Should fail - user cannot access all bookings (403 Forbidden)
curl -X GET http://localhost:5000/api/bookings \
  -H "Authorization: Bearer $TOKEN"

# Should succeed - user can access own bookings
curl -X GET http://localhost:5000/api/bookings/my-bookings \
  -H "Authorization: Bearer $TOKEN"
```

### Test: Permission Denied Logging
```bash
# Check logs for permission denied events
tail -f backend/logs/combined.log | grep PERMISSION_DENIED
```

---

## 3. Input Validation Testing

### Test: XSS Prevention
```bash
# Try to inject XSS in name field
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(\"XSS\")</script>","email":"xss@example.com","password":"Test@123456789"}'

# Check database - script tags should be escaped
# Response should have escaped HTML entities
```

### Test: NoSQL Injection Prevention
```bash
# Try NoSQL injection in login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":{"$ne":null},"password":{"$ne":null}}'

# Should return 400 Bad Request
# Check logs for NOSQL_INJECTION_ATTEMPT
```

### Test: SQL Injection Prevention
```bash
# Try SQL injection (MongoDB doesn't use SQL, but test anyway)
curl -X GET "http://localhost:5000/api/packages?id=1' OR '1'='1"

# Should return 400 or handle gracefully
```

---

## 4. Session Management Testing

### Test: Secure Cookies
```bash
# Login and check cookies
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123456789"}' \
  -v

# Check cookie flags:
# - HttpOnly: true
# - Secure: true (in production)
# - SameSite: None or Lax
```

### Test: Token Expiration
```bash
# Get token
TOKEN="your-token-here"

# Wait for token to expire (1 hour) or modify JWT_EXPIRES_IN to 1m for testing
# Try to access protected endpoint
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Should return 401 Unauthorized with TOKEN_EXPIRED
```

### Test: Logout
```bash
# Login
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123456789"}' | jq -r '.token')

# Logout
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -v

# Cookies should be cleared
# Try to use token again - should fail
```

---

## 5. Encryption Testing

### Test: Data at Rest Encryption
```bash
# Create a booking with sensitive data
# Check MongoDB - sensitive fields should be encrypted
# Contact info, payment details should be encrypted objects
```

### Test: Data in Transit (HTTPS)
```bash
# In production, try HTTP request
curl http://your-domain.com/api/packages

# Should redirect to HTTPS
# Or return 403 if HTTPS enforcement is strict
```

---

## 6. Error Handling Testing

### Test: No Sensitive Data in Errors
```bash
# Trigger an error (e.g., invalid login)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"wrong"}'

# Check response - should NOT contain:
# - Stack traces (in production)
# - Database errors
# - Internal paths
# - Sensitive information
```

### Test: Logging Sensitive Data
```bash
# Check logs
cat backend/logs/combined.log | grep -i password

# Passwords should be [REDACTED]
# Tokens should be [REDACTED]
# API keys should be [REDACTED]
```

---

## 7. Rate Limiting Testing

### Test: General Rate Limit
```bash
# Make 101 requests in 15 minutes
for i in {1..101}; do
  curl -X GET http://localhost:5000/api/packages
done

# 101st request should return 429 Too Many Requests
```

### Test: Auth Rate Limit
```bash
# Make 6 login attempts
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done

# 6th attempt should return 429
```

---

## 8. CSRF Protection Testing

### Test: CSRF Validation
```bash
# Try POST request without Origin header
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tourPackageId":"...","numberOfPeople":2}'

# In production, should return 403 if Origin not in whitelist
```

---

## 9. Security Headers Testing

### Test: Security Headers
```bash
# Check response headers
curl -I http://localhost:5000/api/packages

# Should include:
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
# - X-XSS-Protection: 1; mode=block
# - Content-Security-Policy: ...
# - Strict-Transport-Security: ... (in production)
```

---

## 10. Penetration Testing Checklist

### Authentication
- [ ] Test password strength requirements
- [ ] Test account lockout
- [ ] Test session timeout
- [ ] Test token expiration
- [ ] Test logout functionality

### Authorization
- [ ] Test RBAC permissions
- [ ] Test resource ownership
- [ ] Test privilege escalation attempts
- [ ] Test unauthorized access attempts

### Input Validation
- [ ] Test XSS attacks
- [ ] Test SQL/NoSQL injection
- [ ] Test command injection
- [ ] Test file upload validation
- [ ] Test path traversal

### Session Management
- [ ] Test cookie security flags
- [ ] Test session fixation
- [ ] Test session hijacking prevention
- [ ] Test concurrent sessions

### Encryption
- [ ] Verify data encryption at rest
- [ ] Verify HTTPS enforcement
- [ ] Test certificate validation
- [ ] Test weak cipher detection

---

## 11. Automated Security Testing

### Using OWASP ZAP
```bash
# Install OWASP ZAP
# Run automated scan
zap-cli quick-scan http://localhost:5000
```

### Using npm audit
```bash
cd backend
npm audit
npm audit fix
```

### Using Snyk
```bash
npm install -g snyk
snyk test
snyk monitor
```

---

## 12. Compliance Testing

### GDPR Compliance
- [ ] Test data access request
- [ ] Test data deletion request
- [ ] Verify data encryption
- [ ] Check audit logs

### HIPAA Compliance (if applicable)
- [ ] Verify PHI encryption
- [ ] Test access controls
- [ ] Check audit trail
- [ ] Verify data integrity

### FERPA Compliance (if applicable)
- [ ] Verify student data protection
- [ ] Test access controls
- [ ] Check audit logs
- [ ] Verify data encryption

---

## 13. Reporting

### Security Test Report Template

```markdown
# Security Test Report

## Test Date: [DATE]
## Tester: [NAME]
## Application: Tour Booking System

## Summary
- Total Tests: [NUMBER]
- Passed: [NUMBER]
- Failed: [NUMBER]
- Warnings: [NUMBER]

## Findings
1. [Finding 1]
2. [Finding 2]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

## Conclusion
[Overall assessment]
```

---

## 14. Continuous Security Testing

### Regular Testing Schedule
- **Daily**: Automated dependency scanning
- **Weekly**: Manual security testing
- **Monthly**: Full penetration testing
- **Quarterly**: Compliance audit

### Tools
- OWASP ZAP for automated scanning
- npm audit for dependency vulnerabilities
- Manual testing for business logic flaws
- Code reviews for security issues

---

## Conclusion

Regular security testing is essential to maintain the security posture of the application. This guide should be used regularly to ensure all security features are working correctly.

