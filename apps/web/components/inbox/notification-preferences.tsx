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

/** Each type's name and what it's about; adding a type means adding it here. */
const TYPE_LABELS = {
  "new-message": {
    title: "typeNewMessage",
    description: "typeNewMessageDescription",
  },
} as const satisfies Record<
  NotificationType,
  { title: Parameters<Translate>[0]; description: Parameters<Translate>[0] }
>

/**
 * The user's notification settings: every notification type, with a switch
 * for each channel it can reach them on.
 */
export function NotificationPreferences({ onBack }: { onBack: () => void }) {
  const t = useTranslations("Inbox")
  const preferences = useNotificationPreferences()
  const setPreference = useSetNotificationPreference()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="-ml-1"
          aria-label={t("preferencesBack")}
          title={t("preferencesBack")}
          onClick={onBack}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-sm font-semibold">{t("preferencesTitle")}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {t("preferencesDescription")}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {preferences.isPending ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {(preferences.data ?? []).map(({ type, channels }) => (
              <li
                key={type}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">
                    {t(TYPE_LABELS[type].title)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(TYPE_LABELS[type].description)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-6">
                  {CHANNELS.map((channel) => (
                    <Switch
                      key={channel}
                      checked={channels[channel]}
                      onCheckedChange={(enabled) =>
                        setPreference.mutate({ type, channel, enabled })
                      }
                      label={t(CHANNEL_LABELS[channel])}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
