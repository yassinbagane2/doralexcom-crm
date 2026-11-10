import enAccount from "./en/account.json"
import enAdmin from "./en/admin.json"
import enAuth from "./en/auth.json"
import enCommon from "./en/common.json"
import enContract from "./en/contract.json"
import enOrganization from "./en/organization.json"
import enProperty from "./en/property.json"
import enSettings from "./en/settings.json"
import enCustomer from "./en/customer.json"
import enShell from "./en/shell.json"
import roAccount from "./ro/account.json"
import roAdmin from "./ro/admin.json"
import roAuth from "./ro/auth.json"
import roCommon from "./ro/common.json"
import roContract from "./ro/contract.json"
import roOrganization from "./ro/organization.json"
import roProperty from "./ro/property.json"
import roSettings from "./ro/settings.json"
import roCustomer from "./ro/customer.json"
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
  ...enAdmin,
  ...enProperty,
  ...enCustomer,
  ...enContract,
  ...enSettings,
}

export type Messages = typeof en

const ro = {
  ...roCommon,
  ...roAuth,
  ...roAccount,
  ...roOrganization,
  ...roShell,
  ...roAdmin,
  ...roProperty,
  ...roCustomer,
  ...roContract,
  ...roSettings,
} satisfies Messages

export const messages: Record<Locale, Messages> = { en, ro }
