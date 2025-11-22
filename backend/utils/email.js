const nodemailer = require("nodemailer");
const logger = require("./logger");

let transporter = null;

/**
 * Get or create SMTP transporter - Works with ANY email provider
 * Optimized for Render and production environments
 */
const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS must be set in environment variables");
  }

  // Configuration optimized for Render and production
  const config = {
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
    // Timeout settings for Render's network environment
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000, // 30 seconds
    socketTimeout: 60000, // 60 seconds
    // TLS configuration for production
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production" && process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
      ciphers: "SSLv3",
    },
    // Connection pooling for better performance
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  };

  // Gmail-specific optimizations
  if (host.includes("gmail.com")) {
    config.service = "gmail";
    // Use OAuth2 if available (for future enhancement)
    if (process.env.SMTP_CLIENT_ID && process.env.SMTP_CLIENT_SECRET) {
      config.auth = {
        type: "OAuth2",
        user,
        clientId: process.env.SMTP_CLIENT_ID,
        clientSecret: process.env.SMTP_CLIENT_SECRET,
        refreshToken: process.env.SMTP_REFRESH_TOKEN,
      };
    }
  }

  transporter = nodemailer.createTransport(config);

  return transporter;
};

/**
 * Send email - Returns { ok: true/false, error?: string, provider?: string }
 * Production-safe error handling
 */
const sendEmail = async (options) => {
  try {
    // Support both object and positional arguments
    let to, subject, html, text;
    
    if (typeof options === "object" && options !== null && !Array.isArray(options)) {
      ({ to, subject, html, text } = options);
    } else if (typeof options === "string") {
      // Legacy positional arguments support
      to = options;
      subject = arguments[1];
      html = arguments[2];
      text = arguments[3];
    } else {
      return {
        ok: false,
        error: "Invalid email options format",
      };
    }

    if (!to || !subject || !html) {
      return {
        ok: false,
        error: "Missing required fields: to, subject, html",
      };
    }

    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@example.com";
    
    // Get transporter with error handling
    let mailTransporter;
    try {
      mailTransporter = getTransporter();
    } catch (transportError) {
      logger.error("EMAIL_TRANSPORT_INIT_FAILED", {
        error: transportError.message,
        stack: process.env.NODE_ENV === "development" ? transportError.stack : undefined,
      });
      return {
        ok: false,
        error: "Email service not configured. Please contact support.",
        provider: "smtp",
      };
    }

    // Convert HTML to text if not provided (better email deliverability)
    if (!text && html) {
      text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style tags
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags
        .replace(/<[^>]+>/g, "") // Remove all HTML tags
        .replace(/&nbsp;/g, " ") // Replace &nbsp;
        .replace(/&amp;/g, "&") // Replace &amp;
        .replace(/&lt;/g, "<") // Replace &lt;
        .replace(/&gt;/g, ">") // Replace &gt;
        .replace(/&quot;/g, '"') // Replace &quot;
        .replace(/&#39;/g, "'") // Replace &#39;
        .replace(/\n\s*\n\s*\n/g, "\n\n") // Clean up multiple newlines
        .trim();
    }

    const mailOptions = {
      from: `"Tour Booking System" <${from}>`,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ""),
      replyTo: process.env.EMAIL_REPLY_TO || from,
      // Add headers for better deliverability
      headers: {
        "X-Entity-Ref-ID": `otp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        "X-Mailer": "Tour-Booking-System",
        "X-Priority": "1",
      },
    };

    const info = await mailTransporter.sendMail(mailOptions);

    logger.info("EMAIL_SENT", {
      to: Array.isArray(to) ? to.join(", ") : to,
      from,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    return {
      ok: true,
      provider: "smtp",
      messageId: info.messageId,
    };
  } catch (err) {
    let errorMessage = err.message;
    const isProduction = process.env.NODE_ENV === "production";

    // Better error messages for common issues
    if (err.code === "EAUTH" || err.message.includes("BadCredentials") || 
        err.message.includes("Username and Password not accepted") || 
        err.message.includes("Invalid login")) {
      errorMessage = isProduction 
        ? "Email authentication failed. Please contact support."
        : "SMTP authentication failed. Check SMTP_USER and SMTP_PASS. For Gmail, use App Password (not regular password).";
    } else if (err.code === "ECONNECTION" || err.message.includes("connect") || 
               err.message.includes("ETIMEDOUT") || err.message.includes("ENOTFOUND")) {
      errorMessage = isProduction
        ? "Email service temporarily unavailable. Please try again later."
        : `Cannot connect to SMTP server at ${process.env.SMTP_HOST || "smtp.gmail.com"}:${process.env.SMTP_PORT || "587"}. Check SMTP_HOST and SMTP_PORT.`;
    } else if (err.message.includes("self signed certificate") || err.code === "SELF_SIGNED_CERT_IN_CHAIN") {
      errorMessage = isProduction
        ? "Email service configuration error. Please contact support."
        : "SMTP certificate error. Set SMTP_TLS_REJECT_UNAUTHORIZED=false for development only.";
    } else if (err.code === "ETIMEDOUT" || err.message.includes("timeout")) {
      errorMessage = isProduction
        ? "Email service request timed out. Please try again later."
        : "SMTP connection timeout. Check your network connection and SMTP settings.";
    }

    // Log detailed error only in development
    logger.error("EMAIL_SEND_FAILED", {
      error: err.message,
      errorCode: err.code,
      errorMessage,
      to: typeof options === "object" ? options?.to : undefined,
      stack: isProduction ? undefined : err.stack,
    });

    return {
      ok: false,
      provider: "smtp",
      error: errorMessage,
      errorCode: isProduction ? undefined : err.code, // Don't expose error codes in production
    };
  }
};

/**
 * Verify transporter (optional - doesn't block startup)
 * Optimized for Render deployment
 */
const ensureTransporter = async () => {
  try {
    const t = getTransporter();
    
    // Set a timeout for verification to prevent blocking on Render
    const verifyPromise = t.verify();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("SMTP verification timeout")), 10000); // 10 second timeout
    });
    
    await Promise.race([verifyPromise, timeoutPromise]);
    
    logger.info("SMTP_VERIFIED", {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || "587",
      provider: "smtp",
    });
    return t;
  } catch (err) {
    // In production, log warning but don't block startup
    const isProduction = process.env.NODE_ENV === "production";
    
    logger.warn("SMTP_VERIFY_FAILED", {
      error: err.message,
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || "587",
      note: "Server will start but emails may fail. Check SMTP credentials.",
      stack: isProduction ? undefined : err.stack,
    });
    
    // Return transporter anyway - verification happens on first send
    // This allows the server to start even if SMTP verification fails
    try {
      return getTransporter();
    } catch (transporterError) {
      // If we can't even create transporter, throw to warn during startup
      throw new Error(`SMTP configuration error: ${transporterError.message}`);
    }
  }
};

/**
 * Generate 6-digit OTP
 * @returns {string} 6-digit OTP code
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP email using SMTP
 * @param {string} to - Recipient email
 * @param {string} otp - OTP code to send
 * @param {string} [purpose="verification"] - Purpose of OTP (for email customization)
 * @returns {Promise<Object>} Result object
 */
const sendOTPEmail = async (to, otp, purpose = "verification") => {
  const purposes = {
    verification: {
      subject: "Your Verification Code - Tour Booking System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #ff9500; margin-top: 0;">Your Verification Code</h2>
            <p style="color: #333; font-size: 16px;">Hello,</p>
            <p style="color: #666; font-size: 14px;">Your verification code for Tour Booking System is:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 36px; font-weight: bold; color: #ff9500; letter-spacing: 8px; margin: 30px 0; border-radius: 8px; border: 2px dashed #ff9500;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in <strong>5 minutes</strong>.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">This is an automated email from Tour Booking System.</p>
          </div>
        </div>
      `,
      text: `Your Verification Code\n\nHello,\n\nYour verification code for Tour Booking System is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.\n\n---\nThis is an automated email from Tour Booking System.`,
    },
    login: {
      subject: "Your Login Code - Tour Booking System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #ff9500; margin-top: 0;">Your Login Code</h2>
            <p style="color: #333; font-size: 16px;">Hello,</p>
            <p style="color: #666; font-size: 14px;">Your login verification code is:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 36px; font-weight: bold; color: #ff9500; letter-spacing: 8px; margin: 30px 0; border-radius: 8px; border: 2px dashed #ff9500;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in <strong>5 minutes</strong>.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">This is an automated email from Tour Booking System.</p>
          </div>
        </div>
      `,
      text: `Your Login Code\n\nHello,\n\nYour login verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.\n\n---\nThis is an automated email from Tour Booking System.`,
    },
  };

  const emailTemplate = purposes[purpose] || purposes.verification;

  return await sendEmail({
    to,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
  });
};

module.exports = { sendEmail, ensureTransporter, sendOTPEmail, generateOTP };
