import type { PropertyType } from "@workspace/api/property"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

import { PropertyTypeIcon } from "@/components/properties/property-type-icon"
import { propertyPhotoUrl } from "@/hooks/queries/property"

/**
 * The picture at the top of a property: its cover photo, or its kind drawn
 * on a soft surface while it has none. Callers only set the frame (aspect
 * ratio, radius) and what floats over it.
 */
export function PropertyCover({
  type,
  photoId,
  size = "md",
  className,
  children,
}: {
  type: PropertyType
  /** The cover photo, if the property has one. */
  photoId?: string | null
  size?: "md" | "lg"
  className?: string
  /** Laid over the cover: a status pill, an actions menu… */
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-muted",
        "bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_60%)]",
        className
      )}
    >
      {photoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={propertyPhotoUrl(photoId)}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span
          className={cn(
            "absolute top-1/2 left-1/2 grid -translate-1/2 place-items-center bg-background/80 text-muted-foreground shadow-xs",
            size === "lg" ? "size-14 rounded-2xl" : "size-11 rounded-xl"
          )}
        >
          <PropertyTypeIcon
            type={type}
            className={size === "lg" ? "size-6" : "size-5"}
          />
        </span>
      )}
      {children}
    </div>
  )
}
