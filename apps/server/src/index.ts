import { serve } from "@hono/node-server"
import type { OpenAPIGeneratorGenerateOptions } from "@orpc/openapi"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins"
import { onError, ORPCError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"
import { createContext } from "@workspace/api/context"
import { appRouter } from "@workspace/api/routers"
import { auth } from "@workspace/auth"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

import { env } from "./env"

const appOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin

const app = new Hono()

app.use(logger())

app.use(
  "*",
  cors({
    origin: (origin) => (origin === appOrigin ? origin : null),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    // Session cookies ride along on every call from the web app.
    credentials: true,
  })
)

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))

/** Expected failures (401, 404, validation…) are answers, not server errors. */
function logUnexpectedError(error: unknown) {
  if (error instanceof ORPCError && error.status < 500) return
  console.error(error)
}

/** Typed endpoint the web app's oRPC client talks to. */
const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [onError(logUnexpectedError)],
})

/** Same procedures as REST, plus an interactive reference at /api-reference. */
const openApiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [onError(logUnexpectedError)],
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: async () => ({
        info: { title: "Tube API", version: "0.0.1" },
        servers: [{ url: `${env.NEXT_PUBLIC_SERVER_URL}/api-reference` }],
        paths: await getAuthPaths(),
      }),
    }),
  ],
})

/**
 * Better Auth's endpoints, folded into the same reference page. They live
 * under another base path, which a per-path `servers` entry expresses.
 */
async function getAuthPaths() {
  const { paths } = await auth.api.generateOpenAPISchema()

  const prefixed = Object.fromEntries(
    Object.entries(paths).map(([path, operations]) => [
      `/auth${path}`,
      {
        ...operations,
        servers: [{ url: `${env.NEXT_PUBLIC_SERVER_URL}/api` }],
      },
    ])
  )

  // Better Auth types its spec more loosely than oRPC (e.g. optional parameter
  // names) although the generated document is valid OpenAPI.
  return prefixed as unknown as OpenAPIGeneratorGenerateOptions["paths"]
}

app.use("/*", async (c, next) => {
  const context = await createContext({ headers: c.req.raw.headers })

  const rpc = await rpcHandler.handle(c.req.raw, { prefix: "/rpc", context })
  if (rpc.matched) {
    return c.newResponse(rpc.response.body, rpc.response)
  }

  const rest = await openApiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  })
  if (rest.matched) {
    return c.newResponse(rest.response.body, rest.response)
  }

  await next()
})

app.get("/", (c) => c.text("OK"))

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`Server running at ${env.NEXT_PUBLIC_SERVER_URL}`)
  console.log(`API reference: ${env.NEXT_PUBLIC_SERVER_URL}/api-reference`)
})
