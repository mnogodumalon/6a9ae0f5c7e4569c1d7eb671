/**
 * Field rules — GENERATED from the app metadata. Do not edit.
 *
 * The mechanical truth about every field: what kind it is, whether the
 * platform's base view marks it required, which lookup keys exist, where an
 * applookup points, what the label is. `useStepForm` validates against these
 * rules and phrases its messages with the real labels; `toWirePayload` uses
 * them to shape the create payload; `SHAPES` tells a page which input FORM
 * fits the data (a date pair wants a calendar, not two fields) — it is a
 * signal, not a gate.
 */
import { appLabel, fieldLabel, lookupLabel } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';

export type EntityKey = 'assets' | 'teams' | 'mitarbeitende' | 'tickets' | 'notizen';

/** The text fields of each entity — what a search may run over (generated;
 *  `never` for an entity without text of its own, e.g. a link table). */
export interface StringFields {
  "assets": "name" | "serial_number";
  "teams": "name" | "cost_center";
  "mitarbeitende": "first_name" | "last_name" | "email" | "phone";
  "tickets": "title" | "description" | "reporter_name" | "reporter_email" | "reporter_phone" | "vendor_link" | "resolution" | "internal_note";
  "notizen": "text" | "author";
}
export type StringFieldKey<E extends EntityKey> = E extends keyof StringFields ? StringFields[E] : never;

/** The applookup fields of each entity (generated). A pick stored through
 *  `form.set` on one of these must carry its display name — at compile time
 *  (`StepForm.set`), because the review would otherwise show the id. */
export interface RecordFields {
  "assets": never;
  "teams": "lead";
  "mitarbeitende": "team";
  "tickets": "assigned_agent" | "team" | "parent_ticket" | "affected_asset";
  "notizen": "ticket";
}
export type RecordFieldKey<E extends EntityKey> = E extends keyof RecordFields ? RecordFields[E] : never;

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'lookup'
  | 'multilookup'
  | 'record'
  | 'multirecord'
  | 'file'
  | 'geo';

export interface FieldRule {
  key: string;
  fulltype: string;
  kind: FieldKind;
  /** From the app's base view. A public page may override this per field. */
  required: boolean;
  /** Build-time label — `labelOf()` prefers the runtime i18n bundle. */
  label: string;
  /** Whether a journey may write it (`file` is upload-only, never via a journey). */
  writable: boolean;
  maxLength?: number;
  /** lookup / multilookup: the ONLY valid write values. */
  options?: string[];
  /** record / multirecord: the target app (always) and its entity key (when inside this appgroup). */
  targetAppId?: string;
  targetEntity?: EntityKey;
  format?: 'currency';
  /** HTML autocomplete token derived from the field name (given-name, email, tel, …). */
  autoComplete?: string;
}

export interface EntityInfo {
  key: EntityKey;
  appId: string;
  label: string;
  /** PascalCase plural — `get<pascal>()` on the service. */
  pascal: string;
  /** The single-record suffix — `create<single>()` on the service. */
  single: string;
}

/** Input-form signals per entity: which data shape each field (pair) has.
 *  `range`  — two date fields that form a stay/period → AvailabilityRangePicker
 *  `choice` — a lookup with few options → ChoiceGroup pills instead of a select
 *  `record` — an applookup → EntitySelectStep with search, never a raw id field
 *  `stock`  — a quantity that has a stock/capacity counterpart → show it, warn on overshoot */
export type Shape =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'choice'; field: string; count: number }
  | { kind: 'record'; field: string; targetEntity?: EntityKey }
  | { kind: 'stock'; field: string };

export const ENTITIES: Record<EntityKey, EntityInfo> = {
  "assets": {
    "key": "assets",
    "appId": "6a9ae0d76f2d860dd77584a8",
    "label": "Assets",
    "pascal": "Assets",
    "single": "Asset"
  },
  "teams": {
    "key": "teams",
    "appId": "6a9ae0dc1f2e1b30f627183a",
    "label": "Teams",
    "pascal": "Teams",
    "single": "Team"
  },
  "mitarbeitende": {
    "key": "mitarbeitende",
    "appId": "6a9ae0dc8d9785c8b900f7db",
    "label": "Mitarbeitende",
    "pascal": "Mitarbeitende",
    "single": "MitarbeitendeEntry"
  },
  "tickets": {
    "key": "tickets",
    "appId": "6a9ae0ddcc338e60e69048d0",
    "label": "Tickets",
    "pascal": "Tickets",
    "single": "Ticket"
  },
  "notizen": {
    "key": "notizen",
    "appId": "6a9ae0ddb7e5e83aa30808fc",
    "label": "Notizen",
    "pascal": "Notizen",
    "single": "NotizenEntry"
  }
};

export const FIELD_RULES: Record<EntityKey, Record<string, FieldRule>> = {
  "assets": {
    "name": {
      "key": "name",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Name",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "name"
    },
    "serial_number": {
      "key": "serial_number",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Seriennummer",
      "writable": true,
      "maxLength": 4000
    },
    "location": {
      "key": "location",
      "fulltype": "geo",
      "kind": "geo",
      "required": false,
      "label": "Standort",
      "writable": true
    },
    "purchased_on": {
      "key": "purchased_on",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Angeschafft am",
      "writable": true
    },
    "warranty_until": {
      "key": "warranty_until",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Garantie bis",
      "writable": true
    }
  },
  "teams": {
    "lead": {
      "key": "lead",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Teamleitung",
      "writable": true,
      "targetAppId": "6a9ae0dc8d9785c8b900f7db",
      "targetEntity": "mitarbeitende"
    },
    "name": {
      "key": "name",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Name",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "name"
    },
    "cost_center": {
      "key": "cost_center",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Kostenstelle",
      "writable": true,
      "maxLength": 4000
    }
  },
  "mitarbeitende": {
    "first_name": {
      "key": "first_name",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "last_name": {
      "key": "last_name",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": true,
      "label": "E-Mail",
      "writable": true,
      "autoComplete": "email"
    },
    "phone": {
      "key": "phone",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefon",
      "writable": true,
      "autoComplete": "tel"
    },
    "active": {
      "key": "active",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "Aktiv",
      "writable": true
    },
    "working_hours_per_week": {
      "key": "working_hours_per_week",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Arbeitsstunden pro Woche",
      "writable": true
    },
    "team": {
      "key": "team",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Team",
      "writable": true,
      "targetAppId": "6a9ae0dc1f2e1b30f627183a",
      "targetEntity": "teams"
    }
  },
  "tickets": {
    "assigned_agent": {
      "key": "assigned_agent",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Zugewiesene/r Mitarbeitende/r",
      "writable": true,
      "targetAppId": "6a9ae0dc8d9785c8b900f7db",
      "targetEntity": "mitarbeitende"
    },
    "team": {
      "key": "team",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Team",
      "writable": true,
      "targetAppId": "6a9ae0dc1f2e1b30f627183a",
      "targetEntity": "teams"
    },
    "parent_ticket": {
      "key": "parent_ticket",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Übergeordnetes Ticket",
      "writable": true,
      "targetAppId": "6a9ae0ddcc338e60e69048d0",
      "targetEntity": "tickets"
    },
    "title": {
      "key": "title",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Titel",
      "writable": true,
      "maxLength": 4000
    },
    "description": {
      "key": "description",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Beschreibung",
      "writable": true
    },
    "priority": {
      "key": "priority",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Priorität",
      "writable": true,
      "options": [
        "low",
        "medium",
        "high",
        "critical"
      ]
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "closed",
        "new",
        "in_progress",
        "waiting_for_customer",
        "resolved"
      ]
    },
    "category": {
      "key": "category",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": false,
      "label": "Kategorie",
      "writable": true,
      "options": [
        "hardware",
        "software",
        "network",
        "access",
        "printing",
        "phone",
        "other"
      ]
    },
    "reporter_name": {
      "key": "reporter_name",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Name der meldenden Person",
      "writable": true,
      "maxLength": 4000
    },
    "reporter_email": {
      "key": "reporter_email",
      "fulltype": "string/email",
      "kind": "email",
      "required": true,
      "label": "E-Mail der meldenden Person",
      "writable": true,
      "autoComplete": "email"
    },
    "reporter_phone": {
      "key": "reporter_phone",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefon der meldenden Person",
      "writable": true,
      "autoComplete": "tel"
    },
    "due": {
      "key": "due",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Fällig am",
      "writable": true
    },
    "opened_on": {
      "key": "opened_on",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Eröffnet am",
      "writable": true
    },
    "tags": {
      "key": "tags",
      "fulltype": "multiplelookup/checkbox",
      "kind": "multilookup",
      "required": false,
      "label": "Tags",
      "writable": true,
      "options": [
        "vip",
        "recurring",
        "security",
        "vendor"
      ]
    },
    "affected_asset": {
      "key": "affected_asset",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Betroffenes Asset",
      "writable": true,
      "targetAppId": "6a9ae0d76f2d860dd77584a8",
      "targetEntity": "assets"
    },
    "vendor_link": {
      "key": "vendor_link",
      "fulltype": "string/url",
      "kind": "url",
      "required": false,
      "label": "Lieferanten-Link",
      "writable": true,
      "autoComplete": "url"
    },
    "estimated_hours": {
      "key": "estimated_hours",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Geschätzte Stunden",
      "writable": true
    },
    "billable": {
      "key": "billable",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "Abrechenbar",
      "writable": true
    },
    "resolution": {
      "key": "resolution",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Lösung",
      "writable": true
    },
    "sla_breached": {
      "key": "sla_breached",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "SLA verletzt",
      "writable": true
    },
    "customer_satisfaction": {
      "key": "customer_satisfaction",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": false,
      "label": "Kundenzufriedenheit",
      "writable": true,
      "options": [
        "option_1",
        "option_2",
        "option_3",
        "option_4",
        "option_5"
      ]
    },
    "attachment": {
      "key": "attachment",
      "fulltype": "file",
      "kind": "file",
      "required": false,
      "label": "Anhang",
      "writable": false
    },
    "internal_note": {
      "key": "internal_note",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Interne Notiz",
      "writable": true
    }
  },
  "notizen": {
    "ticket": {
      "key": "ticket",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Ticket",
      "writable": true,
      "targetAppId": "6a9ae0ddcc338e60e69048d0",
      "targetEntity": "tickets"
    },
    "text": {
      "key": "text",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Text",
      "writable": true
    },
    "author": {
      "key": "author",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Verfasser/in",
      "writable": true,
      "maxLength": 4000
    },
    "visible_to_reporter": {
      "key": "visible_to_reporter",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "Für meldende Person sichtbar",
      "writable": true
    }
  }
};

export const SHAPES: Record<EntityKey, Shape[]> = {
  "assets": [],
  "teams": [
    {
      "kind": "record",
      "field": "lead",
      "targetEntity": "mitarbeitende"
    }
  ],
  "mitarbeitende": [
    {
      "kind": "record",
      "field": "team",
      "targetEntity": "teams"
    }
  ],
  "tickets": [
    {
      "kind": "choice",
      "field": "priority",
      "count": 4
    },
    {
      "kind": "choice",
      "field": "status",
      "count": 5
    },
    {
      "kind": "choice",
      "field": "customer_satisfaction",
      "count": 5
    },
    {
      "kind": "record",
      "field": "assigned_agent",
      "targetEntity": "mitarbeitende"
    },
    {
      "kind": "record",
      "field": "team",
      "targetEntity": "teams"
    },
    {
      "kind": "record",
      "field": "parent_ticket",
      "targetEntity": "tickets"
    },
    {
      "kind": "record",
      "field": "affected_asset",
      "targetEntity": "assets"
    }
  ],
  "notizen": [
    {
      "kind": "record",
      "field": "ticket",
      "targetEntity": "tickets"
    }
  ]
};

/** The fields a record of this entity is recognised by (a person: first and
 *  last name; else its title-like text field) — the same choice the dashboard's
 *  enrichment makes for `<key>Name`. `useRecordSearch` resolves an applookup to
 *  this name (`ctx.ref('gast')` in `toItem`). */
export const DISPLAY_FIELDS: Record<EntityKey, string[]> = {
  "assets": [
    "name"
  ],
  "teams": [
    "name"
  ],
  "mitarbeitende": [
    "first_name",
    "last_name"
  ],
  "tickets": [
    "title"
  ],
  "notizen": [
    "author"
  ]
};

/** The display name of a record: its display fields joined, else the first
 *  non-empty text value, else ''. */
export function displayNameOf(entity: EntityKey, fields: Record<string, unknown>): string {
  const parts = (DISPLAY_FIELDS[entity] ?? [])
    .map(k => fields[k])
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map(v => v.trim());
  if (parts.length > 0) return parts.join(' ');
  for (const [k, rule] of Object.entries(FIELD_RULES[entity] ?? {})) {
    if (rule.kind !== 'text' && rule.kind !== 'email') continue;
    const v = fields[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

export function ruleOf(entity: EntityKey, key: string): FieldRule | undefined {
  return FIELD_RULES[entity]?.[key];
}

/** The field label as the user sees it — runtime bundle first, generated label second. */
export function labelOf(entity: EntityKey, key: string): string {
  const fromBundle = fieldLabel(entity, key);
  if (fromBundle !== key) return fromBundle;
  return ruleOf(entity, key)?.label ?? key;
}

export function entityLabel(entity: EntityKey): string {
  const fromBundle = appLabel(entity);
  if (fromBundle !== entity) return fromBundle;
  return ENTITIES[entity]?.label ?? entity;
}

/** Lookup options with runtime labels — the only legitimate source of `{key,label}` pairs. */
export function optionsOf(entity: EntityKey, key: string): Array<{ key: string; label: string }> {
  const generated = (LOOKUP_OPTIONS as Record<string, Record<string, Array<{ key: string; label: string }>>>)[entity]?.[key];
  if (generated && generated.length) return generated.map(o => ({ key: o.key, label: o.label }));
  const keys = ruleOf(entity, key)?.options ?? [];
  return keys.map(k => ({ key: k, label: lookupLabel(entity, key, k) ?? k }));
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object)) {
    const r = v as { from: unknown; to: unknown };
    return isEmptyValue(r.from) && isEmptyValue(r.to);
  }
  return false;
}
