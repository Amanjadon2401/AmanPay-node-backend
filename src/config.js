require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  kafkaBrokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  kafkaClientId: process.env.KAFKA_CLIENT_ID || "amanpay-api",
  kafkaGroupId: process.env.KAFKA_GROUP_ID || "amanpay-consumer",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12)
};
