import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{ row: ['first_name', 'last_name'] }, 'email', 'phone', 'active', 'working_hours_per_week', 'team'],
  defaults: {
    'active': { kind: 'literal', value: true },
    'working_hours_per_week': { kind: 'literal', value: 40 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
