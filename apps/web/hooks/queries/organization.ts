"use client"

import { useMutation } from "@tanstack/react-query"
import type {
  LegalStructure,
  OrganizationType,
} from "@workspace/auth/organization"
import { toast } from "@workspace/ui/components/motion/toaster"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import { DEFAULT_SIGNED_IN_ROUTE } from "@/config/routes"
import { useRefreshSession } from "@/hooks/use-refresh-session"
import { authClient, unwrap } from "@/lib/auth-client"

export interface OrganizationInput {
  type: OrganizationType
  name: string
  /** An empty string clears a previously saved value (stored as null). */
  taxId: string
  registrationNumber: string
  /** The rest of the business details, edited in settings. */
  legalStructure?: LegalStructure
  address?: string
  vatNumber?: string
  bankName?: string
  iban?: string
}

/**
 * Onboarding. Better Auth makes the creator the owner and switches the session
 * to the new organization; the refresh rewrites the cached session cookie so
 * the app shell sees it straight away.
 */
export function useCreateOrganization() {
  const router = useRouter()
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (input: OrganizationInput) =>
      unwrap(
        authClient.organization.create({ ...input, slug: toSlug(input.name) })
      ),
    onSuccess: async () => {
      await refreshSession()
      router.replace(DEFAULT_SIGNED_IN_ROUTE)
    },
  })
}

export function useUpdateOrganization(organizationId: string) {
  const t = useTranslations("OrganizationSettings")
  const refreshSession = useRefreshSession()

  return useMutation({
    mutationFn: (input: OrganizationInput) =>
      unwrap(
        authClient.organization.update({
          organizationId,
          data: input,
        })
      ),
    onSuccess: async () => {
      // The header shows the organization's name.
      await refreshSession()
      toast.success(t("saved"))
    },
  })
}

/**
 * Slugs must be unique, but nothing routes by them yet: a readable stem plus a
 * random suffix avoids collisions without a round trip to check.
 */
function toSlug(name: string) {
  const stem = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)

  return `${stem || "org"}-${crypto.randomUUID().slice(0, 8)}`
}
