#!/usr/bin/env node
/*
  migrate-encryption.js
  Usage: node migrate-encryption.js --oldKey=<64-hex-key> [--dry]

  This script will attempt to decrypt all Booking.encryptedDetails using the
  provided old key and re-encrypt them with the current `ENCRYPTION_KEY` from
  the environment. Make a backup of your database before running.
*/

const crypto = require("crypto");
const connectDB = require("../config/db");
const Booking = require("../models/Booking");
const { encrypt } = require("../utils/encryption");

const argv = require("yargs").argv;

const oldKeyHex = argv.oldKey || argv.o;
const dryRun = argv.dry || false;

if (!oldKeyHex || !/^[0-9a-fA-F]{64}$/.test(oldKeyHex)) {
  console.error(
    "Provide --oldKey with the old 64-char hex key to decrypt existing data."
  );
  process.exit(1);
}

const OLD_KEY = Buffer.from(oldKeyHex, "hex");
const algorithm = "aes-256-gcm";

const decryptWithKey = (keyBuf, encryptedObject) => {
  try {
    const decipher = crypto.createDecipheriv(
      algorithm,
      keyBuf,
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
  } catch (e) {
    throw new Error("DecryptWithKeyFailed: " + e.message);
  }
};

const run = async () => {
  console.log("Connecting to database...");
  await connectDB();

  const bookings = await Booking.find({
    "encryptedDetails.encryptedData": { $exists: true },
  });
  console.log(`Found ${bookings.length} bookings with encrypted details`);

  let migrated = 0;
  let failed = 0;

  for (const b of bookings) {
    try {
      const decrypted = decryptWithKey(OLD_KEY, b.encryptedDetails);
      if (!dryRun) {
        const newEncrypted = encrypt(decrypted);
        b.encryptedDetails = newEncrypted;
        await b.save();
      }
      migrated++;
      process.stdout.write(`.
`);
    } catch (e) {
      failed++;
      console.error(`\nFailed to migrate booking ${b._id}: ${e.message}`);
    }
  }

  console.log(
    `\nMigration complete. migrated=${migrated}, failed=${failed}, dryRun=${dryRun}`
  );
  process.exit(0);
};

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
