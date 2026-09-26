const { consumer } = require("./kafka");
const { kafkaGroupId } = require("./config");

async function start() {
  await consumer.connect();
  await consumer.subscribe({
    topic: "payment-events",
    fromBeginning: false
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());

      console.log(
        `[NOTIFICATION] payment=${event.paymentId} ` +
        `status=${event.status} amount=${event.amountRupees}`
      );

      // Later:
      // - email service
      // - SMS/push service
      // - fraud detection
      // - analytics
    }
  });

  console.log(`AmanPay consumer running with group ${kafkaGroupId}`);
}

start().catch(err => {
  console.error("Consumer failed:", err);
  process.exit(1);
});
