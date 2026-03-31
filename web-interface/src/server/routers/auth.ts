import { z } from "zod";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { prisma } from "@/server/lib/prisma";
import { hashPassword, comparePassword } from "@/server/lib/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/server/lib/jwt";
import { verifyGoogleToken } from "@/server/lib/google";
import { sendVerificationEmail } from "@/server/lib/brevo";

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

function parseExpiry(expiry: string): Date {
  const match = expiry.match(/^(\d+)([mhd])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [, num, unit] = match;
  const ms = { m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return new Date(Date.now() + parseInt(num) * ms);
}

async function issueTokens(
  userId: string,
  email: string,
  setCookie: (
    name: string,
    value: string,
    opts: Record<string, unknown>,
  ) => void,
) {
  const tokenId = crypto.randomUUID();
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, tokenId });

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      token: refreshToken,
      userId,
      expiresAt: parseExpiry(process.env.REFRESH_TOKEN_EXPIRY || "7d"),
    },
  });

  setCookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });

  return accessToken;
}

function pick(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
  };
}

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        firstName: z.string().min(1).max(50),
        lastName: z.string().min(1).max(50),
        email: z.string().email(),
        password: z.string().min(8).max(128),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const emailVerificationToken = crypto.randomUUID();
      const user = await prisma.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash,
          emailVerificationToken,
        },
      });

      sendVerificationEmail(
        user.email,
        user.firstName,
        emailVerificationToken,
      ).catch(console.error);

      const accessToken = await issueTokens(
        user.id,
        user.email,
        ctx.cookies.set.bind(ctx.cookies),
      );
      return { accessToken, user: pick(user) };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const valid = await comparePassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const accessToken = await issueTokens(
        user.id,
        user.email,
        ctx.cookies.set.bind(ctx.cookies),
      );
      return { accessToken, user: pick(user) };
    }),

  google: publicProcedure
    .input(z.object({ idToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const googleUser = await verifyGoogleToken(input.idToken);

      let user = await prisma.user.findUnique({
        where: { googleId: googleUser.googleId },
      });

      if (!user) {
        user = await prisma.user.findUnique({
          where: { email: googleUser.email },
        });
        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: googleUser.googleId,
              avatarUrl: googleUser.avatarUrl,
              emailVerified: true,
              emailVerificationToken: null,
            },
          });
        } else {
          user = await prisma.user.create({
            data: {
              email: googleUser.email,
              firstName: googleUser.firstName,
              lastName: googleUser.lastName,
              googleId: googleUser.googleId,
              avatarUrl: googleUser.avatarUrl,
              emailVerified: true,
            },
          });
        }
      }

      const accessToken = await issueTokens(
        user.id,
        user.email,
        ctx.cookies.set.bind(ctx.cookies),
      );
      return { accessToken, user: pick(user) };
    }),

  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const token = ctx.cookies.get("refreshToken")?.value;
    if (!token) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No refresh token",
      });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid refresh token",
      });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored)
        await prisma.refreshToken.deleteMany({ where: { id: stored.id } });
      ctx.cookies.delete("refreshToken");
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Refresh token expired",
      });
    }

    await prisma.refreshToken.deleteMany({ where: { id: stored.id } });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
    }

    const accessToken = await issueTokens(
      user.id,
      user.email,
      ctx.cookies.set.bind(ctx.cookies),
    );
    return { accessToken, user: pick(user) };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.userId },
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return { user: pick(user) };
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    const token = ctx.cookies.get("refreshToken")?.value;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    ctx.cookies.delete("refreshToken");
    return { success: true };
  }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { emailVerificationToken: input.token },
      });
      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired verification link",
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerificationToken: null },
      });

      return { success: true };
    }),

  resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.userId },
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (user.emailVerified) {
      return { success: true };
    }

    const token = crypto.randomUUID();
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: token },
    });

    await sendVerificationEmail(user.email, user.firstName, token);
    return { success: true };
  }),
});
