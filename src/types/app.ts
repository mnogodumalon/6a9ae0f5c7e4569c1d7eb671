import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Assets {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    name?: string;
    serial_number?: string;
    location?: GeoLocation; // { lat, long, info }
    purchased_on?: string; // Format: YYYY-MM-DD oder ISO String
    warranty_until?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export interface Teams {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    lead?: RecordUrl; // applookup -> URL zu 'Mitarbeitende' Record
    name?: string;
    cost_center?: string;
  };
}

export interface Mitarbeitende {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    active?: boolean;
    working_hours_per_week?: number;
    team?: RecordUrl; // applookup -> URL zu 'Teams' Record
  };
}

export interface Tickets {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    assigned_agent?: RecordUrl; // applookup -> URL zu 'Mitarbeitende' Record
    team?: RecordUrl; // applookup -> URL zu 'Teams' Record
    parent_ticket?: RecordUrl; // applookup -> URL zu 'Tickets' Record
    title?: string;
    description?: string;
    priority?: LookupValue;
    status?: LookupValue;
    category?: LookupValue;
    reporter_name?: string;
    reporter_email?: string;
    reporter_phone?: string;
    due?: string; // Format: YYYY-MM-DD oder ISO String
    opened_on?: string; // Format: YYYY-MM-DD oder ISO String
    tags?: LookupValue[];
    affected_asset?: RecordUrl; // applookup -> URL zu 'Assets' Record
    vendor_link?: string;
    estimated_hours?: number;
    billable?: boolean;
    resolution?: string;
    sla_breached?: boolean;
    customer_satisfaction?: LookupValue;
    attachment?: string;
    internal_note?: string;
  };
}

export interface Notizen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    ticket?: RecordUrl; // applookup -> URL zu 'Tickets' Record
    text?: string;
    author?: string;
    visible_to_reporter?: boolean;
  };
}

export const APP_IDS = {
  ASSETS: '6a9ae0d76f2d860dd77584a8',
  TEAMS: '6a9ae0dc1f2e1b30f627183a',
  MITARBEITENDE: '6a9ae0dc8d9785c8b900f7db',
  TICKETS: '6a9ae0ddcc338e60e69048d0',
  NOTIZEN: '6a9ae0ddb7e5e83aa30808fc',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'tickets': {
    priority: [{ key: "low", get label() { return lookupLabel('tickets', 'priority', "low") ?? "Niedrig"; } }, { key: "medium", get label() { return lookupLabel('tickets', 'priority', "medium") ?? "Mittel"; } }, { key: "high", get label() { return lookupLabel('tickets', 'priority', "high") ?? "Hoch"; } }, { key: "critical", get label() { return lookupLabel('tickets', 'priority', "critical") ?? "Kritisch"; } }],
    status: [{ key: "closed", get label() { return lookupLabel('tickets', 'status', "closed") ?? "Geschlossen"; } }, { key: "new", get label() { return lookupLabel('tickets', 'status', "new") ?? "Neu"; } }, { key: "in_progress", get label() { return lookupLabel('tickets', 'status', "in_progress") ?? "In Bearbeitung"; } }, { key: "waiting_for_customer", get label() { return lookupLabel('tickets', 'status', "waiting_for_customer") ?? "Wartet auf Kunde"; } }, { key: "resolved", get label() { return lookupLabel('tickets', 'status', "resolved") ?? "Gelöst"; } }],
    category: [{ key: "hardware", get label() { return lookupLabel('tickets', 'category', "hardware") ?? "Hardware"; } }, { key: "software", get label() { return lookupLabel('tickets', 'category', "software") ?? "Software"; } }, { key: "network", get label() { return lookupLabel('tickets', 'category', "network") ?? "Netzwerk"; } }, { key: "access", get label() { return lookupLabel('tickets', 'category', "access") ?? "Zugang"; } }, { key: "printing", get label() { return lookupLabel('tickets', 'category', "printing") ?? "Drucken"; } }, { key: "phone", get label() { return lookupLabel('tickets', 'category', "phone") ?? "Telefon"; } }, { key: "other", get label() { return lookupLabel('tickets', 'category', "other") ?? "Sonstiges"; } }],
    tags: [{ key: "vip", get label() { return lookupLabel('tickets', 'tags', "vip") ?? "VIP"; } }, { key: "recurring", get label() { return lookupLabel('tickets', 'tags', "recurring") ?? "Wiederkehrend"; } }, { key: "security", get label() { return lookupLabel('tickets', 'tags', "security") ?? "Sicherheit"; } }, { key: "vendor", get label() { return lookupLabel('tickets', 'tags', "vendor") ?? "Lieferant"; } }],
    customer_satisfaction: [{ key: "option_1", get label() { return lookupLabel('tickets', 'customer_satisfaction', "option_1") ?? "1"; } }, { key: "option_2", get label() { return lookupLabel('tickets', 'customer_satisfaction', "option_2") ?? "2"; } }, { key: "option_3", get label() { return lookupLabel('tickets', 'customer_satisfaction', "option_3") ?? "3"; } }, { key: "option_4", get label() { return lookupLabel('tickets', 'customer_satisfaction', "option_4") ?? "4"; } }, { key: "option_5", get label() { return lookupLabel('tickets', 'customer_satisfaction', "option_5") ?? "5"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'assets': {
    'name': 'string/text',
    'serial_number': 'string/text',
    'location': 'geo',
    'purchased_on': 'date/date',
    'warranty_until': 'date/date',
  },
  'teams': {
    'lead': 'applookup/select',
    'name': 'string/text',
    'cost_center': 'string/text',
  },
  'mitarbeitende': {
    'first_name': 'string/text',
    'last_name': 'string/text',
    'email': 'string/email',
    'phone': 'string/tel',
    'active': 'bool',
    'working_hours_per_week': 'number',
    'team': 'applookup/select',
  },
  'tickets': {
    'assigned_agent': 'applookup/select',
    'team': 'applookup/select',
    'parent_ticket': 'applookup/select',
    'title': 'string/text',
    'description': 'string/textarea',
    'priority': 'lookup/select',
    'status': 'lookup/select',
    'category': 'lookup/select',
    'reporter_name': 'string/text',
    'reporter_email': 'string/email',
    'reporter_phone': 'string/tel',
    'due': 'date/datetimeminute',
    'opened_on': 'date/date',
    'tags': 'multiplelookup/checkbox',
    'affected_asset': 'applookup/select',
    'vendor_link': 'string/url',
    'estimated_hours': 'number',
    'billable': 'bool',
    'resolution': 'string/textarea',
    'sla_breached': 'bool',
    'customer_satisfaction': 'lookup/radio',
    'attachment': 'file',
    'internal_note': 'string/textarea',
  },
  'notizen': {
    'ticket': 'applookup/select',
    'text': 'string/textarea',
    'author': 'string/text',
    'visible_to_reporter': 'bool',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateAssets = StripLookup<Assets['fields']>;
export type CreateTeams = StripLookup<Teams['fields']>;
export type CreateMitarbeitende = StripLookup<Mitarbeitende['fields']>;
export type CreateTickets = StripLookup<Tickets['fields']>;
export type CreateNotizen = StripLookup<Notizen['fields']>;