"use client"

import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from "@workspace/ui/components/ui/dialog"
import { ChevronLeftIcon, ChevronRightIcon, X } from "@workspace/ui/icons"
import { useTranslations } from "next-intl"

/** Photos full screen, one at a time; arrow keys step through them. */
export function GalleryLightbox({
  images,
  name,
  index,
  onIndexChange,
  open,
  onOpenChange,
}: {
  images: string[]
  /** What the photos are of, for their alt text. */
  name: string
  index: number
  onIndexChange: (index: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Properties.photos")
  const count = images.length

  function go(delta: number) {
    onIndexChange((index + delta + count) % count)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && count > 0 ? (
        <DialogPortal>
          <DialogOverlay className="bg-black/95 supports-backdrop-filter:backdrop-blur-none" />
          <DialogPopup
            aria-label={t("viewerLabel", { name })}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") go(-1)
              if (event.key === "ArrowRight") go(1)
            }}
            className="fixed inset-0 z-50 flex flex-col transition-opacity duration-200 outline-none data-ending-style:opacity-0 data-starting-style:opacity-0"
          >
            <DialogClose
              aria-label={t("close")}
              className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/50"
            >
              <X className="size-5" />
            </DialogClose>

            <div className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-20 sm:py-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={images[index]}
                src={images[index]}
                alt={t("photoAlt", { name, number: index + 1 })}
                className="max-h-[calc(100dvh-6rem)] max-w-[calc(100vw-2rem)] rounded-lg object-contain sm:max-h-[calc(100dvh-8rem)] sm:max-w-[calc(100vw-10rem)]"
              />

              {count > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label={t("previousPhoto")}
                    onClick={() => go(-1)}
                    className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white/80 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/50 sm:left-4"
                  >
                    <ChevronLeftIcon className="size-6" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("nextPhoto")}
                    onClick={() => go(1)}
                    className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white/80 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/50 sm:right-4"
                  >
                    <ChevronRightIcon className="size-6" />
                  </button>
                </>
              ) : null}
            </div>

            {count > 1 ? (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 tabular-nums">
                {index + 1} / {count}
              </div>
            ) : null}
          </DialogPopup>
        </DialogPortal>
      ) : null}
    </Dialog>
  )
}
