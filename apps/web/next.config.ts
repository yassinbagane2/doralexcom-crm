import type { NextConfig } from "next"

// Fails the build early when a public variable is missing.
import "./env"

const nextConfig: NextConfig = {
  agentRules: false,
  // Workspace packages ship TypeScript source rather than compiled output.
  transpilePackages: ["@workspace/ui", "@workspace/auth", "@workspace/db"],
}

export default nextConfig
