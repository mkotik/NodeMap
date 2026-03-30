import { router } from "../trpc";
import { authRouter } from "./auth";
import { conversationRouter } from "./conversation";
import { settingsRouter } from "./settings";

export const appRouter = router({
  auth: authRouter,
  conversation: conversationRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
