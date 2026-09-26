const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(100)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const paySchema = z.object({
  receiverUpiId: z.string().min(3).max(255),
  amountRupees: z.number().positive().finite().max(1000000)
});

function validate(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const err = new Error("Validation failed");
    err.statusCode = 400;
    err.details = result.error.issues;
    throw err;
  }
  return result.data;
}

function rupeesToPaise(rupees) {
  // Convert through string arithmetic to avoid floating-point money errors.
  const text = String(rupees);
  const [whole, fraction = ""] = text.split(".");
  const padded = (fraction + "00").slice(0, 2);
  return BigInt(whole) * 100n + BigInt(padded);
}

function paiseToRupeesString(paise) {
  const value = BigInt(paise);
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, "0");
  return `${whole}.${fraction}`;
}

module.exports = {
  registerSchema,
  loginSchema,
  paySchema,
  validate,
  rupeesToPaise,
  paiseToRupeesString
};
