const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
dotenv.config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const path = require("path");

const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Route: Stripe Elements UI
app.get("/", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 100, // Amount in cents
      currency: "usd",
      description: "Test payment with Stripe Elements",
    });

    res.render("checkout", {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error loading checkout page:", error.message);
    res.status(500).send("Something went wrong.");
  }
});

//  API to create payment with email

app.post("/api/payme", async (req, res) => {
  try {
    const { amount, payment_method , currency, description, email } = req.body;

    if (!amount || !payment_method || !currency || !description || !email) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Create customer with email
    const customer = await stripe.customers.create({
      email: email,
      description: "Created from /api/payme",
    });

    // Create PaymentIntent linked to customer
    const paymentIntent = await stripe.paymentIntents.create({
      payment_method,
      amount,
      currency,
      description,
      customer: customer.id,
      receipt_email: email,
    });

    console.log(" PaymentIntent created for", email);

    res.status(200).json({
      message: "Payment initiated",
      clientSecret: paymentIntent.client_secret,
      customerId: customer.id,
    });
  } catch (err) {
    console.error("Payment API Error:", err.message);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// Route: Webhook for payment status
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (request, response) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle event
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      console.log("Webhook: PaymentIntent succeeded →", paymentIntent.id);
    } else {
      console.log(`Webhook received: ${event.type}`);
    }

    response.json({ received: true });
  }
);

//Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
