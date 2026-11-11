/*
 * Offset pagination shared by the API and the web app, for lists loaded a page
 * at a time as the reader scrolls. Keep this file free of server imports: it
 * ends up in client bundles.
 */
import { z } from "zod"

export const PAGE_SIZE = 20

export const MAX_PAGE_SIZE = 100

/** Input fields of a paginated list; spread into the list's own input schema. */
export const paginationShape = {
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
  /** Free text matched against the list's own columns; blank means everything. */
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || undefined),
}

export const paginatedOutput = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  })

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const pageOffset = (page: number, pageSize: number) =>
  (page - 1) * pageSize

/** Page number after `page` when an infinite list walks offset pages, or `undefined` after the last one. */
export const nextOffsetPage = ({
  page,
  totalPages,
}: Pick<PaginatedResult<unknown>, "page" | "totalPages">): number | undefined =>
  page < totalPages ? page + 1 : undefined
