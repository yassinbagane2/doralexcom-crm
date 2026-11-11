import { issueDueInvoices } from "./lib/invoice"

/*
 * Work the API server does on its own, not in answer to a request.
 */

const HOUR_MS = 60 * 60 * 1000

/**
 * Issues the invoices that have fallen due (a lease's rent date has come)
 * once at start-up, to catch up on any time the server was down, and every
 * hour after. Safe to run on several servers at once: issuing is idempotent.
 */
export function startInvoiceScheduler() {
  const run = async () => {
    try {
      const issued = await issueDueInvoices()
      if (issued > 0) console.log(`Issued ${issued} invoice(s).`)
    } catch (error) {
      console.error("Could not issue due invoices", error)
    }
  }

  void run()
  const timer = setInterval(run, HOUR_MS)
  timer.unref()
  return () => clearInterval(timer)
}
