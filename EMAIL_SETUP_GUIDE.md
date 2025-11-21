# Email Setup Guide - Resend Configuration

## Current Configuration
Your `.env` file should have:
```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_DrhxYVgG_C1dceEPDctDQMa5vg9CoHscv
EMAIL_FROM=12230045.gcit@rub.edu.bt
```

## Important: Domain Verification Required

For Resend to send emails, the domain in your `EMAIL_FROM` address must be verified in Resend.

### Steps to Verify Your Domain:

1. **Log in to Resend Dashboard**
   - Go to https://resend.com
   - Log in with your account

2. **Add and Verify Your Domain**
   - Navigate to **Domains** section
   - Click **Add Domain**
   - Enter your domain: `rub.edu.bt`
   - Follow the instructions to add DNS records (SPF and DKIM)
   - Wait for verification to complete (can take a few minutes to 24 hours)

3. **Alternative: Use Resend's Test Domain**
   - If you can't verify your domain immediately, you can use:
     ```
     EMAIL_FROM=onboarding@resend.dev
     ```
   - This is Resend's test domain and works immediately
   - **Note**: This is only for testing. For production, verify your own domain.

## Testing Email Sending

### Option 1: Use the Test Endpoint (Development Only)
```bash
POST http://localhost:5000/api/auth/debug/send-test
Content-Type: application/json

{
  "to": "your-email@example.com"
}
```

### Option 2: Test via Login
1. Try logging in with your registered email
2. Check if you receive the OTP email
3. Check server logs for email sending status

## Common Issues and Solutions

### Issue: "Domain verification error"
**Solution**: Verify your domain in Resend dashboard (see steps above)

### Issue: "Resend API key error"
**Solution**: 
- Check that your `RESEND_API_KEY` is correct
- Verify the API key in Resend dashboard under **API Keys**

### Issue: Emails not received
**Solutions**:
1. Check spam/junk folder
2. Verify domain is verified in Resend
3. Check server logs for errors
4. Try using `onboarding@resend.dev` as EMAIL_FROM for testing

## Server Restart Required

After changing `.env` file, **restart your backend server** for changes to take effect.

## Checking Email Status

Check your server logs for:
- `RESEND_EMAIL_SENT` - Email sent successfully
- `RESEND_SEND_FAILED` - Email sending failed (check error message)
- `EMAIL_PROVIDER_READY` - Email provider initialized correctly

## Next Steps

1. ✅ Verify your domain in Resend (or use `onboarding@resend.dev` for testing)
2. ✅ Restart your backend server
3. ✅ Test email sending using the test endpoint or login
4. ✅ Check your email inbox (and spam folder)

