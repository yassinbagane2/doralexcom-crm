"use client"

import * as React from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTrigger,
  ComboboxValue,
} from "@workspace/ui/components/ui/combobox"
import { Input } from "@workspace/ui/components/ui/input"
import { COUNTRIES, countryFlag } from "@workspace/ui/lib/countries"
import { cn } from "@workspace/ui/lib/utils"

type PhoneCountryOption = {
  value: string
  label: string
  name: string
  dialCode: string
  keywords: string
}

const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = COUNTRIES.map(
  (country) => ({
    value: country.code,
    label: `${countryFlag(country.code)} ${country.dialCode}`,
    name: country.name,
    dialCode: country.dialCode,
    keywords:
      `${country.name} ${country.dialCode} ${country.code}`.toLowerCase(),
  })
)

function findPhoneCountry(code: string) {
  return PHONE_COUNTRY_OPTIONS.find((option) => option.value === code) ?? null
}

/**
 * Dial-code combobox (searchable by country name, ISO code, or dial code)
 * fused with the national-number field, sharing one bordered control the way
 * most phone inputs (react-phone-number-input, MUI, Stripe) present them.
 */
export function PhoneInput({
  className,
  inputSize = "lg",
  country,
  onCountryChange,
  ...numberProps
}: {
  className?: string
  inputSize?: "default" | "lg"
  country: string
  onCountryChange: (country: string) => void
} & Omit<React.ComponentProps<typeof Input>, "type">) {
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <Combobox
        items={PHONE_COUNTRY_OPTIONS}
        value={findPhoneCountry(country)}
        onValueChange={(option) => onCountryChange(option?.value ?? "")}
        filter={(option: PhoneCountryOption, query: string) =>
          option.keywords.includes(query.trim().toLowerCase())
        }
      >
        <ComboboxTrigger
          inputSize={inputSize}
          aria-label="Phone country code"
          className="w-auto shrink-0 rounded-none border-none shadow-none focus-visible:ring-0"
        >
          <ComboboxValue>
            {(option: PhoneCountryOption | null) => option?.label}
          </ComboboxValue>
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxSearch placeholder="Search country or code…" />
          <ComboboxEmpty>No countries found.</ComboboxEmpty>
          <ComboboxList>
            {(option: PhoneCountryOption) => (
              <ComboboxItem key={option.value} value={option}>
                {countryFlag(option.value)} {option.name}{" "}
                <span className="text-muted-foreground">
                  ({option.dialCode})
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <Input
        inputSize={inputSize}
        type="tel"
        className="rounded-none border-y-0 border-r-0 border-l border-input shadow-none focus-visible:ring-0"
        {...numberProps}
      />
    </div>
  )
}
