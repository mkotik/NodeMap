import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { cookies, headers } from "next/headers";
import { verifyAccessToken } from "@/server/lib/jwt";

export async function createContext() {
  const headerStore = await headers();
  const cookieStore = await cookies();
  return { headers: headerStore, cookies: cookieStore };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const auth = ctx.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  try {
    const payload = verifyAccessToken(auth.slice(7));
    return next({ ctx: { ...ctx, user: payload } });
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
});
