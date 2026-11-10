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
import { isActiveCustomDomain } from "@workspace/auth/custom-domains"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
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

/** The hostname a request was made to, as the browser saw it (no port). */
function requestHostname(headers: Headers) {
  const host =
    headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    headers.get("host") ??
    ""
  return host.replace(/:\d+$/, "").toLowerCase()
}

/**
 * On a business's own domain (proxied here by deploy/Caddyfile), cookies
 * must belong to that host: a `Domain=` naming the platform's parent domain
 * would make the browser drop them.
 */
async function scopeCookiesToHost(request: Request, response: Response) {
  const cookies = response.headers.getSetCookie()
  if (cookies.length === 0) return response
  if (!(await isActiveCustomDomain(requestHostname(request.headers)))) {
    return response
  }

  const scoped = new Response(response.body, response)
  scoped.headers.delete("set-cookie")
  for (const cookie of cookies) {
    scoped.headers.append("set-cookie", cookie.replace(/;\s*domain=[^;]*/i, ""))
  }
  return scoped
}

app.on(["GET", "POST"], "/api/auth/*", async (c) =>
  scopeCookiesToHost(c.req.raw, await auth.handler(c.req.raw))
)

/**
 * Caddy's on-demand TLS asks here before getting a certificate for a
 * hostname it hasn't seen (see deploy/Caddyfile): yes for a business's
 * verified domain, no for anything else, so nobody can make it request
 * certificates for arbitrary names.
 */
app.get("/tls/ask", async (c) => {
  const domain = c.req.query("domain")?.toLowerCase()
  return domain && (await isActiveCustomDomain(domain))
    ? c.text("OK")
    : c.text("Unknown domain", 404)
})

// The largest requests are documents: 10 MB uploads, and contracts whose
// pictures travel inline (up to 15 MB of content). Anything bigger is refused
// before it is read.
app.use(
  "/rpc/*",
  bodyLimit({
    maxSize: 20 * 1024 * 1024,
    onError: (c) => c.json({ message: "Request too large." }, 413),
  })
)

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
        info: { title: "Tenora API", version: "0.0.1" },
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
