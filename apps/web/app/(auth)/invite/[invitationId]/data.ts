import "server-only"

import { cache } from "react"

import { client } from "@/lib/orpc"

/** The invitation behind the link, or null when there is none. */
export const getInvitation = cache(async (invitationId: string) =>
  client.invitation.get({ invitationId }).catch(() => null)
)
