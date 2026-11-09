import type { PropertyType } from "@workspace/api/property"
import {
  Briefcase,
  Building,
  DoorOpen,
  Shapes,
  SquareParking,
  Warehouse,
  type LucideIcon,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import type { ComponentType } from "react"

const ICONS = {
  apartment: DoorOpen,
  building: Building,
  office: Briefcase,
  garage: Warehouse,
  parking: SquareParking,
  other: Shapes,
} satisfies Record<
  PropertyType,
  LucideIcon | ComponentType<{ size?: number; className?: string }>
>

export function PropertyTypeIcon({
  type,
  className,
}: {
  type: PropertyType
  className?: string
}) {
  const Icon = ICONS[type]
  return <Icon size={16} className={cn("size-4 shrink-0", className)} />
}
