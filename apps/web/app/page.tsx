import { buttonVariants } from "@workspace/ui/components/ui/button"
import Link from "next/link"

import { DEFAULT_SIGNED_IN_ROUTE, routes } from "@/config/routes"
import { getSession } from "@/lib/auth"

export default async function Page() {
  const session = await getSession()

  return (
    <main className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>
            Authentication, an account page and route protection are wired up.
            Start building in <code>app/(app)</code>.
          </p>
          <div className="mt-2 flex gap-2">
            {session ? (
              <Link href={DEFAULT_SIGNED_IN_ROUTE} className={buttonVariants()}>
                Go to your account
              </Link>
            ) : (
              <>
                <Link href={routes.signIn} className={buttonVariants()}>
                  Sign in
                </Link>
                <Link
                  href={routes.signUp}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Create an account
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </main>
  )
}
