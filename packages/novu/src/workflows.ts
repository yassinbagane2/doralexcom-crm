/**
 * Workflow ids the app triggers. Each must exist, with the same id, in the
 * Novu dashboard; it decides the channels (an In-App step reaches the inbox).
 */
export const NOVU_WORKFLOWS = {
  /**
   * A new message in a business ↔ customer conversation. Payload:
   * `senderName`, `organizationName`, `preview`, `conversationId`, `path`
   * (where the app opens it) and `link` (the same, absolute, for emails).
   */
  newMessage: "new-message",
} as const
