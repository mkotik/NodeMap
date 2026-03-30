import { OAuth2Client } from "google-auth-library";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
if (!googleClientId) {
  throw new Error(
    "Missing required environment variable: NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  );
}

const client = new OAuth2Client(googleClientId);

export async function verifyGoogleToken(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: googleClientId,
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
