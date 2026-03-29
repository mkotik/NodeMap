import { hashPassword, comparePassword } from "@/server/lib/password";

describe("Password utilities", () => {
  it("should hash a password and verify it", async () => {
    const password = "MySecurePass123!";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2")).toBe(true); // bcrypt prefix

    const match = await comparePassword(password, hash);
    expect(match).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const hash = await hashPassword("CorrectPassword1!");
    const match = await comparePassword("WrongPassword1!", hash);
    expect(match).toBe(false);
  });

  it("should produce different hashes for the same password", async () => {
    const password = "SamePassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2); // different salts
  });
});
