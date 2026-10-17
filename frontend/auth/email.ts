import NodemailerHelper from "nodemailer-otp";

export async function sendLoginCode(email: string, otp: string) {
  const username = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASS;

  if (!username || !password) {
    throw new Error("Email delivery is not configured yet. Ask the institute administrator to configure email.");
  }

  const mailer = new NodemailerHelper(username, password);
  const result = await mailer.sendEmail(
    email,
    "Your OpsCopilot verification code",
    "Your requested verification code expires in 5 minutes. If you did not request it, ignore this email.",
    otp,
  );

  if (!result?.success) {
    throw new Error("We could not send the verification email. Please try again later.");
  }
}
