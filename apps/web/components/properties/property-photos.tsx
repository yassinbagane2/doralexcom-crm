"use client"

import { PROPERTY_PHOTO_LIMITS } from "@workspace/api/property"
import { toast } from "@workspace/ui/components/motion/toaster"
import { Button } from "@workspace/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/ui/dropdown-menu"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DotsHorizontal,
  ImageUp,
  LoaderCircle,
  Star,
  Trash,
} from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useRef, useState, type DragEvent } from "react"

import {
  propertyPhotoUrl,
  useDeletePropertyPhoto,
  useReorderPropertyPhotos,
  useUploadPropertyPhotos,
  type PropertyPhoto,
} from "@/hooks/queries/property"

/** A hidden file picker for photos, opened by `open()`. */
function usePhotoPicker(onPick: (files: File[]) => void) {
  const input = useRef<HTMLInputElement>(null)
  const element = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(event) => {
        const files = Array.from(event.target.files ?? [])
        // Cleared so picking the same file again still fires a change.
        event.target.value = ""
        if (files.length > 0) onPick(files)
      }}
    />
  )
  return { element, open: () => input.current?.click() }
}

const hasFiles = (event: DragEvent) =>
  event.dataTransfer.types.includes("Files")

/**
 * Over the gallery of a property without photos: picks some and uploads
 * them right away, no dialog in between.
 */
export function AddPhotosButton({ propertyId }: { propertyId: string }) {
  const t = useTranslations("Properties.photos")
  const { upload, progress } = useUploadPropertyPhotos(propertyId)
  const picker = usePhotoPicker((files) => void upload(files))

  return (
    <>
      {picker.element}
      <Button
        size="sm"
        variant="secondary"
        disabled={progress !== null}
        onClick={picker.open}
        className="bg-background/90 shadow-xs backdrop-blur hover:bg-background"
      >
        {progress ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <ImageUp className="size-3.5" />
        )}
        {progress
          ? t("uploading", { done: progress.done, total: progress.total })
          : t("add")}
      </Button>
    </>
  )
}

/**
 * Everything about a property's photos in one place: add more (pick them or
 * drop them in), choose the cover, put them in order, delete them.
 */
export function PropertyPhotosDialog({
  propertyId,
  photos,
  open,
  onOpenChange,
}: {
  propertyId: string
  photos: PropertyPhoto[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Properties.photos")
  const { upload, progress } = useUploadPropertyPhotos(propertyId)
  const reorder = useReorderPropertyPhotos()
  const remove = useDeletePropertyPhoto()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const room = PROPERTY_PHOTO_LIMITS.perProperty - photos.length
  const take = (files: File[]) => {
    if (files.length > room)
      toast.error(t("limit", { max: PROPERTY_PHOTO_LIMITS.perProperty }))
    if (room > 0) void upload(files.slice(0, room))
  }
  const picker = usePhotoPicker(take)

  const move = (from: number, to: number) => {
    const ids = photos.map((photo) => photo.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved!)
    reorder.mutate({ propertyId, ids })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setConfirming(null)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { max: PROPERTY_PHOTO_LIMITS.perProperty })}
          </DialogDescription>
        </DialogHeader>

        {picker.element}
        <div
          className={cn(
            "mt-5 grid grid-cols-2 gap-3 rounded-xl transition-shadow sm:grid-cols-3",
            dragging && "ring-2 ring-ring/50 ring-offset-4 ring-offset-popover"
          )}
          onDragOver={(event) => {
            if (!hasFiles(event)) return
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDragging(false)
            }
          }}
          onDrop={(event) => {
            if (!hasFiles(event)) return
            event.preventDefault()
            setDragging(false)
            if (progress === null) take(Array.from(event.dataTransfer.files))
          }}
        >
          {photos.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              index={index}
              count={photos.length}
              confirming={confirming === photo.id}
              deleting={remove.isPending && remove.variables?.id === photo.id}
              onMove={(to) => move(index, to)}
              onAskDelete={() => setConfirming(photo.id)}
              onCancelDelete={() => setConfirming(null)}
              onDelete={() =>
                remove.mutate(
                  { id: photo.id },
                  { onSettled: () => setConfirming(null) }
                )
              }
            />
          ))}

          {room > 0 ? (
            <button
              type="button"
              onClick={picker.open}
              disabled={progress !== null}
              className="flex aspect-4/3 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
            >
              {progress ? (
                <>
                  <LoaderCircle className="size-5 animate-spin" />
                  <span className="tabular-nums">
                    {t("uploading", {
                      done: progress.done,
                      total: progress.total,
                    })}
                  </span>
                </>
              ) : (
                <>
                  <ImageUp className="size-5" />
                  <span className="px-3 text-center">{t("addOrDrop")}</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PhotoTile({
  photo,
  index,
  count,
  confirming,
  deleting,
  onMove,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  photo: PropertyPhoto
  index: number
  count: number
  confirming: boolean
  deleting: boolean
  onMove: (to: number) => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  const t = useTranslations("Properties.photos")
  const isCover = index === 0

  return (
    <div className="group/photo relative aspect-4/3 overflow-hidden rounded-xl bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={propertyPhotoUrl(photo.id)}
        alt={t("thumbnailAlt", { number: index + 1 })}
        className="size-full object-cover"
      />

      {isCover ? (
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium shadow-xs backdrop-blur">
          <Star className="size-3 fill-current" />
          {t("cover")}
        </span>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label={t("photoActions", { number: index + 1 })}
              className="absolute top-2 right-2 bg-background/90 shadow-xs backdrop-blur hover:bg-background"
            />
          }
        >
          <DotsHorizontal size={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {!isCover ? (
            <DropdownMenuItem onClick={() => onMove(0)}>
              <Star className="size-4" />
              {t("makeCover")}
            </DropdownMenuItem>
          ) : null}
          {index > 0 ? (
            <DropdownMenuItem onClick={() => onMove(index - 1)}>
              <ChevronLeftIcon className="size-4" />
              {t("moveEarlier")}
            </DropdownMenuItem>
          ) : null}
          {index < count - 1 ? (
            <DropdownMenuItem onClick={() => onMove(index + 1)}>
              <ChevronRightIcon className="size-4" />
              {t("moveLater")}
            </DropdownMenuItem>
          ) : null}
          {count > 1 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem variant="destructive" onClick={onAskDelete}>
            <Trash size={16} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {confirming ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/85 p-3 text-center backdrop-blur-sm">
          <p className="text-sm font-medium">{t("deleteConfirm")}</p>
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="ghost"
              disabled={deleting}
              onClick={onCancelDelete}
            >
              {t("cancel")}
            </Button>
            <Button
              size="xs"
              variant="destructive"
              disabled={deleting}
              onClick={onDelete}
            >
              {deleting ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : null}
              {t("delete")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
