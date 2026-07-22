require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "D:\\playwright-browsers";

const { loginAndSaveSession } = require("../utils/browser");

loginAndSaveSession()
  .then(() => {
    console.log("Login successful. You can now start the server with `npm start`.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Login failed:", error.message);
    process.exit(1);
  });
