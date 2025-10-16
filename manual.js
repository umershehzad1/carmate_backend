// Stripe Webhook Testing

// const stripe = require("./config/Stripe");

// (async () => {
//   try {
//     const customerId = "cus_TFHrKyZLlSkARX";
//     const subscriptionId = "sub_1SInHZGiogfjvVjQRQntUUuA";

//     // 1️⃣ Create an invoice for this subscription
//     const invoice = await stripe.invoices.create({
//       customer: customerId,
//       subscription: subscriptionId,
//       auto_advance: true, // finalize automatically
//     });
//     console.log("Invoice created:", invoice.id);

//     // 2️⃣ Pay the invoice (simulating successful renewal)
//     const paidInvoice = await stripe.invoices.pay(invoice.id);
//     console.log("Invoice paid:", paidInvoice.status);
//   } catch (err) {
//     console.error("Error during manual renewal:", err.message);
//   }
// })();
