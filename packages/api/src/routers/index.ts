import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../index"
import { adminRouter } from "./admin"
import { businessRouter } from "./business"
import { collaboratorRouter, invitationRouter } from "./collaborator"
import { contractRouter } from "./contract"
import { documentRouter } from "./document"
import { leaseRouter } from "./lease"
import { propertyRouter } from "./property"
import { settingsRouter } from "./settings"
import { customerRouter } from "./customer"
import { userRouter } from "./user"

export const appRouter = {
  healthCheck: publicProcedure
    .route({ method: "GET", path: "/health", tags: ["system"] })
    .handler(() => "OK"),
  user: userRouter,
  admin: adminRouter,
  business: businessRouter,
  property: propertyRouter,
  customer: customerRouter,
  lease: leaseRouter,
  contract: contractRouter,
  document: documentRouter,
  collaborator: collaboratorRouter,
  invitation: invitationRouter,
  settings: settingsRouter,
}

export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<AppRouter>
