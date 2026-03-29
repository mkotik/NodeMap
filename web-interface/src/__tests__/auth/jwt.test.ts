import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/server/lib/jwt";
import jwt from "jsonwebtoken";

describe("JWT utilities", () => {
  const accessPayload = { userId: "user_123", email: "test@example.com" };
  const refreshPayload = { userId: "user_123", tokenId: "token_456" };

  describe("signAccessToken / verifyAccessToken", () => {
    it("should sign and verify an access token", () => {
      const token = signAccessToken(accessPayload);
      expect(typeof token).toBe("string");

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(accessPayload.userId);
      expect(decoded.email).toBe(accessPayload.email);
    });

    it("should reject a tampered token", () => {
      const token = signAccessToken(accessPayload);
      const tampered = token.slice(0, -4) + "xxxx";
      expect(() => verifyAccessToken(tampered)).toThrow();
    });

    it("should reject a token signed with a different secret", () => {
      const fakeToken = jwt.sign(accessPayload, "wrong-secret", {
        expiresIn: "15m",
      });
      expect(() => verifyAccessToken(fakeToken)).toThrow();
    });
  });

  describe("signRefreshToken / verifyRefreshToken", () => {
    it("should sign and verify a refresh token", () => {
      const token = signRefreshToken(refreshPayload);
      expect(typeof token).toBe("string");

      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(refreshPayload.userId);
      expect(decoded.tokenId).toBe(refreshPayload.tokenId);
    });

    it("should not verify a refresh token with the access secret", () => {
      const token = signRefreshToken(refreshPayload);
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });
});
