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


// Add funds
app.post("/addFunds", async (req, res) => {
  const { email, amount } = req.body;

  if (amount < 1000) return res.json({ success: false, message: "Minimum ₹1000 required!" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    user.balance += amount;
    user.attempts += 25; // increment by 25
    await user.save();

    res.json({ success: true, balance: user.balance, attempts: user.attempts });
  } catch (err) {
    res.json({ success: false, message: "Failed to add funds" });
  }
});



// Profile

app.get("/profile", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ success: false, message: "No email provided!" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found!" });

    res.json({
      success: true,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      balance: user.balance,
      attempts: user.attempts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// // Play game
// app.post("/play", async (req, res) => {
//   const { email, bet, choice } = req.body;

//   if (!email) return res.status(400).json({ success: false, message: "Missing email!" });  

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.json({ success: false });

//     if (user.attempts <= 0) {
//       return res.json({ success: false, message: "❌ No attempts left! Add more funds to play again." });
//     }
//     if (bet > user.balance) {
//       return res.json({ success: false, message: "Insufficient balance!" });
//     }

//     user.attempts--;

//     const numBoxes = 3;
//     const blueBox = Math.floor(Math.random() * numBoxes);
//     const win = choice === blueBox;
//     const winAmount = win ? bet * 5 : 0;
//     const lost = win ? 0 : bet;

//     user.balance += winAmount - lost;
//     await user.save();

//     res.json({
//       success: true,
//       blueBox,
//       win,
//       winAmount,
//       lost,
//       newBalance: user.balance,
//       remainingAttempts: user.attempts
//     });
//   } catch (err) {
//     res.json({ success: false, message: "Error playing game" });
//   }
// });


// Always exactly ONE blue ball
app.post("/play", async (req, res) => {
  const { email, bet, choice } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Missing email!" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false });

    if (user.attempts <= 0) {
      return res.json({ success: false, message: "❌ No attempts left! Add more funds to play again." });
    }
    if (bet > user.balance) {
      return res.json({ success: false, message: "Insufficient balance!" });
    }

    // Track attempt number
    const prevPlayed = user.totalAttemptsPlayed || 0;
    const attemptNumber = prevPlayed + 1;

    const numBoxes = 3;
    let blueBox;

    // Your custom sequence for even attempts
    const seq = [2, 1, 3]; // box numbers (1-based)

    if (attemptNumber % 2 === 0) {
      // Even attempt → from sequence
      const evenIndex = Math.floor(attemptNumber / 2) - 1;
      blueBox = seq[evenIndex % seq.length];
    } else {
      // Odd attempt → random 1..numBoxes
      blueBox = Math.floor(Math.random() * numBoxes) + 1;
    }

    // Guarantee only one blue ball exists (the others are red by definition)
    const userChoice = Number(choice);
    const win = userChoice === blueBox;
    const winAmount = win ? bet * 5 : 0;
    const lost = win ? 0 : bet;
    user.balance += winAmount - lost;

    user.totalAttemptsPlayed = attemptNumber;
    user.attempts -= 1;
    await user.save();

    res.json({
      success: true,
      attemptNumber,
      blueBox, // always one blue ball here
      win,
      winAmount,
      lost,
      newBalance: user.balance,
      remainingAttempts: user.attempts
    });
  } catch (err) {
    console.error("Play error:", err);
    return res.json({ success: false, message: "Error playing game" });
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
