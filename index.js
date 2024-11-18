const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const app = express();
const port = 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require("./config/service-account-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.use(express.json());

// API Endpoint
app.post("/sendToKlaviyo", async (req, res) => {
  const { userId, sessionId } = req.body;

  try {
    // Retrieve user data from Firestore
    const userRef = db.collection("recomended_log").doc("user");
    const userData = (await userRef.get()).data();
    const outputDataRef = db.collection("recomended_log").doc("outputData");
    const outputData = (await outputDataRef.get()).data();

    // Extract user details
    const email = userData.email;
    const firstName = userData.firstName;

    // Extract product details
    const products = Object.keys(outputData).map((key) => {
      return {
        brand_name: outputData[key].brand_name,
        product_name: outputData[key].product_name,
        image_url: outputData[key].image_url,
        product_url: outputData[key].product_url,
        message_1: outputData[key].message_1,
      };
    });

    // Prepare payload for Klaviyo
    const payload = {
      email,
      firstName,
      sessionId,
      products,
    };

    // Send payload to Klaviyo
    await axios.post("https://a.klaviyo.com/api/v1/endpoint", payload, {
      headers: {
        Authorization: `Bearer TKmV8y`,
      },
    });

    res.status(200).send("Data sent to Klaviyo successfully!");
  } catch (error) {
    console.error("Error sending data:", error);
    res.status(500).send("An error occurred.");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
