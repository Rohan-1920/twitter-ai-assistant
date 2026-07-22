const express = require("express");
const { handleAction } = require("../controllers/twitter.controller");

const router = express.Router();

router.post("/action", handleAction);

module.exports = router;
