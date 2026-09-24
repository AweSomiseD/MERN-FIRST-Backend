// utils/sendEmail.js
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY); // key .env mein rakho, kabhi code mein mat likho

export async function SendWelcomeEmail(toEmail, userName) {
  await resend.emails.send({
    from: "onboarding@yourdomain.com",
    to: toEmail,
    subject: "Welcome to our Spotify Clone!",
    html: `<h1>Hi ${userName}!</h1><p>Thanks for joining. Start listening now 🎵</p>`,
  });
}
