import crypto from "crypto";

function generateVerificationToken() {
  const plainToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(plainToken)
    .digest("hex");

  return {
    plainToken,
    hashedToken,
  };
}

export default generateVerificationToken;
