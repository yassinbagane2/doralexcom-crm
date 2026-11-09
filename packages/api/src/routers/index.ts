import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../index"
import { adminRouter } from "./admin"
import { businessRouter } from "./business"
import { leaseRouter } from "./lease"
import { propertyRouter } from "./property"
import { tenantRouter } from "./tenant"
import { userRouter } from "./user"

export const appRouter = {
  healthCheck: publicProcedure
    .route({ method: "GET", path: "/health", tags: ["system"] })
    .handler(() => "OK"),
  user: userRouter,
  admin: adminRouter,
  business: businessRouter,
  property: propertyRouter,
  tenant: tenantRouter,
  lease: leaseRouter,
}

export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<AppRouter>
