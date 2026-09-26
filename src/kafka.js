const { Kafka } = require("kafkajs");
const { kafkaBrokers, kafkaClientId, kafkaGroupId } = require("./config");

const kafka = new Kafka({
  clientId: kafkaClientId,
  brokers: kafkaBrokers,
  retry: { retries: 5 }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: kafkaGroupId });

async function publishPaymentEvent(event) {
  await producer.send({
    topic: "payment-events",
    messages: [{
      key: event.paymentId,
      value: JSON.stringify(event)
    }]
  });
}

module.exports = { kafka, producer, consumer, publishPaymentEvent };
