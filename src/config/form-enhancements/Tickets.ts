import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'title',
    'reporter_name',
    'reporter_email',
    'reporter_phone',
    'description',
    'category',
    'priority',
    'status',
    'assigned_agent',
    'team',
    'parent_ticket',
    'affected_asset',
    'estimated_hours',
    'billable',
    { row: ['opened_on', 'due'] },
    'tags',
    'vendor_link',
    'resolution',
    'sla_breached',
    'customer_satisfaction',
    'internal_note',
  ],
  defaults: {
    'opened_on': { kind: 'today' },
    'due': { kind: 'todayOffset', days: 3, withTime: true },
    'priority': { kind: 'lookup', key: 'medium', label: 'Mittel' },
    'status': { kind: 'lookup', key: 'new', label: 'Neu' },
    'estimated_hours': { kind: 'literal', value: 1 },
    'billable': { kind: 'literal', value: false },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
