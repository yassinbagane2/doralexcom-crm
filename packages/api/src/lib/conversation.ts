import { ORPCError } from "@orpc/server"
import { STAFF_MEMBER_ROLES } from "@workspace/auth/organization"
import { getUserRole } from "@workspace/auth/roles"
import { db } from "@workspace/db"
import {
  conversation,
  conversationMessage,
  member,
  organization,
  type ConversationSide,
} from "@workspace/db/schema"
import { notify } from "@workspace/notifications"
import { and, eq, inArray, ne } from "drizzle-orm"

import { MESSAGE_PREVIEW_LENGTH } from "../conversation"
import { inBackground } from "./background"

/*
 * Business ↔ customer conversations. The business side is anyone who works
 * for the organization (owner or collaborator); the customer side is the one
 * customer the conversation is with, while they still belong to it.
 */

type Conversation = typeof conversation.$inferSelect

export function conversationNotFound() {
  return new ORPCError("NOT_FOUND", {
    message: "Conversation not found.",
    data: { code: "CONVERSATION_NOT_FOUND" },
  })
}

/** Where the app opens a conversation. */
export function conversationPath(conversationId: string) {
  return `/inbox?${new URLSearchParams({ conversation: conversationId })}`
}

/**
 * The conversation, and which side the user is on in it. NOT_FOUND unless
 * they work for its business or are its customer, so nobody learns which
 * ids exist.
 */
export async function accessConversation(
  user: { id: string; role?: string | null },
  conversationId: string
): Promise<{ conversation: Conversation; side: ConversationSide }> {
  const found = await db.query.conversation.findFirst({
    where: eq(conversation.id, conversationId),
  })
  if (!found) throw conversationNotFound()

  const role = getUserRole(user.role)
  const isCustomer = role === "user" && found.customerId === user.id
  if (role !== "business" && !isCustomer) throw conversationNotFound()

  // Membership is checked now rather than when the conversation was made:
  // someone removed from the business loses access to its conversations.
  const membership = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, found.organizationId),
      eq(member.userId, user.id),
      isCustomer
        ? eq(member.role, "member")
        : inArray(member.role, STAFF_MEMBER_ROLES)
    ),
    columns: { id: true },
  })
  if (!membership) throw conversationNotFound()

  return { conversation: found, side: isCustomer ? "customer" : "business" }
}

/** The conversation between a business and a customer, created if need be. */
export async function ensureConversation(
  organizationId: string,
  customerId: string
) {
  await db
    .insert(conversation)
    .values({ organizationId, customerId })
    .onConflictDoNothing({
      target: [conversation.organizationId, conversation.customerId],
    })
  const found = await db.query.conversation.findFirst({
    where: and(
      eq(conversation.organizationId, organizationId),
      eq(conversation.customerId, customerId)
    ),
    columns: { id: true },
  })
  // Just inserted or already there: only a concurrent delete gets here.
  if (!found) throw conversationNotFound()
  return found.id
}

export function preview(body: string) {
  const flat = body.replace(/\s+/g, " ").trim()
  return flat.length > MESSAGE_PREVIEW_LENGTH
    ? `${flat.slice(0, MESSAGE_PREVIEW_LENGTH - 1)}…`
    : flat
}

/**
 * Adds a message, moves the conversation's preview to it, and marks it read
 * for the side that wrote it. The other side gets a notification.
 */
export async function sendMessage(
  found: Conversation,
  side: ConversationSide,
  sender: { id: string; name: string },
  body: string
) {
  const message = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(conversationMessage)
      .values({ conversationId: found.id, senderId: sender.id, side, body })
      .returning()
    if (!created) throw new Error("Message insert returned nothing")

    await tx
      .update(conversation)
      .set({
        lastMessageAt: created.createdAt,
        lastMessageBody: preview(body),
        lastMessageSide: side,
        ...(side === "business"
          ? { businessReadAt: created.createdAt }
          : { customerReadAt: created.createdAt }),
      })
      .where(eq(conversation.id, found.id))

    return created
  })

  inBackground(
    notifyOtherSide(found, side, sender, message),
    `notify about message ${message.id}`
  )

  return message
}

/**
 * Tells the other side there's a new message: the customer, or everyone
 * working for the business except whoever wrote it.
 */
async function notifyOtherSide(
  found: Conversation,
  side: ConversationSide,
  sender: { id: string; name: string },
  message: { id: string; body: string }
) {
  const recipients =
    side === "business"
      ? [found.customerId]
      : (
          await db
            .select({ userId: member.userId })
            .from(member)
            .where(
              and(
                eq(member.organizationId, found.organizationId),
                inArray(member.role, STAFF_MEMBER_ROLES),
                ne(member.userId, sender.id)
              )
            )
        ).map((staff) => staff.userId)
  if (recipients.length === 0) return

  const [business] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, found.organizationId))

  await notify(
    "new-message",
    recipients,
    {
      conversationId: found.id,
      senderName: sender.name,
      organizationName: business?.name ?? "",
      preview: preview(message.body),
      path: conversationPath(found.id),
    },
    // One notification per message, however often this is retried.
    { transactionId: message.id, organizationId: found.organizationId }
  )
}
