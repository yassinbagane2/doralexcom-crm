# Tube

A Next.js App Router starter with authentication, a typed API server, Postgres, shared Base UI components, animated icons, and light/dark themes.

## Getting started

Use Node.js 22.18+ (22 LTS) or 24.11+, pnpm 11.25.0 (pinned in `package.json`), and Docker.

```sh
pnpm install
cp .env.example .env            # then set BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d            # Postgres on localhost:5432
pnpm db:migrate                 # create the tables
pnpm dev                        # web on :3000, API on :3001
```

Open [localhost:3000](http://localhost:3000) and create an account. Without `RESEND_API_KEY`, verification and password-reset codes are printed in the API server's terminal instead of emailed. Press `d` outside an input to switch themes.

If port 5432 is taken, set `POSTGRES_PORT` in `.env` and use the same port in `DATABASE_URL`.

## Workspace

- `apps/web`: the Next.js application.
- `apps/server`: a Hono API server. It mounts Better Auth at `/api/auth`, the oRPC router at `/rpc`, and an OpenAPI reference at `/api-reference`.
- `packages/auth`: the Better Auth configuration, the password policy, and email delivery.
- `packages/api`: oRPC procedures (`publicProcedure`, `protectedProcedure`) and routers.
- `packages/db`: the Drizzle client, schema and migrations.
- `packages/ui`: shared components, icons, hooks, and theme tokens.

Every app and package reads the one root `.env` through `dotenv -e ../../.env` in its scripts.

## Authentication

Better Auth runs on the API server; the web app talks to it from the browser with cookies.

- Email and password sign-up and sign-in, with a shared password policy (`@workspace/auth/password`) enforced on the server and explained in the forms.
- Email verification and password reset with six-digit codes (emailOTP plugin).
- Two-factor authentication with an authenticator app, plus backup codes.
- Passkeys.
- An account page (`/account`) for profile, sessions, password, 2FA, passkeys, and account deletion.

### Route protection

`apps/web/proxy.ts` validates the session for routes listed in `apps/web/config/routes.ts`:

- `PROTECTED_ROUTES` send signed-out visitors to `/sign-in?redirectTo=…`.
- `AUTH_ROUTES` send signed-in visitors on to where they were going.

Pages behind a session also call `requireSession()` from `lib/auth.ts`, so they never rely on the proxy alone. To protect a new section, add its path to `PROTECTED_ROUTES` and put its pages under `app/(app)`.

### Calling the server from the web app

Components never call `authClient` or the oRPC client directly. They use the TanStack Query hooks in `apps/web/hooks/queries/*`:

```tsx
const { data } = useAccountOverview() // oRPC: orpc.user.overview
const updateProfile = useUpdateProfile() // Better Auth: authClient.updateUser
```

To add an endpoint, add a procedure to a router in `packages/api/src/routers`, then a hook that wraps `orpc.<router>.<procedure>`. Better Auth calls go through `unwrap()` so that failures reject and reach `onError`.

## Commands

Run from the repository root:

```sh
pnpm dev              # Web and API servers
pnpm check            # Lint, typecheck every workspace, and check formatting
pnpm build            # Production build of both apps
pnpm db:generate      # Create a migration from schema changes
pnpm db:migrate       # Apply migrations
pnpm db:studio        # Browse the database
pnpm auth:generate    # Regenerate the auth schema after changing Better Auth plugins
```

After `pnpm auth:generate`, run `pnpm db:generate` and `pnpm db:migrate` to apply the change.

## Production

- Set `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SERVER_URL` to the deployed URLs. The API only accepts the web app's origin.
- When the two apps run on sibling subdomains (app.example.com and api.example.com), set `AUTH_COOKIE_DOMAIN=example.com` so both can read the session cookie.
- Set `RESEND_API_KEY` and `EMAIL_FROM`. Without them the server refuses to send email in production.
- Set `DATABASE_SSL=true` for managed Postgres.

## Shared UI

```tsx
import { Button } from "@workspace/ui/components/ui/button"
import { Input } from "@workspace/ui/components/ui/input"
import { cn } from "@workspace/ui/lib/utils"
```

Animated components live under `@workspace/ui/components/motion/*`; icons are exported from `@workspace/ui/icons`. Add shadcn components from the repository root:

```sh
pnpm dlx shadcn@latest add button -c apps/web
```

Edit shared colors and typography in `packages/ui/src/styles/globals.css`.
