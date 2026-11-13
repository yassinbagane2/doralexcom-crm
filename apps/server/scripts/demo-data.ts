/**
 * A demo business for marketing screenshots: "Ionescu Properties", owned by
 * maria.ionescu@example.com, with a dozen properties, tenants, leases,
 * invoices, payments and signed contracts. Everything goes through the API's
 * own routers, so invoices, contracts and signatures are real.
 *
 *   pnpm --filter server with-env tsx scripts/demo-data.ts seed <signatures.json>
 *   pnpm --filter server with-env tsx scripts/demo-data.ts remove
 *
 * `remove` deletes the business, its accounts and every file it stored in R2.
 * No email leaves the machine: requests to Resend are answered locally.
 */
import { readFileSync } from "node:fs"

import { createRouterClient } from "@orpc/server"
import { createContext } from "@workspace/api/context"
import { fillMergeFields, type MergeFieldKey } from "@workspace/api/contract"
import { appRouter } from "@workspace/api/routers"
import {
  discardDocumentContent,
  discardPropertyPhotos,
  documentStorage,
  paymentProofLocation,
  signedPdfKey,
} from "@workspace/api/storage"
import { auth } from "@workspace/auth"
import { db } from "@workspace/db"
import {
  customerDocument,
  invoice,
  member,
  organization,
  paymentProof,
  property,
  propertyPhoto,
  template,
  user,
} from "@workspace/db/schema"
import { and, asc, eq, inArray, ne } from "drizzle-orm"

const SLUG = "ionescu-properties-demo"
const OWNER = { name: "Maria Ionescu", email: "maria.ionescu@example.com" }
const PASSWORD = "Tenora-Demo-2026!"

// Keep every email local: the business's notifications would go to Resend.
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  if (url.includes("resend.com")) {
    return new Response(JSON.stringify({ id: "demo" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }
  return realFetch(input, init)
}) as typeof fetch

async function clientFor(email: string) {
  const response = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  })
  if (!response.ok) throw new Error(`Sign-in failed for ${email}: ${response.status}`)
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
  const headers = new Headers({ cookie, origin: process.env.NEXT_PUBLIC_APP_URL ?? "" })
  return createRouterClient(appRouter, { context: await createContext({ headers }) })
}

const PHOTOS = {
  living: "https://images.unsplash.com/photo-1628592102751-ba83b0314276?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  living2: "https://images.unsplash.com/photo-1613575831056-0acd5da8f085?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  bedroom: "https://images.unsplash.com/photo-1630699375019-c334927264df?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  bedroom2: "https://images.unsplash.com/photo-1560448075-57d0285fc59b?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  office: "https://images.unsplash.com/photo-1705909770198-7e83c24e1616?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  officeFacade: "https://images.unsplash.com/photo-1519748174344-16e5d53bda7a?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  officeGlass: "https://images.unsplash.com/photo-1621831337128-35676ca30868?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  kitchen: "https://images.unsplash.com/photo-1635321350281-e2a91ecffd00?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  kitchen2: "https://images.unsplash.com/photo-1689043528099-2ba014dd7c64?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  garage: "https://images.unsplash.com/photo-1548343361-02248be15911?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  garage2: "https://images.unsplash.com/photo-1474408886716-087263db7da1?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  studio: "https://images.unsplash.com/photo-1702014862053-946a122b920d?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  studio2: "https://images.unsplash.com/photo-1702014857653-dcea938d51f0?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  building: "https://images.unsplash.com/photo-1501525776-246410718e63?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
  building2: "https://images.unsplash.com/photo-1685127855461-bb81749e9dd9?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400",
} as const
type Photo = keyof typeof PHOTOS

type PropertySeed = {
  key: string
  type: "apartment" | "office" | "garage" | "parking"
  name: string
  address: string
  surfaceArea: number | null
  rent: number
  description: string | null
  photos: Photo[]
}

const PROPERTIES: PropertySeed[] = [
  { key: "a4b", type: "apartment", name: "Apartment 4B", address: "Str. Lipscani 12, București", surfaceArea: 62, rent: 650, description: "Two rooms, third floor, renovated 2024. Furnished, with balcony.", photos: ["living", "bedroom", "kitchen"] },
  { key: "s1a", type: "apartment", name: "Studio 1A", address: "Str. Lipscani 12, București", surfaceArea: 34, rent: 480, description: "Bright studio on the first floor, kitchenette, fully furnished.", photos: ["studio", "studio2"] },
  { key: "a5a", type: "apartment", name: "Apartment 5A", address: "Str. Lipscani 12, București", surfaceArea: 70, rent: 640, description: "Two rooms, top floor, view over the old town.", photos: ["bedroom2", "living2"] },
  { key: "a2c", type: "apartment", name: "Apartment 2C", address: "Bd. Dacia 30, București", surfaceArea: 58, rent: 690, description: "Two rooms, second floor, parking space included.", photos: ["living2", "kitchen2"] },
  { key: "a8", type: "apartment", name: "Apartment 8", address: "Bd. Dacia 30, București", surfaceArea: 81, rent: 760, description: "Three rooms, corner unit with two balconies.", photos: ["building", "living"] },
  { key: "a12", type: "apartment", name: "Apartment 12", address: "Str. Matei Voievod 7, București", surfaceArea: 64, rent: 720, description: "Two rooms in a 2022 building, underfloor heating.", photos: ["kitchen", "bedroom"] },
  { key: "o1", type: "office", name: "Office 1", address: "Str. Episcopiei 6, București", surfaceArea: 140, rent: 2100, description: "Ground-floor office, open space plus two meeting rooms.", photos: ["office", "officeFacade"] },
  { key: "o2", type: "office", name: "Office 2", address: "Bd. Unirii 45, București", surfaceArea: 95, rent: 1250, description: "Fourth-floor office with reception desk.", photos: ["officeGlass", "office"] },
  { key: "o3", type: "office", name: "Office 3", address: "Bd. Unirii 45, București", surfaceArea: 120, rent: 1400, description: "Fifth-floor office, fitted out, kitchen area.", photos: ["officeFacade", "officeGlass"] },
  { key: "g3", type: "garage", name: "Garage 3", address: "Calea Victoriei 88, București", surfaceArea: 18, rent: 95, description: null, photos: ["garage"] },
  { key: "g7", type: "garage", name: "Garage 7", address: "Calea Victoriei 88, București", surfaceArea: 18, rent: 90, description: null, photos: ["garage2"] },
  { key: "pb4", type: "parking", name: "Parking B4", address: "Calea Victoriei 88, București", surfaceArea: null, rent: 60, description: "Underground spot, level -1.", photos: ["garage"] },
]

type CustomerSeed = {
  key: string
  name: string
  email: string
  phone: string
  address: string
  contacts?: { name: string; relation: string; email: string; phone: string }[]
}

const CUSTOMERS: CustomerSeed[] = [
  { key: "ana", name: "Ana Dumitru", email: "ana.dumitru@example.com", phone: "+40 722 418 305", address: "Str. Fabricii 14, Cluj-Napoca", contacts: [{ name: "Ion Dumitru", relation: "Guarantor", email: "ion.dumitru@example.com", phone: "+40 744 120 556" }] },
  { key: "elena", name: "Elena Georgescu", email: "elena.georgescu@example.com", phone: "+40 723 551 902", address: "Str. Lipscani 12, ap. 5A, București" },
  { key: "ioana", name: "Ioana Radu", email: "ioana.radu@example.com", phone: "+40 731 207 448", address: "Bd. Dacia 30, ap. 2C, București" },
  { key: "mihai", name: "Mihai Pop", email: "mihai.pop@example.com", phone: "+40 745 873 210", address: "Str. Republicii 3, Brașov" },
  { key: "atlas", name: "Atlas Legal SRL", email: "office@atlaslegal.example.com", phone: "+40 21 310 4420", address: "Str. Episcopiei 6, București", contacts: [{ name: "Radu Popa", relation: "Managing partner", email: "radu.popa@atlaslegal.example.com", phone: "+40 722 600 101" }] },
  { key: "nordic", name: "Nordic Studio SRL", email: "hello@nordicstudio.example.com", phone: "+40 21 527 1900", address: "Str. Polonă 21, București", contacts: [{ name: "Sofia Lind", relation: "Office manager", email: "sofia@nordicstudio.example.com", phone: "+40 733 218 777" }] },
  { key: "victor", name: "Victor Stan", email: "victor.stan@example.com", phone: "+40 726 904 512", address: "Calea Victoriei 90, București" },
  { key: "dan", name: "Dan Ciobanu", email: "dan.ciobanu@example.com", phone: "+40 740 115 382", address: "Calea Victoriei 92, București" },
  { key: "andrei", name: "Andrei Marin", email: "andrei.marin@example.com", phone: "+40 752 330 917", address: "Bd. Dacia 30, ap. 8, București" },
  { key: "bianca", name: "Bianca Stoica", email: "bianca.stoica@example.com", phone: "+40 768 402 166", address: "Str. Popa Nan 9, București" },
]

type LeaseSeed = {
  customer: string
  property: string
  startDate: string
  termMonths: number | null
  autoRenew?: boolean
  charges?: number
  deposit?: number
  /** Customer signs the contract. */
  signed: boolean
  /** Invoice months (YYYY-MM) left unpaid. */
  unpaid?: string[]
  /** Invoice month with proof of payment waiting for review. */
  proof?: string
}

const LEASES: LeaseSeed[] = [
  { customer: "ioana", property: "a2c", startDate: "2025-03-01", termMonths: 12, autoRenew: true, charges: 45, deposit: 1380, signed: true },
  { customer: "atlas", property: "o1", startDate: "2024-06-01", termMonths: null, charges: 180, deposit: 4200, signed: true, unpaid: ["2026-11"] },
  { customer: "victor", property: "g3", startDate: "2025-09-01", termMonths: null, deposit: 95, signed: true, proof: "2026-11" },
  { customer: "dan", property: "pb4", startDate: "2026-02-01", termMonths: null, deposit: 60, signed: true },
  { customer: "andrei", property: "a8", startDate: "2026-04-01", termMonths: 12, charges: 50, deposit: 1520, signed: true },
  { customer: "bianca", property: "o2", startDate: "2026-01-15", termMonths: 24, charges: 120, deposit: 2500, signed: true },
  { customer: "elena", property: "a5a", startDate: "2025-12-15", termMonths: 12, charges: 40, deposit: 1280, signed: true },
  { customer: "ana", property: "a4b", startDate: "2026-12-01", termMonths: 12, charges: 40, deposit: 1300, signed: false },
  { customer: "nordic", property: "o3", startDate: "2026-12-15", termMonths: 36, charges: 150, deposit: 4200, signed: true },
  { customer: "mihai", property: "a12", startDate: "2027-01-01", termMonths: 12, charges: 45, deposit: 1440, signed: false },
]

const money = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(amount)
const longDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

const PROOF_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 88>>stream
BT /F1 18 Tf 60 760 Td (Bank transfer confirmation - EUR 95.00 - Garage 3) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`

async function seed(signaturesPath: string) {
  const signatures = JSON.parse(readFileSync(signaturesPath, "utf8")) as Record<string, string>
  const existing = await db.query.organization.findFirst({ where: eq(organization.slug, SLUG) })
  if (existing) throw new Error("The demo business already exists. Run `remove` first.")

  const sourceTemplate = await db.query.template.findFirst({ orderBy: asc(template.createdAt) })
  if (!sourceTemplate) throw new Error("No contract template to start from.")

  // Owner and business, as an admin would set them up.
  const created = await auth.api.createUser({
    body: { ...OWNER, password: PASSWORD, role: "business" },
  })
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, created.user.id))
  const [org] = await db
    .insert(organization)
    .values({
      name: "Ionescu Properties",
      slug: SLUG,
      type: "business",
      createdAt: new Date(),
      legalStructure: "limited_company",
      taxId: "RO41238765",
      registrationNumber: "J40/12345/2019",
      address: "Str. Lipscani 12, 030031 București",
      vatNumber: "RO41238765",
      bankName: "Banca Transilvania",
      iban: "RO49BTRLRONCRT0571290101",
    })
    .returning({ id: organization.id })
  await db.insert(member).values({ organizationId: org!.id, userId: created.user.id, role: "owner", createdAt: new Date() })
  console.log("Business created")

  const owner = await clientFor(OWNER.email)
  await owner.signature.save({ signerName: OWNER.name, image: signatures[OWNER.name]! })
  await owner.contract.createTemplate({ name: "Residential lease", content: sourceTemplate.content as never })

  const propertyIds: Record<string, string> = {}
  for (const seed of PROPERTIES) {
    const { id } = await owner.property.create({
      type: seed.type,
      name: seed.name,
      address: seed.address,
      surfaceArea: seed.surfaceArea,
      description: seed.description ?? "",
      doorCode: "",
      phone: "",
      rent: seed.rent,
      currency: "EUR",
    } as never)
    propertyIds[seed.key] = id
    for (const photo of seed.photos) {
      const bytes = new Uint8Array(await (await realFetch(PHOTOS[photo])).arrayBuffer())
      await owner.propertyPhoto.upload({ propertyId: id, file: new File([bytes], `${photo}.jpg`, { type: "image/jpeg" }) })
    }
  }
  console.log("Properties created")

  const customerIds: Record<string, string> = {}
  for (const seed of CUSTOMERS) {
    const { id } = await owner.customer.create({
      name: seed.name,
      email: seed.email,
      password: PASSWORD,
      phone: seed.phone,
      address: seed.address,
      contacts: seed.contacts ?? [],
    } as never)
    customerIds[seed.key] = id
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, id))
  }
  await owner.customer.addNote({ customerId: customerIds.atlas!, body: "Asked to move the rent date to the 5th from January. To discuss at renewal.", visibility: "private" })
  await owner.customer.addNote({ customerId: customerIds.ana!, body: "Keys handed over on 1 December at 10:00. Meter readings to be taken on the day.", visibility: "shared" })
  console.log("Customers created")

  const content = sourceTemplate.content as Record<string, never>
  for (const seed of LEASES) {
    const prop = PROPERTIES.find((p) => p.key === seed.property)!
    const agreement = {
      customerId: customerIds[seed.customer]!,
      propertyId: propertyIds[seed.property]!,
      startDate: seed.startDate,
      endDate: null,
      termMonths: seed.termMonths,
      autoRenew: seed.autoRenew ?? false,
      charges: seed.charges ?? 0,
      additionalCosts: 0,
      discount: 0,
      deposit: seed.deposit ?? 0,
    }
    const data = await owner.lease.draftMergeData(agreement)
    const values: Partial<Record<MergeFieldKey, string>> = {
      "landlord.name": data.landlord.name,
      "landlord.representative": OWNER.name,
      "landlord.address": data.landlord.address ?? "",
      "landlord.taxId": data.landlord.taxId ?? "",
      "landlord.registrationNumber": data.landlord.registrationNumber ?? "",
      "landlord.bankName": data.landlord.bankName ?? "",
      "landlord.iban": data.landlord.iban ?? "",
      "customer.name": data.customer.name,
      "customer.email": data.customer.email,
      "customer.phone": data.customer.phone ?? "",
      "customer.address": data.customer.address ?? "",
      "property.name": prop.name,
      "property.type": prop.type,
      "property.address": prop.address,
      "property.surfaceArea": prop.surfaceArea ? `${prop.surfaceArea} m²` : "",
      "property.description": prop.description ?? "",
      "lease.startDate": longDate(seed.startDate),
      "lease.endDate": data.lease.endDate ? longDate(data.lease.endDate) : "no end date",
      "lease.length": seed.termMonths ? `${seed.termMonths} months` : "open-ended",
      "lease.renewal": seed.autoRenew ? `renews every ${seed.termMonths} months` : "does not renew",
      "lease.rent": money(prop.rent),
      "lease.charges": money(seed.charges ?? 0),
      "lease.additionalCosts": money(0),
      "lease.discount": money(0),
      "lease.monthlyTotal": money(prop.rent + (seed.charges ?? 0)),
      "lease.deposit": money(seed.deposit ?? 0),
      "lease.currency": "EUR",
      "document.date": longDate(seed.startDate < "2026-11-11" ? seed.startDate : "2026-11-10"),
    }
    const filled = {
      ...content,
      body: fillMergeFields(content.body, values),
      header: content.header && fillMergeFields(content.header, values),
      footer: content.footer && fillMergeFields(content.footer, values),
    }
    const { id: leaseId, documentId } = await owner.lease.create({
      ...agreement,
      contract: { name: `Lease agreement – ${prop.name}`, content: filled as never },
    })

    const customer = CUSTOMERS.find((c) => c.key === seed.customer)!
    if (seed.signed) {
      const portal = await clientFor(customer.email)
      await portal.portal.sign({ id: documentId, name: customer.name, image: signatures[customer.name]!, consent: true })
    }

    const invoices = await db.select().from(invoice).where(eq(invoice.leaseId, leaseId)).orderBy(asc(invoice.periodStart))
    for (const row of invoices) {
      const month = row.periodStart.slice(0, 7)
      if (seed.unpaid?.includes(month) || row.issuedOn > "2026-11-11") continue
      if (seed.proof === month) {
        const portal = await clientFor(customer.email)
        await portal.portal.submitPaymentProof({
          invoiceId: row.id,
          amount: row.total,
          paidOn: "2026-11-04",
          note: "Paid by bank transfer",
          file: new File([PROOF_PDF], "transfer-november.pdf", { type: "application/pdf" }),
        } as never)
        continue
      }
      const paidOn = new Date(`${row.issuedOn}T12:00:00Z`)
      paidOn.setUTCDate(paidOn.getUTCDate() + 3)
      await owner.invoice.addPayment({
        invoiceId: row.id,
        amount: row.total,
        paidOn: paidOn.toISOString().slice(0, 10) > "2026-11-11" ? "2026-11-11" : paidOn.toISOString().slice(0, 10),
        note: "",
      } as never)
    }
    console.log(`Lease: ${customer.name} → ${prop.name} (${invoices.length} invoices)`)
  }

  console.log(`\nDone. Sign in at ${process.env.NEXT_PUBLIC_APP_URL} as ${OWNER.email} (password in this script).`)
}

async function remove() {
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, SLUG) })
  if (!org) {
    console.log("No demo business to remove.")
    return
  }
  const scope = { organizationId: org.id }

  const documents = await db.select().from(customerDocument).where(eq(customerDocument.organizationId, org.id))
  for (const document of documents) {
    await discardDocumentContent(document)
    if (document.kind === "contract") {
      const { storage } = documentStorage(document)
      await storage.deleteObject(signedPdfKey(document)).catch(() => {})
    }
  }
  const proofs = await db
    .select({ id: paymentProof.id, leaseId: paymentProof.leaseId })
    .from(paymentProof)
    .where(eq(paymentProof.organizationId, org.id))
  for (const proof of proofs) {
    const leaseRow = await db.query.lease.findFirst({ where: (l, { eq }) => eq(l.id, proof.leaseId) })
    if (!leaseRow) continue
    const { storage, key } = paymentProofLocation({ id: proof.id, customerId: leaseRow.customerId, ...scope })
    await storage.deleteObject(key).catch(() => {})
  }
  const photos = await db.select().from(propertyPhoto).where(eq(propertyPhoto.organizationId, org.id))
  await discardPropertyPhotos(photos)

  const members = await db.select({ userId: member.userId }).from(member).where(eq(member.organizationId, org.id))
  const userIds = members.map((m) => m.userId)
  await db.delete(organization).where(eq(organization.id, org.id))
  // Only accounts that belonged to nothing else.
  if (userIds.length) {
    const elsewhere = await db
      .select({ userId: member.userId })
      .from(member)
      .where(and(inArray(member.userId, userIds), ne(member.organizationId, org.id)))
    const keep = new Set(elsewhere.map((m) => m.userId))
    const drop = userIds.filter((id) => !keep.has(id))
    if (drop.length) await db.delete(user).where(inArray(user.id, drop))
  }
  void property
  console.log("Demo business removed.")
}

const [mode, arg] = process.argv.slice(2)
const run = mode === "seed" ? seed(arg ?? "") : mode === "remove" ? remove() : Promise.reject(new Error("Use `seed <signatures.json>` or `remove`."))
run
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
