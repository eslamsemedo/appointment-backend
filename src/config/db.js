// db.js
import mongoose from "mongoose";

export default async function connectDB(url = process.env.MONGO_URL) {
  if (!url) throw new Error("MONGO_URL is missing");

  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (mongoose.connection.readyState === 2) {
    // if a connect is already in progress, just wait for it
    await mongoose.connection.asPromise();
    return mongoose.connection;
  }

  try {
    await mongoose.connect(url, {
      dbName: process.env.MONGO_DB_NAME, // optional
    });
    console.log("MongoDB connected ✅");
    return mongoose.connection;
  } catch (err) {
    console.error("MongoDB connection error ❌:", err?.message || err);
    throw err; // let caller decide what to do
  }
}