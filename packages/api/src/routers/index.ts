import type { RouterClient } from "@orpc/server"

import { publicProcedure } from "../index"
import { adminRouter } from "./admin"
import { businessRouter } from "./business"
import { collaboratorRouter, invitationRouter } from "./collaborator"
import { contractRouter } from "./contract"
import { dashboardRouter } from "./dashboard"
import { documentRouter } from "./document"
import { invoiceRouter } from "./invoice"
import { leaseRouter } from "./lease"
import { portalRouter } from "./portal"
import { propertyRouter } from "./property"
import { propertyPhotoRouter } from "./property-photo"
import { settingsRouter } from "./settings"
import { signatureRouter } from "./signature"
import { customerRouter } from "./customer"
import { userRouter } from "./user"

export const appRouter = {
  healthCheck: publicProcedure
    .route({ method: "GET", path: "/health", tags: ["system"] })
    .handler(() => "OK"),
  user: userRouter,
  admin: adminRouter,
  business: businessRouter,
  dashboard: dashboardRouter,
  property: propertyRouter,
  propertyPhoto: propertyPhotoRouter,
  customer: customerRouter,
  lease: leaseRouter,
  invoice: invoiceRouter,
  contract: contractRouter,
  document: documentRouter,
  collaborator: collaboratorRouter,
  invitation: invitationRouter,
  settings: settingsRouter,
  signature: signatureRouter,
  portal: portalRouter,
}

export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<AppRouter>
