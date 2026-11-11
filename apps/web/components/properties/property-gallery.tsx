"use client"

import type { PropertyType } from "@workspace/api/property"
import { cn } from "@workspace/ui/lib/utils"
import { motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { useRef, useState, type ReactNode } from "react"

import { GalleryLightbox } from "@/components/properties/gallery-lightbox"
import { PropertyCover } from "@/components/properties/property-cover"

type MosaicLayout = { columns: number; areas: string }

/**
 * grid-template-areas for 1–6 tiles. Slot "a" is always the featured tile;
 * clicking any other tile promotes its photo into "a" and the rest reflow.
 */
const MOSAIC_LAYOUTS: Record<number, MosaicLayout> = {
  1: { columns: 4, areas: `"a a a a" "a a a a"` },
  2: { columns: 4, areas: `"a a a b" "a a a b"` },
  3: { columns: 4, areas: `"a a b b" "a a c c"` },
  4: { columns: 4, areas: `"a a b c" "a a b d"` },
  5: { columns: 5, areas: `"a a a b c" "a a a d e"` },
  6: { columns: 6, areas: `"a a a b c d" "a a a b e f"` },
}

const AREA_LETTERS = ["a", "b", "c", "d", "e", "f"]
const MAX_TILES = AREA_LETTERS.length
/** Past this many photos, the phone carousel counts instead of drawing dots. */
const MAX_DOTS = 8

const SPRING = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.9,
} as const

/**
 * A property's photos: a mosaic on wide screens (click a tile to feature it,
 * the featured one to see it full screen), a swipeable carousel on phones.
 * Without photos it shows the property's kind instead.
 */
export function PropertyGallery({
  images,
  name,
  type,
  overlay,
  actions,
  className,
}: {
  /** Photo URLs, cover first. */
  images: string[]
  name: string
  type: PropertyType
  /** Laid over the top-left corner, e.g. the occupancy pill. */
  overlay?: ReactNode
  /** Laid over the bottom-right corner, e.g. a button to manage photos. */
  actions?: ReactNode
  className?: string
}) {
  const t = useTranslations("Properties.photos")
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [mobileActive, setMobileActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const count = images.length

  const corners = (
    <>
      {overlay ? (
        <div className="pointer-events-none absolute top-4 left-4 z-10">
          {overlay}
        </div>
      ) : null}
      {actions ? (
        <div className="absolute right-3 bottom-3 z-10 flex items-center gap-2 sm:right-4 sm:bottom-4">
          {actions}
        </div>
      ) : null}
    </>
  )

  if (count === 0) {
    return (
      <div className={cn("relative", className)}>
        <PropertyCover
          type={type}
          size="lg"
          className="aspect-[16/9] w-full rounded-2xl sm:aspect-[21/8]"
        />
        {corners}
      </div>
    )
  }

  const safeActive = active < count ? active : 0
  const order = [
    safeActive,
    ...images.map((_, index) => index).filter((index) => index !== safeActive),
  ].slice(0, MAX_TILES)
  const layout = MOSAIC_LAYOUTS[order.length]!
  const safeMobileActive = Math.min(mobileActive, count - 1)

  function handleScroll() {
    const el = scrollerRef.current
    if (!el) return
    setMobileActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  function scrollToSlide(index: number) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" })
  }

  function openLightbox(index: number) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div className={cn("relative", className)}>
      <div
        className="relative hidden gap-2 overflow-hidden rounded-2xl bg-muted sm:grid sm:aspect-[21/8]"
        style={{
          gridTemplateAreas: layout.areas,
          gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
          gridTemplateRows: "repeat(2, 1fr)",
        }}
      >
        {order.map((imageIndex, slot) => {
          const url = images[imageIndex]!
          const isActive = slot === 0

          return (
            <motion.button
              key={url}
              type="button"
              layout={!reduce}
              transition={reduce ? { duration: 0 } : SPRING}
              onClick={() =>
                isActive ? openLightbox(imageIndex) : setActive(imageIndex)
              }
              aria-current={isActive}
              aria-label={
                isActive
                  ? t("viewFullSize", { name, number: imageIndex + 1 })
                  : t("showPhoto", { name, number: imageIndex + 1 })
              }
              className="group/tile relative block size-full cursor-pointer overflow-hidden outline-none focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50"
              style={{ gridArea: AREA_LETTERS[slot] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={t("photoAlt", { name, number: imageIndex + 1 })}
                className="size-full object-cover"
              />
              <span className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover/tile:bg-black/10" />
            </motion.button>
          )
        })}
      </div>

      <div className="relative sm:hidden">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto rounded-2xl [&::-webkit-scrollbar]:hidden"
        >
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              aria-label={t("viewFullSize", { name, number: index + 1 })}
              onClick={() => openLightbox(index)}
              className="aspect-4/3 w-full shrink-0 snap-center outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={t("photoAlt", { name, number: index + 1 })}
                className="size-full bg-muted object-cover"
              />
            </button>
          ))}
        </div>

        {count > 1 && count <= MAX_DOTS ? (
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={t("goToPhoto", { number: index + 1 })}
                onClick={() => scrollToSlide(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  index === safeMobileActive
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/50"
                )}
              />
            ))}
          </div>
        ) : count > MAX_DOTS ? (
          <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white tabular-nums">
            {safeMobileActive + 1} / {count}
          </div>
        ) : null}
      </div>

      {corners}

      {count > MAX_TILES ? (
        <button
          type="button"
          onClick={() => openLightbox(safeActive)}
          className="absolute bottom-4 left-4 z-10 hidden rounded-lg bg-background/90 px-3 py-1.5 text-xs font-medium shadow-xs backdrop-blur transition-colors outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 sm:block"
        >
          {t("showAll", { count })}
        </button>
      ) : null}

      <GalleryLightbox
        images={images}
        name={name}
        index={Math.min(lightboxIndex, count - 1)}
        onIndexChange={setLightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  )
}
