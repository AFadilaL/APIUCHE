

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const axios = require('axios');
require('dotenv').config();


// Initialize Express
const app = express();
app.use(bodyParser.json());

// Firebase Initialization
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL
}; // acesses the service account in folder config

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID// Replace with your Firebase URL
});

const db = admin.firestore();
// Klaviyo API Key
const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  try {
    // Step 1: Retrieve data from webhook payload
    const { userid, sessionid, hairstyle } = req.body;

    if (!userid || !sessionid || !hairstyle) {
      return res.status(400).json({ error: 'Missing required fields in webhook payload.' });
    }

    // Step 2: Search Firestore collection
    const collectionRef = db.collection('recommended_log');
    const snapshot = await collectionRef.get();
    if (snapshot.empty) {
      return res.status(404).json({ error: 'No documents found in recommended_log collection.' });
    }

    let matchingDocument = null;
// Compares if the webhook data matches the recommonded_log data and stores it in matchingDocument if it is true
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (
        data.userid === userid &&
        data.sessionid === sessionid &&
        data.hairstyle === hairstyle
      ) {
        matchingDocument = data;
      }
    });
//error hab=ndling for no matching doc found 
    if (!matchingDocument) {
      return res.status(404).json({ error: 'No matching document found.' });
    }
//cont outputDatamap = matchingDocument.outputData 
//
    // Step 3: Access user map in the document
    const userMap = matchingDocument.user;
    if (!userMap || !userMap.FirstName || !userMap.email) {
      return res.status(500).json({ error: 'User map is missing required fields.' });
    }

    const firstName = userMap.FirstName;
    const email = userMap.email;

    // Step 4: Fetch the product data from the outputData array
    const outputData = matchingDocument.data().outputData;
    if (!outputData || !Array.isArray(outputData)) {
      return res.status(500).json({ error: 'outputData is missing or not an array.' });
    }

    // Initialize an array to store all the products
    const products = [];

    // Iterate over each map inside the outputData array
    outputData.forEach((item) => {
      const product = item.product; // Access the product map inside each item

      // Ensure the product map exists
      if (product) {
        // Fetch the necessary fields from the product map
        const productData = {
          brand_name: product.brand_name || '',
          product_name: product.product_name || '',
          image_url: product.image_url || '',
          product_url: product.product_url || '',
          message_1: product.message_1 || ''
        };
// Add the product data to the products array
        products.push(productData);
      }
    });
    // Step 4: Send data to Klaviyo
    const klaviyoPayload = {
      api_key: KLAVIYO_API_KEY,
      profiles: [ {
        client_email : email, 
        first_name: firstName, 
        products: products // Include the products array (brand_name, product_name , image_url, product_url, message_1)
      }]
    };

    const klaviyoResponse = await axios.post(
      'https://a.klaviyo.com/api/v2/people',
      klaviyoPayload
    );

    if (klaviyoResponse.status === 200) {
      await matchingDocument.ref.update({ emailsent: true });
      return res.json({ message: 'Data sent to Klaviyo successfully.', klaviyoResponse: klaviyoResponse.data });
    } else {
      throw new Error('Failed to send data to Klaviyo.');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});





