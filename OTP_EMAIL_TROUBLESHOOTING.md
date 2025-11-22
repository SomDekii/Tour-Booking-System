# OTP Email Not Received - Troubleshooting Guide

## Quick Checklist

1. ✅ **Server Restarted?** - After changing `.env`, you MUST restart the server
2. ✅ **Check Spam Folder** - Gmail often filters automated emails
3. ✅ **Check Email Address** - Verify the email is correct
4. ✅ **Check Resend Dashboard** - See if emails are actually being sent

---

## Step 1: Verify Server Configuration

### Check Current Configuration
Your `.env` should have:
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_DrhxYVgG_C1dceEPDctDQMa5vg9CoHscv
EMAIL_FROM=onboarding@resend.dev
```

### Restart Server
**IMPORTANT**: After any `.env` changes, restart your backend server:
```bash
# Stop server (Ctrl+C)
# Then restart
cd backend
npm start
```

---

## Step 2: Check Server Logs

### View Recent OTP Attempts
```bash
# Check logs for OTP sending
tail -f backend/logs/combined.log | grep -i "otp\|resend"

# Look for:
# - RESEND_EMAIL_SENT (success)
# - USER_OTP_EMAIL_SENT (success)
# - RESEND_SEND_FAILED (failure)
```

### What to Look For
- ✅ `RESEND_EMAIL_SENT` with `isResendDomain: true` = Email sent successfully
- ❌ `RESEND_SEND_FAILED` = Email sending failed (check error message)
- ⚠️ `isResendDomain: false` = Using unverified domain (emails may not be delivered)

---

## Step 3: Check Resend Dashboard

1. **Go to**: https://resend.com → **Emails**
2. **Find your email** by:
   - Email ID from logs
   - Recipient email address
   - Time sent
3. **Check Status**:
   - ✅ **Delivered** = Email was delivered (check spam folder)
   - ⚠️ **Pending** = Email is queued
   - ❌ **Bounced** = Email was rejected
   - ❌ **Failed** = Email failed to send

---

## Step 4: Gmail-Specific Issues

### Check Spam/Junk Folder
- Gmail often filters automated emails
- Check **Spam** folder
- Check **Promotions** tab
- Check **All Mail** folder

### Gmail Filters
- Check if you have filters that might be moving emails
- Check **Settings → Filters and Blocked Addresses**

### Gmail Quarantine
- Sometimes Gmail quarantines emails
- Check **Security** settings in Gmail

---

## Step 5: Test Email Sending

### Use Test Endpoint
```bash
POST http://localhost:5000/api/auth/debug/send-test
Content-Type: application/json

{
  "to": "your-email@gmail.com"
}
```

### Expected Response
```json
{
  "ok": true,
  "message": "Test email sent to your-email@gmail.com",
  "provider": "resend",
  "emailId": "abc123...",
  "domain": "resend.dev",
  "isResendDomain": true,
  "note": "✅ Email sent successfully. Check your inbox (and spam folder)."
}
```

---

## Step 6: Common Issues & Solutions

### Issue 1: "Email sent but not received"
**Possible Causes:**
- Email in spam folder
- Gmail filtering
- Email address typo

**Solutions:**
1. Check spam folder
2. Check Resend dashboard for delivery status
3. Verify email address is correct
4. Try a different email address

### Issue 2: "RESEND_SEND_FAILED"
**Check Error Message:**
- Domain error → Verify domain in Resend
- API key error → Check RESEND_API_KEY
- Rate limit → Wait before sending more

### Issue 3: Server not using new config
**Solution:**
- Restart server after `.env` changes
- Verify server logs show `EMAIL_PROVIDER_READY` with `provider: resend`

---

## Step 7: Verify Email Configuration

### Check Server Startup Logs
When server starts, you should see:
```
RESEND_CLIENT_READY
EMAIL_PROVIDER_READY { provider: "resend" }
```

If you see `DEV_TRANSPORTER_READY`, the server is still using dev mode.

---

## Step 8: Alternative Solutions

### Option 1: Use Different Email Provider
If Resend isn't working, you can use SMTP:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

**Note**: For Gmail, you need an App Password (not regular password).

### Option 2: Check Resend Account
- Verify your Resend account is active
- Check if you've hit sending limits
- Verify API key is correct

---

## Step 9: Debug Steps

1. **Check Logs**:
   ```bash
   tail -f backend/logs/combined.log | grep -i "email\|otp"
   ```

2. **Test Email**:
   ```bash
   curl -X POST http://localhost:5000/api/auth/debug/send-test \
     -H "Content-Type: application/json" \
     -d '{"to":"your-email@gmail.com"}'
   ```

3. **Check Resend Dashboard**:
   - Go to https://resend.com
   - Check **Emails** section
   - Find your email and check status

4. **Verify Email Address**:
   - Make sure the email in your account is correct
   - Try logging in with a different email

---

## Still Not Working?

1. **Check Resend Dashboard** for detailed error messages
2. **Check server logs** for specific errors
3. **Try test endpoint** to isolate the issue
4. **Check spam folder** thoroughly
5. **Contact Resend Support** if emails show as sent but not received
6. **Try different email address** to rule out email-specific issues

---

## Quick Fix Checklist

- [ ] Server restarted after `.env` changes
- [ ] `EMAIL_FROM=onboarding@resend.dev` in `.env`
- [ ] `EMAIL_PROVIDER=resend` in `.env`
- [ ] `RESEND_API_KEY` is correct
- [ ] Checked spam folder
- [ ] Checked Resend dashboard
- [ ] Verified email address is correct
- [ ] Tested with test endpoint

---

**Most Common Issue**: Server not restarted after `.env` changes. Always restart after modifying `.env`!

