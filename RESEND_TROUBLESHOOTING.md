# Resend Email Troubleshooting Guide

## Issue: Emails Sent but Not Received

If your logs show `RESEND_EMAIL_SENT` but emails aren't reaching recipients, follow these steps:

---

## Step 1: Check Resend Dashboard

1. **Log in to Resend Dashboard**
   - Go to https://resend.com
   - Navigate to **Emails** section
   - Look for your recent email sends

2. **Check Email Status**
   - Find the email by ID (from logs: `emailId`)
   - Check the delivery status:
     - ✅ **Delivered** - Email was delivered (check spam folder)
     - ⚠️ **Pending** - Email is queued for delivery
     - ❌ **Bounced** - Email was rejected
     - ❌ **Failed** - Email failed to send

---

## Step 2: Domain Verification (Most Common Issue)

### Problem
Your `EMAIL_FROM` is set to `12230045.gcit@rub.edu.bt`, which uses the domain `rub.edu.bt`. This domain **must be verified** in Resend for emails to be delivered.

### Solution A: Verify Your Domain (Recommended for Production)

1. **Go to Resend Dashboard → Domains**
2. **Click "Add Domain"**
3. **Enter**: `rub.edu.bt`
4. **Add DNS Records**:
   - SPF record
   - DKIM records (usually 2-3 records)
5. **Wait for Verification** (can take a few minutes to 24 hours)
6. **Check Status**: Domain should show "Verified" ✅

### Solution B: Use Resend's Test Domain (Quick Fix for Testing)

If you need to test immediately, change your `.env`:

```env
EMAIL_FROM=onboarding@resend.dev
```

**Note**: 
- ✅ Works immediately (no verification needed)
- ✅ Good for development/testing
- ❌ Not recommended for production
- ⚠️ May have sending limits

---

## Step 3: Check Spam Folder

Even if emails are marked as "Delivered" in Resend:
- Check recipient's **spam/junk folder**
- Check **promotions tab** (Gmail)
- Check **focused/other tabs** (Outlook)

---

## Step 4: Check Email Logs

### View Recent Email Attempts
```bash
# Check logs for email sending
tail -f backend/logs/combined.log | grep -i "resend\|email"

# Look for:
# - RESEND_EMAIL_SENT (success)
# - RESEND_SEND_FAILED (failure)
# - RESEND_CUSTOM_DOMAIN (domain warning)
```

### Check for Errors
```bash
# Check error logs
tail -f backend/logs/error.log | grep -i "email\|resend"
```

---

## Step 5: Test Email Sending

### Use the Test Endpoint
```bash
POST http://localhost:5000/api/auth/debug/send-test
Content-Type: application/json

{
  "to": "your-email@example.com"
}
```

### Response Will Include:
- `emailId` - Use this to track in Resend dashboard
- `domain` - The domain being used
- `warning` - Any warnings about domain verification

---

## Step 6: Common Issues & Solutions

### Issue 1: "Domain not verified"
**Symptoms**: Emails accepted by Resend but not delivered

**Solution**: 
- Verify domain in Resend dashboard
- OR use `onboarding@resend.dev` for testing

### Issue 2: "Rate limit exceeded"
**Symptoms**: Error message about rate limits

**Solution**: 
- Wait before sending more emails
- Check Resend plan limits
- Upgrade plan if needed

### Issue 3: "API key invalid"
**Symptoms**: `RESEND_SEND_FAILED` with unauthorized error

**Solution**: 
- Check `RESEND_API_KEY` in `.env`
- Verify API key in Resend dashboard
- Generate new API key if needed

### Issue 4: Emails in spam
**Symptoms**: Emails marked as delivered but not in inbox

**Solution**: 
- Verify domain with proper SPF/DKIM records
- Use verified domain (not test domain)
- Check email content (avoid spam trigger words)

---

## Step 7: Verify Configuration

### Check Your `.env` File
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=12230045.gcit@rub.edu.bt  # or onboarding@resend.dev for testing
```

### Restart Server
After changing `.env`, **restart your backend server**:
```bash
# Stop server (Ctrl+C)
# Start server again
npm start
```

---

## Step 8: Check Resend Email Details

1. **Go to Resend Dashboard → Emails**
2. **Click on the email** (use `emailId` from logs)
3. **Check**:
   - Delivery status
   - Bounce reason (if bounced)
   - Open/click tracking (if enabled)

---

## Quick Fix: Use Resend Test Domain

If you need emails working **right now** for testing:

1. **Update `.env`**:
   ```env
   EMAIL_FROM=onboarding@resend.dev
   ```

2. **Restart server**

3. **Test**:
   ```bash
   curl -X POST http://localhost:5000/api/auth/debug/send-test \
     -H "Content-Type: application/json" \
     -d '{"to":"your-email@example.com"}'
   ```

4. **Check your email** (should arrive within seconds)

---

## Production Setup

For production, you **must** verify your domain:

1. **Add domain** `rub.edu.bt` in Resend
2. **Add DNS records** to your domain's DNS settings
3. **Wait for verification** (usually 5-30 minutes)
4. **Test** with verified domain
5. **Monitor** delivery rates in Resend dashboard

---

## Still Not Working?

1. **Check Resend Dashboard** for detailed error messages
2. **Check server logs** for specific errors
3. **Try test domain** (`onboarding@resend.dev`) to isolate issue
4. **Contact Resend Support** if domain verification fails
5. **Check Resend Status Page** for service issues

---

## Monitoring Email Delivery

### Check Logs Regularly
```bash
# Watch for email sending
tail -f backend/logs/combined.log | grep RESEND

# Watch for errors
tail -f backend/logs/error.log
```

### Set Up Alerts
- Monitor `RESEND_SEND_FAILED` in logs
- Set up alerts for high bounce rates
- Monitor delivery rates in Resend dashboard

---

## Summary

**Most Likely Issue**: Domain `rub.edu.bt` is not verified in Resend

**Quick Fix**: Use `EMAIL_FROM=onboarding@resend.dev` for testing

**Production Fix**: Verify `rub.edu.bt` domain in Resend dashboard

**Check**: Resend dashboard → Emails → Find email by ID → Check delivery status

