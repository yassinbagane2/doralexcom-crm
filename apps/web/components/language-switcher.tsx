"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/ui/select"
import { buttonVariants } from "@workspace/ui/components/ui/button"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"

import { useChangeLocale } from "@/hooks/use-change-locale"
import { isLocale, LOCALE_LABELS, LOCALES } from "@/i18n/locale"

const ITEMS = LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }))

/** Compact picker for headers: shows the active language code. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Language")
  const { locale, changeLocale, isPending } = useChangeLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("change")}
        disabled={isPending}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "rounded-full px-2.5 font-mono text-xs text-muted-foreground uppercase",
          className
        )}
      >
        {locale}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => isLocale(value) && changeLocale(value)}
        >
          {ITEMS.map(({ value, label }) => (
            <DropdownMenuRadioItem key={value} value={value} lang={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Full-width select for the preferences page. */
export function LanguageSelect({ id }: { id?: string }) {
  const { locale, changeLocale, isPending } = useChangeLocale()

  return (
    <Select
      items={ITEMS}
      value={locale}
      disabled={isPending}
      onValueChange={(value) => isLocale(value) && changeLocale(value)}
    >
      <SelectTrigger id={id} className="sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map(({ value, label }) => (
          <SelectItem key={value} value={value} lang={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
