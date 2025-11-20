const nodemailer = require("nodemailer");

// Flexible email sender supporting provider switch via EMAIL_PROVIDER.
// Supported providers: 'sendgrid' (uses @sendgrid/mail), 'smtp' (nodemailer), 'dev' (logs).

let sendGridClient;
try {
  // try to load SendGrid if installed and requested at runtime
  sendGridClient = require("@sendgrid/mail");
} catch (err) {
  // not installed — we'll fallback to nodemailer if needed
  sendGridClient = null;
}

const createSmtpTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Keep a single transporter instance for SMTP
let smtpTransporter;

/**
 * sendEmail accepts either (to, subject, html) or a single object:
 * sendEmail({ to, subject, html, text })
 */
const sendEmail = async (a, b, c) => {
  // Normalize params
  let to, subject, html, text;
  if (typeof a === "object" && a !== null && !Array.isArray(a)) {
    ({ to, subject, html, text } = a);
  } else {
    to = a;
    subject = b;
    html = c;
  }

  const provider = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();

  if (provider === "dev") {
    // For local development: just log the email and resolve
    console.log(
      "[EMAIL][DEV] to=%s subject=%s html=%s text=%s",
      to,
      subject,
      html,
      text
    );
    return Promise.resolve({ accepted: [to] });
  }

  if (provider === "sendgrid" && sendGridClient) {
    sendGridClient.setApiKey(process.env.SENDGRID_API_KEY || "");
    const msg = {
      to,
      from:
        process.env.EMAIL_FROM ||
        process.env.SMTP_USER ||
        "no-reply@example.com",
      subject,
      html,
      text,
    };
    return sendGridClient.send(msg);
  }

  // Fallback to SMTP if available
  if (!smtpTransporter) smtpTransporter = createSmtpTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"Bhutan Tours" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  };
  if (text) mailOptions.text = text;

  return smtpTransporter.sendMail(mailOptions);
};

module.exports = { sendEmail };
