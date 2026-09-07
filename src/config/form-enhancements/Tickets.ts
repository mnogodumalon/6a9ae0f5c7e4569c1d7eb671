import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'title',
    'description',
    'category',
    'priority',
    'status',
    'reporter_name',
    'reporter_email',
    'reporter_phone',
    'assigned_agent',
    'team',
    'affected_asset',
    'estimated_hours',
    'opened_on',
    'due',
    'tags',
    'vendor_link',
    'resolution',
    'billable',
    'sla_breached',
    'customer_satisfaction',
    'parent_ticket',
    'internal_note'
  ],
  defaults: {
    'opened_on': { kind: 'today' },
    'due': { kind: 'todayOffset', days: 1, withTime: true },
    'status': { kind: 'lookup', key: 'new', label: 'Neu' },
    'priority': { kind: 'lookup', key: 'medium', label: 'Mittel' },
    'estimated_hours': { kind: 'literal', value: 1 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
