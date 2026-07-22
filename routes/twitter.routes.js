const express = require("express");
const { handleAction, handleSessionCheck } = require("../controllers/twitter.controller");

const router = express.Router();

router.get("/session-check", handleSessionCheck);
router.post("/action", handleAction);

// Path exists — non-POST methods must not look like a missing route (Express default 404).
router.all("/action", (req, res) => {
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed. Use POST /api/twitter/action`,
  });
});

module.exports = router;
