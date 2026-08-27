import nodemailer from "nodemailer";
// For Connection established
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});
// For Sending email
export async function sendVerificationEmail(email, token) {
  const verificationUrl = `http://localhost:5173/verify-email/${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify Your Email",
    html: `
      <h2>Verify Your Email</h2>
      <p>Thank you for registering.</p>
      <p>Please click the button below to verify your email address:</p>
      <a href="${verificationUrl}">
        Verify Email
      </a>
      <p>This verification link will expire in 15 minutes.</p>
    `,
  });
}

// for sending password reset email
export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `http://localhost:5173/reset-password/${token}`;
  await transporter.sendMail({
    from: `"Music App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your Password",
    html: `
      <div>
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password.</p>
        <p>Click the button below to reset your password:</p>
        <a
          href="${resetUrl}"
          style="
            display: inline-block;
            padding: 10px 20px;
            background-color: #000;
            color: #fff;
            text-decoration: none;
            border-radius: 5px;
          "
        >
          Reset Password
        </a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      </div>
    `,
  });
}

export default transporter;
