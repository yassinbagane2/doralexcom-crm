import { ORPCError } from "@orpc/server"
import { STAFF_MEMBER_ROLES } from "@workspace/auth/organization"
import { getUserRole } from "@workspace/auth/roles"
import { db } from "@workspace/db"
import {
  CONVERSATION_SIDES,
  conversation,
  conversationMessage,
  member,
  organization,
  user,
} from "@workspace/db/schema"
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import { z } from "zod"

import { businessProcedure, o, protectedProcedure } from "../index"
import { MESSAGE_MAX_LENGTH, MESSAGES_PAGE_SIZE } from "../conversation"
import {
  accessConversation,
  ensureConversation,
  sendMessage,
} from "../lib/conversation"
import { customerScope, findCustomer } from "../lib/customer"
import { containing } from "../lib/lease"

/*
 * Messages between a business and its customers (see lib/conversation.ts for
 * who is on which side). Both sides use the same procedures to read, send
 * and mark as read; each lists its conversations its own way.
 */

/** Most conversations a list returns, most recent first. */
const LIST_LIMIT = 200

const sideSchema = z.enum(CONVERSATION_SIDES)

const summarySchema = z.object({
  id: z.string(),
  lastMessageAt: z.date().nullable(),
  lastMessageBody: z.string().nullable(),
  lastMessageSide: sideSchema.nullable(),
  /** The other side wrote last, after the reader last opened it. */
  unread: z.boolean(),
})

const messageSchema = z.object({
  id: z.string(),
  side: sideSchema,
  body: z.string(),
  createdAt: z.date(),
  /** Null once the author's account is deleted. */
  sender: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** Written by the reader themselves. */
  mine: z.boolean(),
})

const conversationInput = z.object({ conversationId: z.uuid() })

/** Unread for `side`: the other side wrote last, after `side` last read. */
function unreadFor(side: (typeof CONVERSATION_SIDES)[number]): SQL {
  const readAt =
    side === "business"
      ? conversation.businessReadAt
      : conversation.customerReadAt
  return and(
    eq(
      conversation.lastMessageSide,
      side === "business" ? "customer" : "business"
    ),
    or(isNull(readAt), gt(conversation.lastMessageAt, readAt))
  ) as SQL
}

/** The organizations a business account works for. */
async function staffOrganizationIds(userId: string) {
  const rows = await db
    .select({ id: member.organizationId })
    .from(member)
    .where(
      and(eq(member.userId, userId), inArray(member.role, STAFF_MEMBER_ROLES))
    )
  return rows.map((row) => row.id)
}

/** Customers only: the business side lists with `list`. */
const customerProcedure = protectedProcedure.use(({ context, next }) => {
  if (getUserRole(context.session.user.role) !== "user") {
    throw new ORPCError("FORBIDDEN")
  }
  return next()
})

export const conversationRouter = o.prefix("/conversations").router({
  /** The business's conversations, most recent first. */
  list: businessProcedure
    .route({ method: "GET", path: "/", tags: ["conversation"] })
    .input(
      z.object({
        search: z
          .string()
          .trim()
          .max(200)
          .optional()
          .transform((value) => value || undefined),
      })
    )
    .output(
      z.array(
        summarySchema.extend({
          customer: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
          }),
        })
      )
    )
    .handler(async ({ context, input }) => {
      const rows = await db
        .select({
          id: conversation.id,
          lastMessageAt: conversation.lastMessageAt,
          lastMessageBody: conversation.lastMessageBody,
          lastMessageSide: conversation.lastMessageSide,
          unread: sql<boolean>`coalesce(${unreadFor("business")}, false)`,
          customer: { id: user.id, name: user.name, email: user.email },
        })
        .from(conversation)
        .innerJoin(user, eq(user.id, conversation.customerId))
        // Still a customer of this business: removed ones drop off the list.
        .innerJoin(
          member,
          and(
            eq(member.userId, user.id),
            eq(member.organizationId, conversation.organizationId)
          )
        )
        .where(
          and(
            eq(conversation.organizationId, context.organizationId),
            customerScope(context.organizationId),
            input.search
              ? or(
                  ilike(user.name, containing(input.search)),
                  ilike(user.email, containing(input.search))
                )
              : undefined
          )
        )
        .orderBy(
          sql`${conversation.lastMessageAt} desc nulls last`,
          desc(conversation.createdAt)
        )
        .limit(LIST_LIMIT)

      return rows
    }),

  /** The conversation with one of the business's customers, started if new. */
  open: businessProcedure
    .route({ method: "POST", path: "/open", tags: ["conversation"] })
    .input(z.object({ customerId: z.uuid() }))
    .output(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      await findCustomer(context.organizationId, input.customerId)
      return {
        id: await ensureConversation(context.organizationId, input.customerId),
      }
    }),

  /**
   * The customer's conversations: one with each business they belong to,
   * started here if new, so there is always someone to write to.
   */
  mine: customerProcedure
    .route({ method: "GET", path: "/mine", tags: ["conversation"] })
    .output(
      z.array(
        summarySchema.extend({
          business: z.object({ id: z.string(), name: z.string() }),
        })
      )
    )
    .handler(async ({ context }) => {
      const userId = context.session.user.id
      const memberships = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(and(eq(member.userId, userId), eq(member.role, "member")))
      for (const { organizationId } of memberships) {
        await ensureConversation(organizationId, userId)
      }

      return db
        .select({
          id: conversation.id,
          lastMessageAt: conversation.lastMessageAt,
          lastMessageBody: conversation.lastMessageBody,
          lastMessageSide: conversation.lastMessageSide,
          unread: sql<boolean>`coalesce(${unreadFor("customer")}, false)`,
          business: { id: organization.id, name: organization.name },
        })
        .from(conversation)
        .innerJoin(
          organization,
          eq(organization.id, conversation.organizationId)
        )
        .where(
          and(
            eq(conversation.customerId, userId),
            inArray(
              conversation.organizationId,
              memberships.map((m) => m.organizationId)
            )
          )
        )
        .orderBy(
          sql`${conversation.lastMessageAt} desc nulls last`,
          organization.name
        )
    }),

  /** Who the conversation is with, as the reader sees it. */
  get: protectedProcedure
    .route({
      method: "GET",
      path: "/{conversationId}",
      tags: ["conversation"],
    })
    .input(conversationInput)
    .output(
      z.object({
        id: z.string(),
        side: sideSchema,
        /** The customer, for the business; the business, for the customer. */
        with: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string().nullable(),
        }),
      })
    )
    .handler(async ({ context, input }) => {
      const { conversation: found, side } = await accessConversation(
        context.session.user,
        input.conversationId
      )

      if (side === "business") {
        const customer = await db.query.user.findFirst({
          where: eq(user.id, found.customerId),
          columns: { id: true, name: true, email: true },
        })
        if (!customer) throw new ORPCError("NOT_FOUND")
        return { id: found.id, side, with: customer }
      }

      const business = await db.query.organization.findFirst({
        where: eq(organization.id, found.organizationId),
        columns: { id: true, name: true },
      })
      if (!business) throw new ORPCError("NOT_FOUND")
      return { id: found.id, side, with: { ...business, email: null } }
    }),

  /**
   * A page of messages, oldest first: the latest ones, or those before
   * `before` (a message id) when scrolling back.
   */
  messages: protectedProcedure
    .route({
      method: "GET",
      path: "/{conversationId}/messages",
      tags: ["conversation"],
    })
    .input(conversationInput.extend({ before: z.uuid().optional() }))
    .output(
      z.object({ messages: z.array(messageSchema), hasMore: z.boolean() })
    )
    .handler(async ({ context, input }) => {
      const { conversation: found } = await accessConversation(
        context.session.user,
        input.conversationId
      )

      let older: SQL | undefined
      if (input.before) {
        const cursor = await db.query.conversationMessage.findFirst({
          where: and(
            eq(conversationMessage.id, input.before),
            eq(conversationMessage.conversationId, found.id)
          ),
          columns: { id: true, createdAt: true },
        })
        if (!cursor) throw new ORPCError("BAD_REQUEST")
        older = or(
          lt(conversationMessage.createdAt, cursor.createdAt),
          and(
            eq(conversationMessage.createdAt, cursor.createdAt),
            lt(conversationMessage.id, cursor.id)
          )
        )
      }

      const rows = await db
        .select({
          id: conversationMessage.id,
          side: conversationMessage.side,
          body: conversationMessage.body,
          createdAt: conversationMessage.createdAt,
          senderId: conversationMessage.senderId,
          senderName: user.name,
        })
        .from(conversationMessage)
        .leftJoin(user, eq(user.id, conversationMessage.senderId))
        .where(and(eq(conversationMessage.conversationId, found.id), older))
        .orderBy(
          desc(conversationMessage.createdAt),
          desc(conversationMessage.id)
        )
        .limit(MESSAGES_PAGE_SIZE + 1)

      const page = rows.slice(0, MESSAGES_PAGE_SIZE).reverse()
      return {
        hasMore: rows.length > MESSAGES_PAGE_SIZE,
        messages: page.map((row) => ({
          id: row.id,
          side: row.side,
          body: row.body,
          createdAt: row.createdAt,
          sender:
            row.senderId && row.senderName
              ? { id: row.senderId, name: row.senderName }
              : null,
          mine: row.senderId === context.session.user.id,
        })),
      }
    }),

  send: protectedProcedure
    .route({
      method: "POST",
      path: "/{conversationId}/messages",
      tags: ["conversation"],
    })
    .input(
      conversationInput.extend({
        body: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
      })
    )
    .output(messageSchema)
    .handler(async ({ context, input }) => {
      const { conversation: found, side } = await accessConversation(
        context.session.user,
        input.conversationId
      )
      const sender = context.session.user
      const message = await sendMessage(found, side, sender, input.body)
      return {
        id: message.id,
        side: message.side,
        body: message.body,
        createdAt: message.createdAt,
        sender: { id: sender.id, name: sender.name },
        mine: true,
      }
    }),

  /** The reader has seen everything in it so far. */
  markRead: protectedProcedure
    .route({
      method: "POST",
      path: "/{conversationId}/read",
      tags: ["conversation"],
    })
    .input(conversationInput)
    .output(z.void())
    .handler(async ({ context, input }) => {
      const { conversation: found, side } = await accessConversation(
        context.session.user,
        input.conversationId
      )
      const now = new Date()
      await db
        .update(conversation)
        .set(
          side === "business"
            ? { businessReadAt: now }
            : { customerReadAt: now }
        )
        .where(eq(conversation.id, found.id))
    }),

  /** Conversations with something the reader hasn't read: the nav badge. */
  unreadCount: protectedProcedure
    .route({ method: "GET", path: "/unread-count", tags: ["conversation"] })
    .output(z.number())
    .handler(async ({ context }) => {
      const { id: userId, role } = context.session.user
      const userRole = getUserRole(role)
      if (userRole === "admin") return 0

      const scope =
        userRole === "business"
          ? and(
              inArray(
                conversation.organizationId,
                await staffOrganizationIds(userId)
              ),
              unreadFor("business")
            )
          : and(eq(conversation.customerId, userId), unreadFor("customer"))

      const [result] = await db
        .select({ value: count() })
        .from(conversation)
        .where(scope)
      return result?.value ?? 0
    }),
})
