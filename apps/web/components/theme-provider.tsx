"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Plain next-themes, as in Deo. Switching happens through `ThemeToggle`; there
 * is no global keyboard shortcut (browser autofill fires `keydown` events with
 * no `key`, which a document-wide listener has to survive).
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
