import { env } from "@/env"

/**
 * Where the browser reaches the API. On the platform's own address that's
 * NEXT_PUBLIC_SERVER_URL. On a business's own domain the TLS proxy serves
 * the API under the same origin (deploy/Caddyfile), which keeps cookies
 * first-party there.
 */
export function serverUrl() {
  if (typeof window === "undefined") return env.NEXT_PUBLIC_SERVER_URL

  const appHost = new URL(env.NEXT_PUBLIC_APP_URL).host
  return window.location.host === appHost
    ? env.NEXT_PUBLIC_SERVER_URL
    : window.location.origin
}
