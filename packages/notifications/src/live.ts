import { EventEmitter } from "node:events"

import { env } from "@workspace/db/env"
import { Client } from "pg"

/*
 * Live delivery. notify() fires pg_notify on NOTIFICATIONS_CHANNEL with the
 * recipient's user id; each server holds one connection listening there and
 * hands every event to that user's subscribers in this process (their open
 * notification streams). It connects on the first subscription.
 */

/** The Postgres channel notify() announces new notifications on. */
export const NOTIFICATIONS_CHANNEL = "notifications"

/** Emitted to every subscriber after reconnecting: they may have missed events. */
const EVERYONE = "*"

const MAX_RETRY_DELAY_MS = 30_000

const events = new EventEmitter().setMaxListeners(0)

let client: Client | undefined
let connecting: Promise<void> | undefined
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let retryDelay = 1000
let stopped = false

/**
 * Calls `listener` whenever `userId` gets a new notification, until the
 * returned function is called.
 */
export function subscribeToNotifications(userId: string, listener: () => void) {
  stopped = false
  if (!client && !connecting && !reconnectTimer) void listen()

  events.on(userId, listener)
  events.on(EVERYONE, listener)
  return () => {
    events.off(userId, listener)
    events.off(EVERYONE, listener)
  }
}

/** Closes the listening connection; subscribing again reopens it. */
export async function stopListening() {
  stopped = true
  clearTimeout(reconnectTimer)
  reconnectTimer = undefined
  await connecting?.catch(() => undefined)
  const current = client
  client = undefined
  await current?.end().catch(() => undefined)
}

async function listen() {
  connecting = connect()
  try {
    await connecting
    retryDelay = 1000
  } catch (error) {
    console.error("[notifications] Could not listen:", error)
    reconnectLater()
  } finally {
    connecting = undefined
  }
}

async function connect() {
  const connection = new Client({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
    keepAlive: true,
  })
  connection.on("notification", ({ payload }) => {
    if (payload) events.emit(payload)
  })
  connection.on("error", (error) => {
    console.error("[notifications] Listener connection failed:", error)
    lost(connection)
  })
  connection.on("end", () => lost(connection))

  await connection.connect()
  await connection.query(`LISTEN ${NOTIFICATIONS_CHANNEL}`)
  client = connection
}

/** The connection dropped: open a new one, and have everyone catch up. */
function lost(connection: Client) {
  if (client !== connection) return
  client = undefined
  connection.removeAllListeners()
  void connection.end().catch(() => undefined)
  reconnectLater()
}

function reconnectLater() {
  if (stopped || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    void listen().then(() => {
      if (client) events.emit(EVERYONE)
    })
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
}
