import { relations, sql } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { organization, user } from "./auth"

/*
 * Messages between a business and its customers. Each customer has one
 * conversation with each business they belong to; on the business side it is
 * shared by everyone who works there (owner and collaborators), who read and
 * answer it as the business.
 */

/** Who wrote a message: someone working for the business, or the customer. */
export const CONVERSATION_SIDES = ["business", "customer"] as const

export type ConversationSide = (typeof CONVERSATION_SIDES)[number]

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /*
     * The latest message, copied here so lists show a preview and sort
     * without reading the messages. Null until the first one.
     */
    lastMessageAt: timestamp("last_message_at"),
    lastMessageBody: text("last_message_body"),
    lastMessageSide: text("last_message_side", { enum: CONVERSATION_SIDES }),
    /** When each side last read it; anything newer from the other is unread. */
    businessReadAt: timestamp("business_read_at"),
    customerReadAt: timestamp("customer_read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("conversation_organization_customer_uidx").on(
      table.organizationId,
      table.customerId
    ),
    index("conversation_organization_lastMessage_idx").on(
      table.organizationId,
      table.lastMessageAt
    ),
    index("conversation_customerId_idx").on(table.customerId),
  ]
)

export const conversationMessage = pgTable(
  "conversation_message",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    /** Kept as `side` when the author's account is deleted. */
    senderId: uuid("sender_id").references(() => user.id, {
      onDelete: "set null",
    }),
    side: text("side", { enum: CONVERSATION_SIDES }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("conversation_message_conversation_createdAt_idx").on(
      table.conversationId,
      table.createdAt
    ),
  ]
)

export const conversationRelations = relations(
  conversation,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [conversation.organizationId],
      references: [organization.id],
    }),
    customer: one(user, {
      fields: [conversation.customerId],
      references: [user.id],
    }),
    messages: many(conversationMessage),
  })
)

export const conversationMessageRelations = relations(
  conversationMessage,
  ({ one }) => ({
    conversation: one(conversation, {
      fields: [conversationMessage.conversationId],
      references: [conversation.id],
    }),
    sender: one(user, {
      fields: [conversationMessage.senderId],
      references: [user.id],
    }),
  })
)
