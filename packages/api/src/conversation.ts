/*
 * Limits of business ↔ customer conversations, shared by the API and the web
 * app. Keep this file free of server imports: it ends up in client bundles.
 */

/** Longest message, in characters. */
export const MESSAGE_MAX_LENGTH = 4000

/** Messages loaded at a time, newest first. */
export const MESSAGES_PAGE_SIZE = 50

/** Characters of a message shown in lists and notifications. */
export const MESSAGE_PREVIEW_LENGTH = 140
