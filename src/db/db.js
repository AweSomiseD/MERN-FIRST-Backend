import mongoose from "mongoose";

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Data Base Is Connected");
  } catch (error) {
    console.error("Database Connection Error:", error);
  }
}
export default connectDB;
