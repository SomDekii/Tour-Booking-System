const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const logger = require("./logger");

let smtpTransporter = null;
let devTransporter = null;
let resendClient = null;

const createSmtpTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS");
  }

  const secure = port === 465;
  const options = { host, port, secure, auth: { user, pass } };
  if (process.env.SMTP_TLS_REJECT_UNAUTHORIZED === "false") {
    options.tls = { rejectUnauthorized: false };
  }
  return nodemailer.createTransport(options);
};

const resolveProvider = () => {
  if (process.env.EMAIL_PROVIDER)
    return process.env.EMAIL_PROVIDER.toLowerCase();
  if (process.env.NODE_ENV === "production") {
    if (process.env.RESEND_API_KEY) return "resend";
    return "smtp";
  }
  return "dev";
};

const ensureTransporter = async () => {
  const provider = resolveProvider();

  if (provider === "dev") {
    if (devTransporter) return devTransporter;
    devTransporter = nodemailer.createTransport({ jsonTransport: true });
    logger.info("DEV_TRANSPORTER_READY");
    return devTransporter;
  }

  if (provider === "resend") {
    if (resendClient) return resendClient;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");
    resendClient = new Resend(apiKey);
    logger.info("RESEND_CLIENT_READY");
    return resendClient;
  }

  if (smtpTransporter) return smtpTransporter;
  smtpTransporter = createSmtpTransporter();
  try {
    await smtpTransporter.verify();
    logger.info("SMTP_TRANSPORTER_VERIFIED", { host: process.env.SMTP_HOST });
    return smtpTransporter;
  } catch (err) {
    logger.error("SMTP_VERIFY_FAILED", {
      error: err.message,
      stack: err.stack,
    });
    throw new Error("SMTP verification failed: " + err.message);
  }
};

/**
 * sendEmail returns an object: { ok: boolean, provider, result?, error? }
 * Supports both signatures:
 *  sendEmail(to, subject, html, text?) OR
 *  sendEmail({ to, subject, html, text })
 */
const sendEmail = async (a, b, c, d) => {
  let to, subject, html, text;
  if (typeof a === "object" && a !== null && !Array.isArray(a)) {
    ({ to, subject, html, text } = a);
  } else {
    to = a;
    subject = b;
    html = c;
    text = d;
  }

  if (!to || !subject || !html) {
    return { ok: false, error: "Missing required fields: to, subject, html" };
  }

  const provider = resolveProvider();
  let client;
  try {
    client = await ensureTransporter();
  } catch (err) {
    logger.error("EMAIL_TRANSPORT_INIT_FAILED", {
      provider,
      error: err.message,
      stack: err.stack,
    });
    return {
      ok: false,
      provider,
      error: "Transport initialization failed: " + err.message,
    };
  }

  const from =
    process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@example.com";

  if (provider === "resend") {
    try {
      // Check if using a custom domain that might not be verified
      const fromDomain = from.split("@")[1];
      const isResendDomain = fromDomain === "resend.dev" || fromDomain === "resend.com";
      
      const res = await client.emails.send({ from, to, subject, html, text });
      
      logger.info("RESEND_EMAIL_SENT", { 
        to, 
        from,
        emailId: res.id,
        domain: fromDomain,
        isResendDomain,
        message: isResendDomain 
          ? "Email sent using Resend's verified domain" 
          : `Email sent. If not received, verify domain '${fromDomain}' in Resend dashboard.`
      });
      
      // Log warning if using unverified custom domain
      if (!isResendDomain) {
        logger.warn("RESEND_CUSTOM_DOMAIN", {
          domain: fromDomain,
          message: `Using custom domain. Ensure '${fromDomain}' is verified in Resend dashboard for emails to be delivered.`,
          emailId: res.id,
          to,
        });
      }
      
      return { 
        ok: true, 
        provider: "resend", 
        result: res,
        emailId: res.id,
        domain: fromDomain,
        warning: !isResendDomain ? `Domain ${fromDomain} may need verification in Resend` : undefined
      };
    } catch (err) {
      let errorMessage = err.message;
      let shouldSuggestResendDomain = false;
      
      // Provide more helpful error messages for common Resend issues
      if (err.message && (err.message.includes("domain") || err.message.includes("not verified"))) {
        errorMessage = `Domain verification error: The domain in your EMAIL_FROM address (${from}) is not verified in Resend. Please verify your domain in the Resend dashboard, or use 'onboarding@resend.dev' for testing.`;
        shouldSuggestResendDomain = true;
      } else if (err.message && err.message.includes("unauthorized")) {
        errorMessage = `Resend API key error: Your RESEND_API_KEY may be invalid or expired. Please check your API key in the Resend dashboard.`;
      } else if (err.message && err.message.includes("rate limit")) {
        errorMessage = `Rate limit exceeded: Too many emails sent. Please wait before sending more.`;
      }
      
      logger.error("RESEND_SEND_FAILED", {
        to,
        from,
        error: err.message,
        errorMessage,
        stack: err.stack,
      });
      
      return { 
        ok: false, 
        provider: "resend", 
        error: errorMessage, 
        originalError: err.message,
        suggestion: shouldSuggestResendDomain ? "Try using 'onboarding@resend.dev' as EMAIL_FROM for testing" : undefined
      };
    }
  }

  // SMTP or dev transporter (nodemailer)
  const mailOptions = { from, to, subject, html };
  if (text) mailOptions.text = text;

  try {
    const info = await client.sendMail(mailOptions);
    logger.info("EMAIL_SENT", { to, provider, messageId: info.messageId });
    if (provider === "dev") {
      logger.warn("DEV_EMAIL_LOGGED", { 
        to, 
        message: "Email was logged but NOT actually sent. Configure SMTP or Resend to send real emails." 
      });
      console.log("\n⚠️  [EMAIL][DEV MODE] Email logged but NOT sent!");
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   ⚠️  Configure EMAIL_PROVIDER=smtp or EMAIL_PROVIDER=resend to send real emails\n`);
    }
    return { ok: true, provider, result: info };
  } catch (err) {
    logger.error("EMAIL_SEND_FAILED", {
      to,
      provider,
      error: err.message,
      stack: err.stack,
    });
    return { ok: false, provider, error: err.message };
  }
};

module.exports = { sendEmail, ensureTransporter };
