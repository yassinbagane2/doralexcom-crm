import enAccount from "./en/account.json"
import enAuth from "./en/auth.json"
import enCommon from "./en/common.json"
import enOrganization from "./en/organization.json"
import enShell from "./en/shell.json"
import roAccount from "./ro/account.json"
import roAuth from "./ro/auth.json"
import roCommon from "./ro/common.json"
import roOrganization from "./ro/organization.json"
import roShell from "./ro/shell.json"

import type { Locale } from "@/i18n/locale"

/*
 * One JSON file per area of the app, each holding its own top-level
 * namespaces. English is the reference: `satisfies` below fails the typecheck
 * when a Romanian file is missing a key the English one has.
 */
const en = {
  ...enCommon,
  ...enAuth,
  ...enAccount,
  ...enOrganization,
  ...enShell,
}

export type Messages = typeof en

const ro = {
  ...roCommon,
  ...roAuth,
  ...roAccount,
  ...roOrganization,
  ...roShell,
} satisfies Messages

export const messages: Record<Locale, Messages> = { en, ro }
