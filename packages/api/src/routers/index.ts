import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../index"
import { userRouter } from "./user"

export const appRouter = {
  healthCheck: publicProcedure
    .route({ method: "GET", path: "/health", tags: ["system"] })
    .handler(() => "OK"),
  user: userRouter,
}

export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<AppRouter>
