import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

// --------------------
// Core Initialization
// --------------------
const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Needed for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend: Assumes your static HTML/CSS/JS files are in a directory named 'public'
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// MongoDB Connection
// --------------------
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/flipball")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));
  // Note: useNewUrlParser and useUnifiedTopology are no longer needed in Mongoose 6+

// --------------------
// Schema & Model
// --------------------
const userSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  email: { type: String, unique: true },
  password: String,
  balance: { type: Number, default: 100 },
  attempts: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

// --------------------
// Routes (API Endpoints)
// --------------------

// Signup
app.post("/signup", async (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  try {
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "User already exists!" });
    }
    const newUser = new User({ firstname, lastname, email, password });
    await newUser.save();
    res.json({ success: true, message: "Signup successful!" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Signup failed!" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.json({ success: false, message: "Invalid credentials!" });
    }
    // Success: frontend will store email in localStorage for subsequent requests
    res.json({ success: true, message: "Login successful!", email: user.email });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Login failed!" });
  }
});

// Get Balance
app.get("/balance", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ success: false, message: "No email provided!" });

  const user = await User.findOne({ email });
  if (!user) return res.json({ success: false, message: "User not found!" });

  res.json({
    success: true,
    balance: user.balance,
    attempts: user.attempts,
  });
});

// Update Balance
app.post("/update-balance", async (req, res) => {
  const { email, balance, attempts } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { email },
      { balance, attempts },
      { new: true }
    );
    if (!user) return res.json({ success: false, message: "User not found!" });
    res.json({ success: true, message: "Balance updated!" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error updating balance" });
  }
});

// Logout
app.get("/logout", (req, res) => {
  res.json({ success: true, message: "Logged out!" });
});



app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// --------------------
// Start Server
// --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
