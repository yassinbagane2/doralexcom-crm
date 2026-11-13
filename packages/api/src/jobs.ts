import { issueDueInvoices } from "./lib/invoice"

/*
 * Work the API server does on its own, not in answer to a request.
 */

/** Invoices go out once a day, at this hour in Romania. */
const INVOICE_TIME_ZONE = "Europe/Bucharest"
const INVOICE_HOUR = 8

const wallClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: INVOICE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

/** `at` as read on a clock in Romania. */
function romanianTime(at: Date) {
  const parts = Object.fromEntries(
    wallClock.formatToParts(at).map((part) => [part.type, part.value])
  )
  const [year, month, day, hour, minute, second] = [
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ].map(Number) as [number, number, number, number, number, number]
  return {
    /** The calendar day in Romania, as "YYYY-MM-DD". */
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    /** How far Romania's clock is ahead of UTC at `at`, in ms. */
    offset:
      Date.UTC(year, month - 1, day, hour, minute, second) -
      Math.floor(at.getTime() / 1000) * 1000,
  }
}

/** The next 08:00 in Romania after `now`, summer or winter time. */
function nextInvoiceRun(now: Date) {
  const { day } = romanianTime(now)
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ]
  for (let ahead = 0; ahead < 3; ahead++) {
    const wall = Date.UTC(year, month - 1, date + ahead, INVOICE_HOUR)
    // Romania changes its clocks at 03:00/04:00, never near 08:00, so the
    // offset a few hours either side of the run is the one that applies.
    const run = new Date(wall - romanianTime(new Date(wall)).offset)
    if (run > now) return run
  }
  throw new Error("No invoice run in the next three days")
}

/**
 * Issues every invoice that has fallen due (a lease's rent date has come),
 * for everyone, once a day at 08:00 Romanian time, billing as of that day in
 * Romania. A server started after 08:00 catches up on today's run straight
 * away, so a restart or downtime never skips a day. Safe to run on several
 * servers at once: issuing is idempotent.
 */
export function startInvoiceScheduler() {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const run = async () => {
    try {
      const issued = await issueDueInvoices(romanianTime(new Date()).day)
      if (issued > 0) console.log(`Issued ${issued} invoice(s).`)
    } catch (error) {
      console.error("Could not issue due invoices", error)
    }
  }

  // Recomputed after every run: days are 23 or 25 hours long around a clock
  // change, so a fixed 24-hour interval would drift off 08:00.
  const scheduleNext = () => {
    if (stopped) return
    timer = setTimeout(
      () => void run().finally(scheduleNext),
      nextInvoiceRun(new Date()).getTime() - Date.now()
    )
    timer.unref()
  }

  if (romanianTime(new Date()).hour >= INVOICE_HOUR) {
    void run().finally(scheduleNext)
  } else {
    scheduleNext()
  }

  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
