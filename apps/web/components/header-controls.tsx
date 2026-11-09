import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

/** Language and theme, on every page header. */
export function HeaderControls() {
  return (
    <div className="flex items-center gap-1">
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  )
}
