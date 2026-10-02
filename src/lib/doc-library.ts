// Starter documents for the SyncSign document builder.
// Wording is a general starting point only — users should adapt it and seek legal advice for their jurisdiction.
import type { Block, DocContent, DocRole } from "./doc-model";
import { DEFAULT_BRANDING } from "./doc-model";

let n = 0;
const id = () => `b${(++n).toString(36)}`;
const h = (text: string): Block => ({ id: id(), type: "heading", text, align: "center" });
const s = (text: string): Block => ({ id: id(), type: "subheading", text });
const p = (text: string): Block => ({ id: id(), type: "paragraph", text });
const ul = (...items: string[]): Block => ({ id: id(), type: "bullets", items });
const ol = (...items: string[]): Block => ({ id: id(), type: "numbered", items });
const table = (...rows: string[][]): Block => ({ id: id(), type: "table", rows });
const facts = (...rows: string[][]): Block => ({ id: id(), type: "table", rows, header: false });
const note = (text: string): Block => ({ id: id(), type: "note", text });
const hr = (): Block => ({ id: id(), type: "divider" });
const sig = (roleId: string): Block => ({ id: id(), type: "signature", roleId });

const role = (rid: string, name: string, order: number, color: string, r: DocRole["role"] = "signer"): DocRole => ({ id: rid, name, order, color, role: r });
const A = (name: string) => role("r1", name, 1, "#0ea5e9");
const B = (name: string) => role("r2", name, 2, "#8b5cf6");

export interface Starter {
  key: string;
  name: string;
  category: "Legal" | "HR" | "Sales" | "Property" | "General";
  description: string;
  build: () => DocContent;
}

const doc = (blocks: Block[], roles: DocRole[], labels: Record<string, string> = {}): DocContent =>
  ({ blocks, roles, branding: { ...DEFAULT_BRANDING }, variableLabels: labels });

export const STARTERS: Starter[] = [
  {
    key: "blank", name: "Blank document", category: "General", description: "Start from an empty page with a title and one signer.",
    build: () => doc([h("Untitled document"), p("Start writing here. Type {{variable_name}} to create a fill-in field."), sig("r1")], [A("Signer")]),
  },
  {
    key: "nda", name: "Mutual NDA", category: "Legal", description: "Two-way confidentiality agreement for early business discussions.",
    build: () => doc([
      h("Mutual Non-Disclosure Agreement"),
      p("This Mutual Non-Disclosure Agreement (the **Agreement**) is entered into on {{today}} between **{{party_a_name}}**, of {{party_a_address}} and **{{party_b_name}}**, of {{party_b_address}} (each a **Party**, together the **Parties**)."),
      s("1. Purpose"),
      p("The Parties wish to explore {{purpose}} (the **Purpose**) and may disclose confidential information to each other for that Purpose only."),
      s("2. Confidential information"),
      p("**Confidential Information** means any non-public business, technical, financial or personal information disclosed by one Party to the other, in any form, that is marked confidential or would reasonably be understood to be confidential."),
      s("3. Obligations"),
      ol("Use Confidential Information only for the Purpose.",
        "Not disclose it to anyone other than employees and advisers who need to know it and are bound by similar obligations.",
        "Protect it with at least the same care used for its own confidential information, and no less than reasonable care.",
        "Return or destroy it promptly when asked."),
      s("4. Exclusions"),
      p("These obligations do not apply to information that is or becomes public through no fault of the receiving Party, was already lawfully known to it, is independently developed, or must be disclosed by law (with prompt notice where permitted)."),
      s("5. Term"),
      p("This Agreement lasts for {{term_years}} years from the date above. Obligations for information disclosed during the term survive for the same period after it ends."),
      s("6. General"),
      p("Nothing in this Agreement grants any licence or obliges either Party to proceed with any transaction. This Agreement is governed by the laws of {{governing_law}}."),
      hr(), sig("r1"), sig("r2"),
    ], [A("Party A"), B("Party B")], { term_years: "Term (years)", governing_law: "Governing law (country)" }),
  },
  {
    key: "service", name: "Service Agreement", category: "Sales", description: "Scope, fees and terms for delivering services to a client.",
    build: () => doc([
      h("Service Agreement"),
      p("This Service Agreement is made on {{today}} between **{{provider_name}}** (the **Provider**) and **{{client_name}}** (the **Client**)."),
      s("1. Services"),
      p("The Provider will deliver the following services (the **Services**):"),
      ul("{{service_1}}", "{{service_2}}", "{{service_3}}"),
      s("2. Timeline"),
      p("Work begins on {{start_date}} and is expected to be completed by {{end_date}}, subject to timely input from the Client."),
      s("3. Fees and payment"),
      table(["Item", "Amount"], ["Service fee", "{{fee_amount}}"], ["Deposit due on signing", "{{deposit_amount}}"], ["Payment terms", "{{payment_terms}}"]),
      p("Invoices are payable within the stated terms. Late amounts may attract reasonable interest as permitted by law."),
      s("4. Client responsibilities"),
      p("The Client will provide access, information and approvals reasonably needed for the Provider to perform the Services."),
      s("5. Intellectual property"),
      p("On full payment, the Client owns the final deliverables created specifically for it. The Provider keeps ownership of its pre-existing tools, know-how and materials."),
      s("6. Termination"),
      p("Either party may terminate with {{notice_days}} days' written notice. The Client will pay for Services performed up to the termination date."),
      s("7. Liability"),
      p("Each party's total liability under this Agreement is limited to the fees paid in the twelve months before the claim, except where the law does not allow such a limit."),
      hr(), sig("r1"), sig("r2"),
    ], [A("Provider"), B("Client")]),
  },
  {
    key: "offer", name: "Employment Offer Letter", category: "HR", description: "Formal job offer with role, salary, start date and acceptance.",
    build: () => doc([
      h("Offer of Employment"),
      p("{{today}}"),
      p("Dear {{candidate_name}},"),
      p("We are pleased to offer you the position of **{{job_title}}** at **{{company_name}}**, reporting to {{manager_name}}. This letter summarises the main terms of our offer."),
      table(["Term", "Detail"], ["Start date", "{{start_date}}"], ["Location", "{{work_location}}"], ["Employment type", "{{employment_type}}"], ["Gross salary", "{{salary}}"], ["Probation period", "{{probation_period}}"], ["Annual leave", "{{leave_days}} days"]),
      s("Conditions"),
      ul("Satisfactory reference and background checks.", "Proof of your right to work in {{country}}.", "Signing our standard employment contract and policies."),
      p("To accept, please sign below by **{{accept_by}}**. We look forward to welcoming you to the team."),
      p("Kind regards,"),
      sig("r1"), sig("r2"),
    ], [A("Company representative"), B("Candidate")]),
  },
  {
    key: "contractor", name: "Independent Contractor Agreement", category: "HR", description: "Engage a freelancer or consultant on a project basis.",
    build: () => doc([
      h("Independent Contractor Agreement"),
      p("Made on {{today}} between **{{company_name}}** (the **Company**) and **{{contractor_name}}** (the **Contractor**)."),
      s("1. Engagement"),
      p("The Company engages the Contractor to provide {{services_description}} from {{start_date}} until {{end_date}}, unless ended earlier under this Agreement."),
      s("2. Fees"),
      p("The Company will pay the Contractor {{rate}} against valid invoices, within {{payment_days}} days of receipt."),
      s("3. Independent status"),
      p("The Contractor is an independent business, not an employee. The Contractor is responsible for their own taxes, insurance and equipment, and controls how the work is performed."),
      s("4. Confidentiality and IP"),
      p("The Contractor will keep Company information confidential. Work product created for the Company under this Agreement belongs to the Company once paid for."),
      s("5. Termination"),
      p("Either party may end this Agreement with {{notice_days}} days' written notice, or immediately for material breach."),
      hr(), sig("r1"), sig("r2"),
    ], [A("Company"), B("Contractor")]),
  },
  {
    key: "lease", name: "Residential Lease Agreement", category: "Property", description: "Rental terms between a landlord and tenant.",
    build: () => doc([
      h("Residential Lease Agreement"),
      p("This Lease is made on {{today}} between **{{landlord_name}}** (the **Landlord**) and **{{tenant_name}}** (the **Tenant**) for the property at **{{property_address}}** (the **Property**)."),
      table(["Term", "Detail"], ["Lease start", "{{lease_start}}"], ["Lease end", "{{lease_end}}"], ["Monthly rent", "{{monthly_rent}}"], ["Rent due", "{{rent_due_day}} of each month"], ["Security deposit", "{{deposit}}"]),
      s("Tenant obligations"),
      ol("Pay rent on time and in full.", "Keep the Property clean and in good condition, fair wear and tear excepted.",
        "Not sublet or make alterations without the Landlord's written consent.", "Report damage or needed repairs promptly."),
      s("Landlord obligations"),
      ol("Provide the Property in a safe, habitable condition.", "Carry out structural and major repairs within a reasonable time.", "Give reasonable notice before entering the Property, except in emergencies."),
      s("Deposit"),
      p("The deposit will be returned within {{deposit_return_days}} days after the lease ends, less any amounts properly deducted for unpaid rent or damage beyond fair wear and tear."),
      note("Check local tenancy law: notice periods, deposit rules and required disclosures differ by country."),
      hr(), sig("r1"), sig("r2"),
    ], [A("Landlord"), B("Tenant")]),
  },
  {
    key: "mou", name: "Memorandum of Understanding", category: "General", description: "Non-binding statement of intent between partner organisations.",
    build: () => doc([
      h("Memorandum of Understanding"),
      p("This Memorandum of Understanding (**MOU**) is entered into on {{today}} between **{{org_a}}** and **{{org_b}}**."),
      s("1. Background"),
      p("{{background}}"),
      s("2. Objectives"),
      ul("{{objective_1}}", "{{objective_2}}", "{{objective_3}}"),
      s("3. Roles and responsibilities"),
      table(["Organisation", "Responsibilities"], ["{{org_a}}", "{{org_a_responsibilities}}"], ["{{org_b}}", "{{org_b_responsibilities}}"]),
      s("4. Duration"),
      p("This MOU takes effect on signing and remains in place for {{duration}}, unless ended earlier by either party with written notice."),
      s("5. Non-binding nature"),
      p("This MOU records the parties' shared intentions. It does not create legally binding obligations, except for confidentiality, which both parties agree to respect."),
      hr(), sig("r1"), sig("r2"),
    ], [A("Organisation A"), B("Organisation B")]),
  },
  {
    key: "quote", name: "Quotation Acceptance", category: "Sales", description: "Let a customer approve a quote and confirm the order.",
    build: () => doc([
      h("Quotation & Order Acceptance"),
      facts(["Quote reference", "{{quote_number}}"], ["Date", "{{today}}"], ["Customer", "{{customer_name}}"], ["Valid until", "{{valid_until}}"]),
      s("Items"),
      table(["Description", "Qty", "Unit price", "Total"], ["{{item_1}}", "{{qty_1}}", "{{price_1}}", "{{total_1}}"], ["{{item_2}}", "{{qty_2}}", "{{price_2}}", "{{total_2}}"], ["", "", "**Grand total**", "**{{grand_total}}**"]),
      s("Terms"),
      ul("Prices are {{tax_note}}.", "Delivery within {{delivery_time}} of order confirmation.", "Payment terms: {{payment_terms}}."),
      p("By signing below, the Customer accepts this quotation and places an order on the terms above."),
      sig("r1"),
    ], [A("Customer")]),
  },
  {
    key: "consent", name: "Media Consent & Release", category: "General", description: "Permission to use a person's photo, video or testimonial.",
    build: () => doc([
      h("Media Consent & Release Form"),
      p("I, **{{participant_name}}**, give **{{organisation_name}}** permission to photograph, film and record me at {{event_or_purpose}} and to use those recordings as described below."),
      s("Permitted uses"),
      ul("Websites and social media channels", "Printed and digital marketing materials", "Internal training and reports"),
      s("My understanding"),
      ol("I will not receive payment for this use.", "I may withdraw consent for future use by writing to {{contact_email}}; material already published may remain.", "My personal data will be handled in line with the organisation's privacy policy."),
      sig("r1"),
    ], [A("Participant")]),
  },
];

export function starterByKey(key: string) {
  return STARTERS.find((s) => s.key === key);
}
