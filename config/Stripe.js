const Stripe = require("stripe");
require("dotenv").config(); // If using .env

const stripe = Stripe(process.env.STRIPE_SECRET); // Your secret key

module.exports = stripe;
