const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendVerificationEmail(
  email: string,
  firstName: string,
  token: string,
) {
  const verifyUrl = `${APP_URL}/auth/verify?token=${token}`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "NodeMap.io", email: "noreply@nodemap.io" },
      to: [{ email, name: firstName }],
      subject: "Verify your email — NodeMap.io",
      htmlContent: `
        <div style="font-family: 'IBM Plex Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #dee5ff; background: #060e20;">
          <h1 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; margin-bottom: 16px; color: #dee5ff;">
            Welcome to NodeMap.io
          </h1>
          <p style="font-size: 16px; line-height: 1.5; color: #b0b8d1; margin-bottom: 24px;">
            Hi ${firstName}, please verify your email address to start using NodeMap.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: #0f2e1f; color: #b0ffd9; font-weight: 600; text-decoration: none; border-radius: 6px; font-size: 14px;">
            Verify Email
          </a>
          <p style="font-size: 12px; color: #6d758c; margin-top: 32px; line-height: 1.5;">
            If you didn't create a NodeMap account, you can safely ignore this email.
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo API error (${res.status}): ${text}`);
  }
}
