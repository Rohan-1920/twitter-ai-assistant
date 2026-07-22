const express = require("express");
const cors = require("cors");
require("dotenv").config();

const twitterRoutes = require("./routes/twitter.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Twitter AI Backend Running");
});

app.use("/api/twitter", twitterRoutes);

// Global error handler for malformed JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON in request body",
    });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Twitter AI Backend running on port ${PORT}`);
});
