/**
 * Required-field messages — WRITTEN BY THE BUILD AGENT, never by a heuristic.
 *
 * The layer knows two things about an empty required field: that it is
 * required and what its label is. Out of that it can only say „„Anreise" ist
 * ein Pflichtfeld". What the person should do instead („Bitte einen Gast
 * auswählen.") is meaning, and meaning is the agent's: the Phase-2 orchestrator
 * writes one short instruction per required field — what is needed, not why — to
 * `.intents-staging/messages.json`, the integration step validates it against
 * the app metadata and renders it into the block below. Scaffold updates keep
 * the block. Do not edit outside the markers.
 *
 * Every door reads this and nothing else: `useStepForm` (flows and public
 * pages), the generated {Entity}Dialog and the public form's server-error line.
 * A field without a sentence falls back to the label sentence — never to a
 * bare „Dieses Feld ist erforderlich".
 *
 * Required fields per entity (from the base view):
 *   - assets: name (Name), serial_number (Seriennummer)
 *   - teams: name (Name)
 *   - mitarbeitende: first_name (Vorname), last_name (Nachname), email (E-Mail)
 *   - tickets: title (Titel), priority (Priorität), status (Status), reporter_name (Name der meldenden Person), reporter_email (E-Mail der meldenden Person), due (Fällig am), opened_on (Eröffnet am), estimated_hours (Geschätzte Stunden)
 *   - notizen: no required field
 */
import { t, tx } from '@/i18n';
import { labelOf, type EntityKey } from './rules';

/** The writable fields of each entity — the keys a message may address (generated). */
export interface MessageFields {
  "assets": "name" | "serial_number" | "location" | "purchased_on" | "warranty_until";
  "teams": "lead" | "name" | "cost_center";
  "mitarbeitende": "first_name" | "last_name" | "email" | "phone" | "active" | "working_hours_per_week" | "team";
  "tickets": "assigned_agent" | "team" | "parent_ticket" | "title" | "description" | "priority" | "status" | "category" | "reporter_name" | "reporter_email" | "reporter_phone" | "due" | "opened_on" | "tags" | "affected_asset" | "vendor_link" | "estimated_hours" | "billable" | "resolution" | "sla_breached" | "customer_satisfaction" | "internal_note";
  "notizen": "ticket" | "text" | "author" | "visible_to_reporter";
}
export type MessageFieldKey<E extends EntityKey> = E extends keyof MessageFields ? MessageFields[E] : never;

export const REQUIRED_MESSAGES: { [E in EntityKey]?: Partial<Record<MessageFieldKey<E>, string>> } = {
  // <custom:messages>
  teams: { name: "Bitte den Teamnamen eingeben." },
  mitarbeitende: { first_name: "Bitte den Vornamen eingeben.", last_name: "Bitte den Nachnamen eingeben.", email: "Bitte die E-Mail-Adresse eingeben." },
  tickets: { title: "Bitte einen Titel für das Ticket eingeben.", priority: "Bitte eine Priorität auswählen.", status: "Bitte einen Status auswählen.", reporter_name: "Bitte den Namen der meldenden Person eingeben.", reporter_email: "Bitte die E-Mail der meldenden Person eingeben.", due: "Bitte Fälligkeitsdatum und -uhrzeit festlegen.", opened_on: "Bitte das Eröffnungsdatum eingeben.", estimated_hours: "Bitte die geschätzten Stunden eingeben." },
  assets: { name: "Bitte den Asset-Namen eingeben.", serial_number: "Bitte die Seriennummer eingeben." },
  // </custom:messages>
};

/** The sentence shown when `key` of `entity` is required and empty — the
 *  agent's own text (translated at runtime like every page string), else the
 *  label sentence. Call it while rendering, not at module scope. */
export function requiredMessage(entity: EntityKey, key: string): string {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  if (own && own.trim()) return tx(own);
  return t('v_required', { label: labelOf(entity, key) });
}

/** True when the agent wrote a sentence for the field. */
export function hasOwnMessage(entity: EntityKey, key: string): boolean {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  return Boolean(own && own.trim());
}
