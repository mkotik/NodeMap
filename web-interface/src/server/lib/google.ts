import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) {
    throw new Error("Invalid Google token payload");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    firstName: payload.given_name || payload.email.split("@")[0],
    lastName: payload.family_name || "",
    avatarUrl: payload.picture || null,
  };
}
