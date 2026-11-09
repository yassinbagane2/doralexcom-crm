"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@workspace/ui/components/ui/sonner"
import { useTheme } from "next-themes"

import { ThemeProvider } from "@/components/theme-provider"
import { getQueryClient } from "@/lib/query-client"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
    />
  )
}
