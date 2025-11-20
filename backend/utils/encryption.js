const crypto = require("crypto");

// Build a 32-byte (256-bit) key from env or generate one for dev.
let ENCRYPTION_KEY;
if (process.env.ENCRYPTION_KEY) {
  const key = process.env.ENCRYPTION_KEY.trim();
  // Expect a 64-char hex string (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    ENCRYPTION_KEY = Buffer.from(key, "hex");
  } else {
    // Invalid key format — fail fast so operator can fix configuration
    const msg =
      "ENCRYPTION_KEY is set but invalid. It must be a 64-character hex string (32 bytes).";
    console.error(
      "[ENCRYPTION] " + msg + " Current value: ",
      process.env.ENCRYPTION_KEY
    );
    throw new Error(msg);
  }
} else {
  const msg =
    "ENCRYPTION_KEY is not set. Please set ENCRYPTION_KEY to a 64-character hex string (32 bytes) in your environment (.env) to enable persistent encryption/decryption.";
  console.error("[ENCRYPTION] " + msg);
  throw new Error(msg);
}

const algorithm = "aes-256-gcm";

const encrypt = (data) => {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Return all necessary components for decryption
    return {
      iv: iv.toString("hex"),
      encryptedData: encrypted,
      authTag: authTag.toString("hex"),
    };
  } catch (error) {
    console.error("[ENCRYPTION] Encryption failed:", error);
    throw new Error("Encryption failed");
  }
};

const decrypt = (encryptedObject) => {
  try {
    const decipher = crypto.createDecipheriv(
      algorithm,
      ENCRYPTION_KEY,
      Buffer.from(encryptedObject.iv, "hex")
    );

    decipher.setAuthTag(Buffer.from(encryptedObject.authTag, "hex"));

    let decrypted = decipher.update(
      encryptedObject.encryptedData,
      "hex",
      "utf8"
    );
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("[ENCRYPTION] Decryption failed:", error);
    throw new Error("Decryption failed");
  }
};

module.exports = { encrypt, decrypt };
