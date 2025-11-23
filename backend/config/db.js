const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Note: useNewUrlParser and useUnifiedTopology are no longer needed
    // in Mongoose 6+ and have been removed for a cleaner setup.
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(` MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.error("Check your MONGODB_URI in .env");
    process.exit(1); // stop the server if DB cannot connect
  }
};

module.exports = connectDB;
