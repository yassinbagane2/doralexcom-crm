import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

// Fails the build early when a public variable is missing.
import "./env"

const nextConfig: NextConfig = {
  agentRules: false,
  // Workspace packages ship TypeScript source rather than compiled output.
  transpilePackages: ["@workspace/ui", "@workspace/auth", "@workspace/db"],
}

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

export default withNextIntl(nextConfig)
