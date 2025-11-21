# Quick Fix: Email Not Reaching Recipients

## Problem
Emails are being sent via Resend but not reaching recipients because the domain `rub.edu.bt` is not verified.

## Immediate Solution (Testing)

I've updated your `.env` file to use Resend's test domain which works immediately:

```env
EMAIL_FROM=onboarding@resend.dev
```

## Next Steps

1. **Restart your backend server** (required after .env changes)
   ```bash
   # Stop server (Ctrl+C)
   # Then restart
   npm start
   ```

2. **Test email sending**
   - Try logging in again
   - OTP emails should now arrive immediately
   - Check your inbox (and spam folder)

3. **Verify it's working**
   - Check logs: `tail -f backend/logs/combined.log | grep RESEND`
   - You should see: `isResendDomain: true` (no warnings)

## For Production (Verify Your Domain)

When ready for production, you need to verify `rub.edu.bt`:

1. Go to https://resend.com → **Domains**
2. Click **"Add Domain"**
3. Enter: `rub.edu.bt`
4. Add DNS records to your domain:
   - SPF record
   - DKIM records (usually 2-3)
5. Wait for verification (5-30 minutes)
6. Update `.env` back to:
   ```env
   EMAIL_FROM=12230045.gcit@rub.edu.bt
   ```

## Check Email Status

After restarting, test with:
```bash
POST http://localhost:5000/api/auth/debug/send-test
Content-Type: application/json

{
  "to": "your-email@example.com"
}
```

The response will show if emails are being sent successfully.

## Why This Works

- `onboarding@resend.dev` is Resend's verified test domain
- No DNS configuration needed
- Works immediately
- Perfect for development/testing

---

**After restarting your server, try logging in again. Emails should arrive immediately!**

