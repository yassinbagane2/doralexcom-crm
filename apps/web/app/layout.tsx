import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: { default: "Tenora", template: "%s · Tenora" },
  description:
    "A Next.js starter with authentication and shared UI components.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className="font-sans antialiased"
    >
      <body>
        {/* Passes the active locale and its messages to client components. */}
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
