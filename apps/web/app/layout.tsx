import type { Metadata } from "next"

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: { default: "Tube", template: "%s · Tube" },
  description:
    "A Next.js starter with authentication and shared UI components.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans antialiased">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
