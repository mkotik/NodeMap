import { router } from "../trpc";
import { authRouter } from "./auth";
import { conversationRouter } from "./conversation";

export const appRouter = router({
  auth: authRouter,
  conversation: conversationRouter,
});

export type AppRouter = typeof appRouter;
