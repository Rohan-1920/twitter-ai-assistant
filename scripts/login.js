require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { loginAndSaveSession } = require("../utils/browser");

loginAndSaveSession()
  .then(() => {
    console.log("You can now start the server with: npm start");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Login failed:", error.message);
    process.exit(1);
  });
