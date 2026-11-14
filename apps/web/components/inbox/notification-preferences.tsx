"use client"

import type { NotificationType } from "@workspace/notifications/types"
import { Switch } from "@workspace/ui/components/motion/switch"
import { Button } from "@workspace/ui/components/ui/button"
import { ChevronLeftIcon, LoaderCircle } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"

import {
  useNotificationPreferences,
  useSetNotificationPreference,
  type NotificationPreference,
} from "@/hooks/queries/notifications"

type Channel = keyof NotificationPreference["channels"]

type Translate = ReturnType<typeof useTranslations<"Inbox">>

/** The channels in the order their switches appear. */
const CHANNELS = ["in_app", "email"] as const satisfies readonly Channel[]

const CHANNEL_LABELS = {
  in_app: "channelInApp",
  email: "channelEmail",
} as const satisfies Record<Channel, Parameters<Translate>[0]>

/** Each type's name; adding a type means adding it here. */
const TYPE_LABELS = {
  "new-message": "typeNewMessage",
} as const satisfies Record<NotificationType, Parameters<Translate>[0]>

/**
 * The user's notification settings: every notification type, with a switch
 * for each channel it's sent on.
 */
export function NotificationPreferences({ onBack }: { onBack: () => void }) {
  const t = useTranslations("Inbox")
  const preferences = useNotificationPreferences()
  const setPreference = useSetNotificationPreference()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b px-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("preferencesBack")}
          title={t("preferencesBack")}
          onClick={onBack}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold">{t("preferencesTitle")}</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {preferences.isPending ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="divide-y">
            {(preferences.data ?? []).map(({ type, channels }) => (
              <li
                key={type}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3.5"
              >
                <p className="text-sm font-medium">{t(TYPE_LABELS[type])}</p>
                <div className="flex shrink-0 gap-5">
                  {/* Only the channels this type is sent on. */}
                  {CHANNELS.filter((channel) => channel in channels).map(
                    (channel) => (
                      <Switch
                        key={channel}
                        checked={channels[channel] ?? false}
                        onCheckedChange={(enabled) =>
                          setPreference.mutate({ type, channel, enabled })
                        }
                        label={t(CHANNEL_LABELS[channel])}
                      />
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
