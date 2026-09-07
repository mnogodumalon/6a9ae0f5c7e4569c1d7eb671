/**
 * TicketsDialog — pre-generated create/edit dialog for Tickets.
 *
 * Props: open, onClose, onSubmit(fields) => Promise<void>, defaultValues?,
 * recordId? (pass when EDITING — enables the attachments section),
 * mitarbeitendeList (full hook array — resolves the Mitarbeitende applookup),
 * teamsList (full hook array — resolves the Teams applookup),
 * ticketsList (full hook array — resolves the Tickets applookup),
 * assetsList (full hook array — resolves the Assets applookup),
 * enablePhotoScan?, enablePhotoLocation?.
 *
 * defaultValues is SHAPE-TOLERANT and its prop type is the EXPORTED
 * TicketsDialogDefaults — NOT the entity field type: lookup fields accept
 * the bare KEY string (or LookupValue), applookup fields the bare record id
 * (or record URL); the dialog normalizes. Type prefill STATE with the export:
 *  ❌ useState<Partial<Tickets['fields']>>({ … })   // LookupValue fields reject string prefills (TS2322)
 *  ✓ useState<TicketsDialogDefaults | undefined>(undefined)
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Tickets, Mitarbeitende, Teams, Assets, LookupValue } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, uploadFile, getUserProfile, LivingAppsService } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Tickets';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { requiredMessage } from '@/lib/journey/messages';
import { t, appLabel, fieldLabel, lookupLabel, localeTag, CURRENCY } from '@/i18n';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/Combobox';
import { MitarbeitendeDialog } from '@/components/dialogs/MitarbeitendeDialog';
import { TeamsDialog } from '@/components/dialogs/TeamsDialog';
import { AssetsDialog } from '@/components/dialogs/AssetsDialog';
import { DatePicker } from '@/components/DatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { IconAlertCircle, IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode, dataUriToBlob } from '@/lib/ai';
import { lookupKey, lookupKeys } from '@/lib/formatters';

/** Widened prefill type for TicketsDialog.defaultValues — see file header. */
export type TicketsDialogDefaults = Omit<Tickets['fields'], 'priority' | 'status' | 'category' | 'tags' | 'customer_satisfaction'> & {
    priority?: LookupValue | string;
    status?: LookupValue | string;
    category?: LookupValue | string;
    tags?: (LookupValue | string)[];
    customer_satisfaction?: LookupValue | string;
  };

interface TicketsDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Tickets['fields']) => Promise<void>;
  /** SHAPE-TOLERANT: lookup fields accept the bare key (string) or the
   *  LookupValue object; applookup fields the bare record id or the full
   *  record URL — the dialog normalizes both. */
  defaultValues?: TicketsDialogDefaults;
  /** Record id when editing — enables the attachments section. Omit on create. */
  recordId?: string;
  mitarbeitendeList: Mitarbeitende[];
  teamsList: Teams[];
  ticketsList: Tickets[];
  assetsList: Assets[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

// defaultValues are SHAPE-TOLERANT: the dialog resolves bare lookup keys via
// its own options and bare record ids via the field's target app — consumers
// never carry the LookupValue/record-URL shape in their head.
const NORMALIZE_LOOKUPS: Record<string, readonly { key: string; label: string }[]> = {
  priority: LOOKUP_OPTIONS['tickets']?.['priority'] ?? [],
  status: LOOKUP_OPTIONS['tickets']?.['status'] ?? [],
  category: LOOKUP_OPTIONS['tickets']?.['category'] ?? [],
  tags: LOOKUP_OPTIONS['tickets']?.['tags'] ?? [],
  customer_satisfaction: LOOKUP_OPTIONS['tickets']?.['customer_satisfaction'] ?? [],
};
const NORMALIZE_APPLOOKUPS: Record<string, string> = {
  assigned_agent: APP_IDS.MITARBEITENDE,
  team: APP_IDS.TEAMS,
  parent_ticket: APP_IDS.TICKETS,
  affected_asset: APP_IDS.ASSETS,
};
function normalizeDefaults(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const [k, opts] of Object.entries(NORMALIZE_LOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string') out[k] = opts.find(o => o.key === v) ?? { key: v, label: v };
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' ? opts.find(o => o.key === x) ?? { key: x, label: x } : x));
  }
  for (const [k, appId] of Object.entries(NORMALIZE_APPLOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string' && v !== '' && !v.startsWith('http')) out[k] = createRecordUrl(appId, v);
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' && x !== '' && !x.startsWith('http') ? createRecordUrl(appId, x) : x));
  }
  return out;
}

export function TicketsDialog({ open, onClose, onSubmit, defaultValues, recordId, mitarbeitendeList, teamsList, ticketsList, assetsList, enablePhotoScan = true, enablePhotoLocation = true }: TicketsDialogProps) {
  const [fields, setFields] = useState<Partial<Tickets['fields']>>({});
  const [saving, setSaving] = useState(false);
  const normalizedDefaults = useMemo<Record<string, unknown> | undefined>(
    () => (defaultValues ? normalizeDefaults(defaultValues as Record<string, unknown>) : undefined),
    [defaultValues],
  );
  // Dirty-tracking: in edit-mode the Speichern button is disabled until the
  // user actually changes something. JSON.stringify is good enough for our
  // fields (plain values + LookupValue objects + string arrays).
  const isDirty = useMemo(() => {
    if (!normalizedDefaults) return true;  // create-mode: always allow submit
    try {
      return JSON.stringify(fields) !== JSON.stringify(normalizedDefaults);
    } catch {
      return true;
    }
  }, [fields, normalizedDefaults]);
  // Inline-Create state for "Mitarbeitende" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraMitarbeitende` list, and select it in
  // the originating Combobox via the captured `createMitarbeitendeField`.
  const [createMitarbeitendeOpen, setCreateMitarbeitendeOpen] = useState(false);
  const [createMitarbeitendeInitial, setCreateMitarbeitendeInitial] = useState('');
  const [createMitarbeitendeField, setCreateMitarbeitendeField] = useState<string>('');
  const [extraMitarbeitende, setExtraMitarbeitende] = useState< Mitarbeitende[]>([]);
  const mitarbeitendeListAll = useMemo(
    () => [...mitarbeitendeList, ...extraMitarbeitende],
    [mitarbeitendeList, extraMitarbeitende],
  );
  function openCreateMitarbeitende(fieldKey: string, q: string) {
    setCreateMitarbeitendeField(fieldKey);
    setCreateMitarbeitendeInitial(q);
    setCreateMitarbeitendeOpen(true);
  }
  // Inline-Create state for "Teams" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraTeams` list, and select it in
  // the originating Combobox via the captured `createTeamsField`.
  const [createTeamsOpen, setCreateTeamsOpen] = useState(false);
  const [createTeamsInitial, setCreateTeamsInitial] = useState('');
  const [createTeamsField, setCreateTeamsField] = useState<string>('');
  const [extraTeams, setExtraTeams] = useState< Teams[]>([]);
  const teamsListAll = useMemo(
    () => [...teamsList, ...extraTeams],
    [teamsList, extraTeams],
  );
  function openCreateTeams(fieldKey: string, q: string) {
    setCreateTeamsField(fieldKey);
    setCreateTeamsInitial(q);
    setCreateTeamsOpen(true);
  }
  // Inline-Create state for "Assets" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraAssets` list, and select it in
  // the originating Combobox via the captured `createAssetsField`.
  const [createAssetsOpen, setCreateAssetsOpen] = useState(false);
  const [createAssetsInitial, setCreateAssetsInitial] = useState('');
  const [createAssetsField, setCreateAssetsField] = useState<string>('');
  const [extraAssets, setExtraAssets] = useState< Assets[]>([]);
  const assetsListAll = useMemo(
    () => [...assetsList, ...extraAssets],
    [assetsList, extraAssets],
  );
  function openCreateAssets(fieldKey: string, q: string) {
    setCreateAssetsField(fieldKey);
    setCreateAssetsInitial(q);
    setCreateAssetsOpen(true);
  }
  const [showErrors, setShowErrors] = useState(false);
  const REQUIRED_FIELDS = ['title', 'priority', 'status', 'reporter_name', 'reporter_email', 'due', 'opened_on', 'estimated_hours'] as const;
  const missingRequired = REQUIRED_FIELDS.filter(k => {
    const v = (fields as Record<string, unknown>)[k];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Computed-field plumbing. Pure no-op when formEnhancements.computed is {}.
  // The number renderer uses computedValues only as a fallback when the user
  // hasn't typed anything — clearing the input always restores the computation.
  // computedContext exposes applookup list props so { kind: 'applookup', ... }
  // operands can resolve to numeric fields on the target record.
  const computedContext = useMemo<ComputedContext>(() => ({
    lookupLists: {
      'assigned_agent': mitarbeitendeList,
      'team': teamsList,
      'parent_ticket': ticketsList,
      'affected_asset': assetsList,
    },
  }), [mitarbeitendeList, teamsList, ticketsList, assetsList, ]);
  const computedValues = useMemo<Record<string, number | null>>(() => {
    let out: Record<string, number | null> = {};
    const entries = Object.entries(formEnhancements.computed);
    for (let i = 0; i < 5; i++) {
      const merged: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
      for (const [k, v] of Object.entries(out)) {
        if (v === null) continue;
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') merged[k] = v;
      }
      const next: Record<string, number | null> = {};
      let changed = false;
      for (const [key, spec] of entries) {
        const v = evalComputed(spec, merged, computedContext);
        next[key] = v;
        if (v !== out[key]) changed = true;
      }
      out = next;
      if (!changed) break;
    }
    return out;
  }, [fields, computedContext]);

  useEffect(() => {
    if (open) {
      setFields(applyDefaults(normalizedDefaults ?? {}, formEnhancements.defaults) as Partial<Tickets['fields']>);
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
      setSubmitError(null);
    }
  }, [open, normalizedDefaults]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  // Submit errors surface IN the dialog (it is modal — a banner in the page
  // body would be hidden behind it). A consumer onSubmit that THROWS (the
  // documented "throw to prevent closing" validation pattern) lands here:
  // the dialog stays open, nothing is saved, the message is visible.
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      // Fill empty number slots from computed values; user-typed values always win.
      // CRITICAL: only backend-mapped keys may be backfilled. Virtual computeds
      // (sub-agent invents `_netto`, `_bestellung_gesamtbetrag` etc. for the
      // "Berechnungen" display) have no backend counterpart — writing them
      // triggers a 422 from the Living-Apps API ("field does not exist").
      const merged = { ...fields };
      for (const [key, val] of Object.entries(computedValues)) {
        if (val === null) continue;
        if (!backendFieldSet.has(key)) continue;
        const cur = (merged as Record<string, unknown>)[key];
        if (cur === undefined || cur === null || cur === '') {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      const clean = cleanFieldsForApi(merged, 'tickets');
      await onSubmit(clean as Tickets['fields']);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : t('submit_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="assigned_agent" entity="Mitarbeitende">\n${JSON.stringify(mitarbeitendeList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="team" entity="Teams">\n${JSON.stringify(teamsList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="parent_ticket" entity="Tickets">\n${JSON.stringify(ticketsList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="affected_asset" entity="Assets">\n${JSON.stringify(assetsList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "assigned_agent": string | null, // Display name from Mitarbeitende (see <available-records>)\n  "team": string | null, // Display name from Teams (see <available-records>)\n  "parent_ticket": string | null, // Display name from Tickets (see <available-records>)\n  "title": string | null, // Titel\n  "description": string | null, // Beschreibung\n  "priority": LookupValue | null, // Priorität (select one key: "low" | "medium" | "high" | "critical") mapping: low=Niedrig, medium=Mittel, high=Hoch, critical=Kritisch\n  "status": LookupValue | null, // Status (select one key: "closed" | "new" | "in_progress" | "waiting_for_customer" | "resolved") mapping: closed=Geschlossen, new=Neu, in_progress=In Bearbeitung, waiting_for_customer=Wartet auf Kunde, resolved=Gelöst\n  "category": LookupValue | null, // Kategorie (select one key: "hardware" | "software" | "network" | "access" | "printing" | "phone" | "other") mapping: hardware=Hardware, software=Software, network=Netzwerk, access=Zugang, printing=Drucken, phone=Telefon, other=Sonstiges\n  "reporter_name": string | null, // Name der meldenden Person\n  "reporter_email": string | null, // E-Mail der meldenden Person\n  "reporter_phone": string | null, // Telefon der meldenden Person\n  "due": string | null, // YYYY-MM-DDTHH:MM\n  "opened_on": string | null, // YYYY-MM-DD\n  "tags": LookupValue[] | null, // Tags (select one or more keys: "vip" | "recurring" | "security" | "vendor") mapping: vip=VIP, recurring=Wiederkehrend, security=Sicherheit, vendor=Lieferant\n  "affected_asset": string | null, // Display name from Assets (see <available-records>)\n  "vendor_link": string | null, // Lieferanten-Link\n  "estimated_hours": number | null, // Geschätzte Stunden\n  "billable": boolean | null, // Abrechenbar\n  "resolution": string | null, // Lösung\n  "sla_breached": boolean | null, // SLA verletzt\n  "customer_satisfaction": LookupValue | null, // Kundenzufriedenheit (select one key: "option_1" | "option_2" | "option_3" | "option_4" | "option_5") mapping: option_1=1, option_2=2, option_3=3, option_4=4, option_5=5\n  "internal_note": string | null, // Interne Notiz\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["assigned_agent", "team", "parent_ticket", "affected_asset"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const assigned_agentName = raw['assigned_agent'] as string | null;
        if (assigned_agentName) {
          const assigned_agentMatch = mitarbeitendeList.find(r => matchName(assigned_agentName!, [[r.fields.first_name ?? '', r.fields.last_name ?? ''].filter(Boolean).join(' ')]));
          if (assigned_agentMatch) merged['assigned_agent'] = createRecordUrl(APP_IDS.MITARBEITENDE, assigned_agentMatch.record_id);
        }
        const teamName = raw['team'] as string | null;
        if (teamName) {
          const teamMatch = teamsList.find(r => matchName(teamName!, [String(r.fields.name ?? '')]));
          if (teamMatch) merged['team'] = createRecordUrl(APP_IDS.TEAMS, teamMatch.record_id);
        }
        const parent_ticketName = raw['parent_ticket'] as string | null;
        if (parent_ticketName) {
          const parent_ticketMatch = ticketsList.find(r => matchName(parent_ticketName!, [String(r.fields.title ?? '')]));
          if (parent_ticketMatch) merged['parent_ticket'] = createRecordUrl(APP_IDS.TICKETS, parent_ticketMatch.record_id);
        }
        const affected_assetName = raw['affected_asset'] as string | null;
        if (affected_assetName) {
          const affected_assetMatch = assetsList.find(r => matchName(affected_assetName!, [String(r.fields.name ?? '')]));
          if (affected_assetMatch) merged['affected_asset'] = createRecordUrl(APP_IDS.ASSETS, affected_assetMatch.record_id);
        }
        return merged as Partial<Tickets['fields']>;
      });
      // Upload scanned file to file fields
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          const blob = dataUriToBlob(uri!);
          const fileUrl = await uploadFile(blob, file.name);
          setFields(prev => ({ ...prev, attachment: fileUrl }));
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
        }
      }
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error(`${t('scan_error')}:`, err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues
    ? t('edit_entity', { entity: appLabel('tickets') })
    : t('new_entity', { entity: appLabel('tickets') });

  const fieldBlocks: Record<string, React.ReactNode> = {
    'assigned_agent': (
      <div key="assigned_agent" className="space-y-1.5">
        <Label htmlFor="assigned_agent">{fieldLabel('tickets', 'assigned_agent')}</Label>
        <Combobox
          id="assigned_agent"
          placeholder="Wem zuweisen?"
          items={mitarbeitendeListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.first_name ?? r.record_id),
          }))}
          value={extractRecordId(fields.assigned_agent)}
          onChange={id => setFields(f => ({ ...f, assigned_agent: id ? createRecordUrl(APP_IDS.MITARBEITENDE, id) : undefined }))}
          onCreateNew={(q) => openCreateMitarbeitende("assigned_agent", q)}
          createLabel={t('create_in', { entity: appLabel('mitarbeitende') })}
        />
      </div>
    ),
    'team': (
      <div key="team" className="space-y-1.5">
        <Label htmlFor="team">{fieldLabel('tickets', 'team')}</Label>
        <Combobox
          id="team"
          placeholder="In welches Team?"
          items={teamsListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.name ?? r.record_id),
          }))}
          value={extractRecordId(fields.team)}
          onChange={id => setFields(f => ({ ...f, team: id ? createRecordUrl(APP_IDS.TEAMS, id) : undefined }))}
          onCreateNew={(q) => openCreateTeams("team", q)}
          createLabel={t('create_in', { entity: appLabel('teams') })}
        />
      </div>
    ),
    'parent_ticket': (
      <div key="parent_ticket" className="space-y-1.5">
        <Label htmlFor="parent_ticket">{fieldLabel('tickets', 'parent_ticket')}</Label>
        <Combobox
          id="parent_ticket"
          placeholder="Übergeordnetes Ticket wählen"
          items={ticketsList.map(r => ({
            id: r.record_id,
            label: String(r.fields.title ?? r.record_id),
          }))}
          value={extractRecordId(fields.parent_ticket)}
          onChange={id => setFields(f => ({ ...f, parent_ticket: id ? createRecordUrl(APP_IDS.TICKETS, id) : undefined }))}
          onCreateNew={undefined}
          createLabel={t('create_in', { entity: appLabel('tickets') })}
        />
      </div>
    ),
    'title': (
      <div key="title" className="space-y-1.5">
        <Label htmlFor="title">{fieldLabel('tickets', 'title')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="title"
          placeholder="z. B. Drucker antwortet nicht"
          value={fields.title ?? ''}
          onChange={e => setFields(f => ({ ...f, title: e.target.value }))}
          required
        />
        {showErrors && !fields.title && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('tickets', 'title')}</p>
        )}
      </div>
    ),
    'description': (
      <div key="description" className="space-y-1.5">
        <Label htmlFor="description">{fieldLabel('tickets', 'description')}</Label>
        <Textarea
          id="description"
          placeholder="Was ist das Problem? Wann ist es aufgetreten?"
          value={fields.description ?? ''}
          onChange={e => setFields(f => ({ ...f, description: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'priority': (
      <div key="priority" className="space-y-1.5">
        <Label htmlFor="priority">{fieldLabel('tickets', 'priority')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.priority) === 'low'}
            onClick={() => setFields(f => ({ ...f, priority: (lookupKey(f.priority) === 'low' ? undefined : 'low') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.priority) === 'low'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'priority', 'low') ?? 'Niedrig'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.priority) === 'medium'}
            onClick={() => setFields(f => ({ ...f, priority: (lookupKey(f.priority) === 'medium' ? undefined : 'medium') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.priority) === 'medium'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'priority', 'medium') ?? 'Mittel'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.priority) === 'high'}
            onClick={() => setFields(f => ({ ...f, priority: (lookupKey(f.priority) === 'high' ? undefined : 'high') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.priority) === 'high'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'priority', 'high') ?? 'Hoch'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.priority) === 'critical'}
            onClick={() => setFields(f => ({ ...f, priority: (lookupKey(f.priority) === 'critical' ? undefined : 'critical') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.priority) === 'critical'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'priority', 'critical') ?? 'Kritisch'}
          </button>
        </div>
        {showErrors && !fields.priority && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('tickets', 'priority')}</p>
        )}
      </div>
    ),
    'status': (
      <div key="status" className="space-y-1.5">
        <Label htmlFor="status">{fieldLabel('tickets', 'status')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'closed'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'closed' ? undefined : 'closed') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'closed'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'status', 'closed') ?? 'Geschlossen'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'new'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'new' ? undefined : 'new') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'new'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'status', 'new') ?? 'Neu'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'in_progress'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'in_progress' ? undefined : 'in_progress') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'in_progress'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'status', 'in_progress') ?? 'In Bearbeitung'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'waiting_for_customer'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'waiting_for_customer' ? undefined : 'waiting_for_customer') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'waiting_for_customer'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'status', 'waiting_for_customer') ?? 'Wartet auf Kunde'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'resolved'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'resolved' ? undefined : 'resolved') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'resolved'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'status', 'resolved') ?? 'Gelöst'}
          </button>
        </div>
        {showErrors && !fields.status && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('tickets', 'status')}</p>
        )}
      </div>
    ),
    'category': (
      <div key="category" className="space-y-1.5">
        <Label htmlFor="category">{fieldLabel('tickets', 'category')}</Label>
        <Select
          value={lookupKey(fields.category) ?? ''}
          onValueChange={v => setFields(f => ({ ...f, category: v === 'none' ? undefined : v as any }))}
        >
          <SelectTrigger id="category" className="max-sm:h-11"><SelectValue placeholder="z. B. Hardware, Software" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="hardware">{lookupLabel('tickets', 'category', 'hardware') ?? 'Hardware'}</SelectItem>
            <SelectItem value="software">{lookupLabel('tickets', 'category', 'software') ?? 'Software'}</SelectItem>
            <SelectItem value="network">{lookupLabel('tickets', 'category', 'network') ?? 'Netzwerk'}</SelectItem>
            <SelectItem value="access">{lookupLabel('tickets', 'category', 'access') ?? 'Zugang'}</SelectItem>
            <SelectItem value="printing">{lookupLabel('tickets', 'category', 'printing') ?? 'Drucken'}</SelectItem>
            <SelectItem value="phone">{lookupLabel('tickets', 'category', 'phone') ?? 'Telefon'}</SelectItem>
            <SelectItem value="other">{lookupLabel('tickets', 'category', 'other') ?? 'Sonstiges'}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    ),
    'reporter_name': (
      <div key="reporter_name" className="space-y-1.5">
        <Label htmlFor="reporter_name">{fieldLabel('tickets', 'reporter_name')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="reporter_name"
          placeholder="Name der Person, die das Problem meldet"
          value={fields.reporter_name ?? ''}
          onChange={e => setFields(f => ({ ...f, reporter_name: e.target.value }))}
          required
        />
        {showErrors && !fields.reporter_name && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('tickets', 'reporter_name')}</p>
        )}
      </div>
    ),
    'reporter_email': (
      <div key="reporter_email" className="space-y-1.5">
        <Label htmlFor="reporter_email">{fieldLabel('tickets', 'reporter_email')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="reporter_email"
          type="email"
          inputMode="email"
          placeholder="z. B. benutzer@unternehmen.de"
          value={fields.reporter_email ?? ''}
          onChange={e => setFields(f => ({ ...f, reporter_email: e.target.value }))}
          required
        />
        {showErrors && !fields.reporter_email && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('tickets', 'reporter_email')}</p>
        )}
      </div>
    ),
    'reporter_phone': (
      <div key="reporter_phone" className="space-y-1.5">
        <Label htmlFor="reporter_phone">{fieldLabel('tickets', 'reporter_phone')}</Label>
        <Input
          id="reporter_phone"
          type="tel"
          inputMode="tel"
          placeholder="z. B. +49 123 4567"
          value={fields.reporter_phone ?? ''}
          onChange={e => setFields(f => ({ ...f, reporter_phone: e.target.value }))}
        />
      </div>
    ),
    'due': (
      <div key="due" className="space-y-1.5">
        <Label htmlFor="due">{fieldLabel('tickets', 'due')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <DatePicker
          id="due"
          placeholder="Bis wann muss es gelöst sein?"
          mode="datetime"
          value={fields.due ?? null}
          onChange={v => setFields(f => ({ ...f, due: v ?? undefined }))}
          required
        />
        {showErrors && !fields.due && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('tickets', 'due')}</p>
        )}
      </div>
    ),
    'opened_on': (
      <div key="opened_on" className="space-y-1.5">
        <Label htmlFor="opened_on">{fieldLabel('tickets', 'opened_on')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <DatePicker
          id="opened_on"
          placeholder="Wann wurde es eröffnet?"
          mode="date"
          value={fields.opened_on ?? null}
          onChange={v => setFields(f => ({ ...f, opened_on: v ?? undefined }))}
          required
        />
        {showErrors && !fields.opened_on && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('tickets', 'opened_on')}</p>
        )}
      </div>
    ),
    'tags': (
      <div key="tags" className="space-y-1.5">
        <Label htmlFor="tags">{fieldLabel('tickets', 'tags')}</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="tags_vip"
              checked={lookupKeys(fields.tags).includes('vip')}
              onCheckedChange={(checked) => {
                setFields(f => {
                  const current = lookupKeys(f.tags);
                  const next = checked ? [...current, 'vip'] : current.filter(k => k !== 'vip');
                  return { ...f, tags: next.length ? next as any : undefined };
                });
              }}
            />
            <Label htmlFor="tags_vip" className="font-normal">{lookupLabel('tickets', 'tags', 'vip') ?? 'VIP'}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tags_recurring"
              checked={lookupKeys(fields.tags).includes('recurring')}
              onCheckedChange={(checked) => {
                setFields(f => {
                  const current = lookupKeys(f.tags);
                  const next = checked ? [...current, 'recurring'] : current.filter(k => k !== 'recurring');
                  return { ...f, tags: next.length ? next as any : undefined };
                });
              }}
            />
            <Label htmlFor="tags_recurring" className="font-normal">{lookupLabel('tickets', 'tags', 'recurring') ?? 'Wiederkehrend'}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tags_security"
              checked={lookupKeys(fields.tags).includes('security')}
              onCheckedChange={(checked) => {
                setFields(f => {
                  const current = lookupKeys(f.tags);
                  const next = checked ? [...current, 'security'] : current.filter(k => k !== 'security');
                  return { ...f, tags: next.length ? next as any : undefined };
                });
              }}
            />
            <Label htmlFor="tags_security" className="font-normal">{lookupLabel('tickets', 'tags', 'security') ?? 'Sicherheit'}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tags_vendor"
              checked={lookupKeys(fields.tags).includes('vendor')}
              onCheckedChange={(checked) => {
                setFields(f => {
                  const current = lookupKeys(f.tags);
                  const next = checked ? [...current, 'vendor'] : current.filter(k => k !== 'vendor');
                  return { ...f, tags: next.length ? next as any : undefined };
                });
              }}
            />
            <Label htmlFor="tags_vendor" className="font-normal">{lookupLabel('tickets', 'tags', 'vendor') ?? 'Lieferant'}</Label>
          </div>
        </div>
      </div>
    ),
    'affected_asset': (
      <div key="affected_asset" className="space-y-1.5">
        <Label htmlFor="affected_asset">{fieldLabel('tickets', 'affected_asset')}</Label>
        <Combobox
          id="affected_asset"
          placeholder="Welches Hardware-Asset betroffen?"
          items={assetsListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.name ?? r.record_id),
          }))}
          value={extractRecordId(fields.affected_asset)}
          onChange={id => setFields(f => ({ ...f, affected_asset: id ? createRecordUrl(APP_IDS.ASSETS, id) : undefined }))}
          onCreateNew={(q) => openCreateAssets("affected_asset", q)}
          createLabel={t('create_in', { entity: appLabel('assets') })}
        />
      </div>
    ),
    'vendor_link': (
      <div key="vendor_link" className="space-y-1.5">
        <Label htmlFor="vendor_link">{fieldLabel('tickets', 'vendor_link')}</Label>
        <Input
          id="vendor_link"
          type="url"
          inputMode="url"
          placeholder="z. B. https://support.vendor.de/..."
          value={fields.vendor_link ?? ''}
          onChange={e => setFields(f => ({ ...f, vendor_link: e.target.value }))}
        />
      </div>
    ),
    'estimated_hours': (
      <div key="estimated_hours" className="space-y-1.5">
        <Label htmlFor="estimated_hours">{fieldLabel('tickets', 'estimated_hours')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="estimated_hours"
          type="number"
          inputMode="decimal"
          step="any"
          {...numberInputProps(formEnhancements, 'estimated_hours')}
          placeholder="z. B. 2"
          value={fields.estimated_hours !== undefined ? fields.estimated_hours : (computedValues['estimated_hours'] ?? '')}
          onChange={e => setFields(f => ({ ...f, estimated_hours: clampNumberValue(formEnhancements, 'estimated_hours', e.target.value) }))}
        />
        {showErrors && !fields.estimated_hours && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('tickets', 'estimated_hours')}</p>
        )}
      </div>
    ),
    'billable': (
      <div key="billable" className="space-y-1.5">
        <Label htmlFor="billable">{fieldLabel('tickets', 'billable')}</Label>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="billable"
            checked={!!fields.billable}
            onCheckedChange={(v) => setFields(f => ({ ...f, billable: !!v }))}
          />
          <Label htmlFor="billable" className="font-normal">{fieldLabel('tickets', 'billable')}</Label>
        </div>
      </div>
    ),
    'resolution': (
      <div key="resolution" className="space-y-1.5">
        <Label htmlFor="resolution">{fieldLabel('tickets', 'resolution')}</Label>
        <Textarea
          id="resolution"
          placeholder="Wie wurde das Problem gelöst?"
          value={fields.resolution ?? ''}
          onChange={e => setFields(f => ({ ...f, resolution: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'sla_breached': (
      <div key="sla_breached" className="space-y-1.5">
        <Label htmlFor="sla_breached">{fieldLabel('tickets', 'sla_breached')}</Label>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="sla_breached"
            checked={!!fields.sla_breached}
            onCheckedChange={(v) => setFields(f => ({ ...f, sla_breached: !!v }))}
          />
          <Label htmlFor="sla_breached" className="font-normal">{fieldLabel('tickets', 'sla_breached')}</Label>
        </div>
      </div>
    ),
    'customer_satisfaction': (
      <div key="customer_satisfaction" className="space-y-1.5">
        <Label htmlFor="customer_satisfaction">{fieldLabel('tickets', 'customer_satisfaction')}</Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.customer_satisfaction) === 'option_1'}
            onClick={() => setFields(f => ({ ...f, customer_satisfaction: (lookupKey(f.customer_satisfaction) === 'option_1' ? undefined : 'option_1') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.customer_satisfaction) === 'option_1'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'customer_satisfaction', 'option_1') ?? '1'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.customer_satisfaction) === 'option_2'}
            onClick={() => setFields(f => ({ ...f, customer_satisfaction: (lookupKey(f.customer_satisfaction) === 'option_2' ? undefined : 'option_2') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.customer_satisfaction) === 'option_2'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'customer_satisfaction', 'option_2') ?? '2'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.customer_satisfaction) === 'option_3'}
            onClick={() => setFields(f => ({ ...f, customer_satisfaction: (lookupKey(f.customer_satisfaction) === 'option_3' ? undefined : 'option_3') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.customer_satisfaction) === 'option_3'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'customer_satisfaction', 'option_3') ?? '3'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.customer_satisfaction) === 'option_4'}
            onClick={() => setFields(f => ({ ...f, customer_satisfaction: (lookupKey(f.customer_satisfaction) === 'option_4' ? undefined : 'option_4') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.customer_satisfaction) === 'option_4'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'customer_satisfaction', 'option_4') ?? '4'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.customer_satisfaction) === 'option_5'}
            onClick={() => setFields(f => ({ ...f, customer_satisfaction: (lookupKey(f.customer_satisfaction) === 'option_5' ? undefined : 'option_5') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.customer_satisfaction) === 'option_5'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('tickets', 'customer_satisfaction', 'option_5') ?? '5'}
          </button>
        </div>
      </div>
    ),
    'attachment': (
      <div key="attachment" className="space-y-1.5">
        <Label htmlFor="attachment">{fieldLabel('tickets', 'attachment')}</Label>
        {fields.attachment ? (
          <div className="flex items-center gap-3 rounded-lg border p-2">
            <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <IconFileText size={20} className="text-muted-foreground" />
              </div>
              <img
                src={fields.attachment}
                alt=""
                className="relative h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-foreground">{fields.attachment.split("/").pop()}</p>
              <div className="flex gap-2 mt-1">
                <label
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {t('fr_change')}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const fileUrl = await uploadFile(file, file.name);
                        setFields(f => ({ ...f, attachment: fileUrl }));
                      } catch (err) { console.error('Upload failed:', err); }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setFields(f => ({ ...f, attachment: undefined }))}
                >
                  {t('fr_remove')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <IconUpload size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('fr_upload_file')}</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const fileUrl = await uploadFile(file, file.name);
                  setFields(f => ({ ...f, attachment: fileUrl }));
                } catch (err) { console.error('Upload failed:', err); }
              }}
            />
          </label>
        )}
      </div>
    ),
    'internal_note': (
      <div key="internal_note" className="space-y-1.5">
        <Label htmlFor="internal_note">{fieldLabel('tickets', 'internal_note')}</Label>
        <Textarea
          id="internal_note"
          placeholder="Interne Anmerkungen, Tipps für künftige Tickets..."
          value={fields.internal_note ?? ''}
          onChange={e => setFields(f => ({ ...f, internal_note: e.target.value }))}
          rows={3}
        />
      </div>
    ),
  };
  const orderedFields = applyFieldOrder(Object.keys(fieldBlocks), formEnhancements.fieldOrder);
  const orderedFieldsKey = orderedFields.map((it) => typeof it === 'string' ? it : it.row.join('+')).join(',');

  // Render-Modell für Computed-Felder:
  //
  //   • BACKEND-FELDER mit computed-Eintrag (z.B. gesamtpreis bei einer
  //     Katzenpension) bleiben als normales Eingabe-Feld stehen. Der Number-
  //     Input nutzt den computed-Wert als Vorschlag, der User kann jederzeit
  //     überschreiben (clearing → restore computed).
  //   • VIRTUELLE computed-Keys (Eintrag in formEnhancements.computed, ABER
  //     kein passendes Backend-Feld in orderedFields) erscheinen NICHT als
  //     Input, sondern unten als kompakte 'Berechnungen'-Übersicht oder als
  //     Inline-Hint unter dem letzten beitragenden Input.
  const FIELD_LABELS: Record<string, string> = {"assigned_agent": "Zugewiesene/r Mitarbeitende/r", "team": "Team", "parent_ticket": "Übergeordnetes Ticket", "title": "Titel", "description": "Beschreibung", "priority": "Priorität", "status": "Status", "category": "Kategorie", "reporter_name": "Name der meldenden Person", "reporter_email": "E-Mail der meldenden Person", "reporter_phone": "Telefon der meldenden Person", "due": "Fällig am", "opened_on": "Eröffnet am", "tags": "Tags", "affected_asset": "Betroffenes Asset", "vendor_link": "Lieferanten-Link", "estimated_hours": "Geschätzte Stunden", "billable": "Abrechenbar", "resolution": "Lösung", "sla_breached": "SLA verletzt", "customer_satisfaction": "Kundenzufriedenheit", "attachment": "Anhang", "internal_note": "Interne Notiz"};
  const CURRENCY_KEYS = new Set<string>([]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {"assigned_agent": {"first_name": "Vorname", "last_name": "Nachname", "email": "E-Mail", "phone": "Telefon", "active": "Aktiv", "working_hours_per_week": "Arbeitsstunden pro Woche", "team": "Team"}, "team": {"lead": "Teamleitung", "name": "Name", "cost_center": "Kostenstelle"}, "parent_ticket": {"assigned_agent": "Zugewiesene/r Mitarbeitende/r", "team": "Team", "parent_ticket": "Übergeordnetes Ticket", "title": "Titel", "description": "Beschreibung", "priority": "Priorität", "status": "Status", "category": "Kategorie", "reporter_name": "Name der meldenden Person", "reporter_email": "E-Mail der meldenden Person", "reporter_phone": "Telefon der meldenden Person", "due": "Fällig am", "opened_on": "Eröffnet am", "tags": "Tags", "affected_asset": "Betroffenes Asset", "vendor_link": "Lieferanten-Link", "estimated_hours": "Geschätzte Stunden", "billable": "Abrechenbar", "resolution": "Lösung", "sla_breached": "SLA verletzt", "customer_satisfaction": "Kundenzufriedenheit", "attachment": "Anhang", "internal_note": "Interne Notiz"}, "affected_asset": {"name": "Name", "serial_number": "Seriennummer", "location": "Standort", "purchased_on": "Angeschafft am", "warranty_until": "Garantie bis"}};
  const inputFields = useMemo(() => flattenFieldOrder(orderedFields), [orderedFieldsKey]);
  const backendFieldSet = useMemo(() => new Set(inputFields), [inputFields.join(',')]);
  const virtualComputed = useMemo(
    () => Object.fromEntries(
      Object.entries(formEnhancements.computed).filter(([k]) => !backendFieldSet.has(k)),
    ),
    [backendFieldSet],
  );
  const virtualFormEnhancements = useMemo(
    () => ({ ...formEnhancements, computed: virtualComputed }),
    [virtualComputed],
  );
  const computedLayout = useMemo(
    () => classifyComputed(virtualFormEnhancements, inputFields, computedDeps),
    [virtualFormEnhancements, inputFields.join(',')],
  );
  // Applookup-Referenzen: pro ownKey (Lookup-Feld im Form) die Liste der
  // lookupKeys, die in irgendeiner computed-Formel referenziert werden.
  // MODUS-1: aus dem Spec-Tree extrahiert. MODUS-2: aus dem Build-Time-
  // Export computedApplookupRefs (parse-formulas hat Regex-Pairs gesammelt).
  // Pro (ownKey, lookupKey)-Paar nur einmal; pro ownKey können aber mehrere
  // lookupKeys gleichzeitig auftauchen (z.B. einzelpreis UND karten10_preis
  // beim Yoga-Kurs), und alle werden separat als Inline-Hint gerendert.
  const applookupRefs = useMemo(
    () => mergeApplookupRefs(
      extractApplookupRefs(formEnhancements.computed),
      computedApplookupRefs,
    ),
    [],
  );
  function summaryLabel(k: string): string {
    if (FIELD_LABELS[k]) return FIELD_LABELS[k];
    // Leading underscore(s) als Virtual-Marker abstreifen; Unterstriche zu
    // Leerzeichen, jedes Wort kapitalisieren. Umlaute kommen vom Sub-Agent
    // direkt im Key (z. B. `_buchung_dauer_nächte`) — JS/TS/Vite unterstützen
    // Unicode-Identifier nativ, daher keine ASCII-Transliteration nötig.
    return k.replace(/^_+/, '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function formatSummaryValue(k: string, v: unknown): string {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Backend-Feld mit €-Label ODER virtueller Computed-Key, dessen Name nach Geld aussieht.
    const looksLikeCurrency = CURRENCY_KEYS.has(k) || /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k);
    if (looksLikeCurrency) {
      return n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 max-sm:[&>button]:size-10 max-sm:[&>button]:grid max-sm:[&>button]:place-items-center max-sm:[&>button]:rounded-full max-sm:[&>button]:border max-sm:[&>button]:border-input max-sm:[&>button]:bg-background max-sm:[&>button]:opacity-100 max-sm:[&>button>svg]:size-5">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center gap-3 space-y-0">
          <DialogTitle className="flex-1 truncate text-left">{DIALOG_INTENT}</DialogTitle>
          {enablePhotoScan && (
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
              aria-controls="ai-fill-panel"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-sm:py-2.5 max-sm:px-4 text-xs font-semibold transition-all mr-7 max-sm:mr-12 shadow-sm ${
                aiOpen
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:border-primary/50'
              }`}
            >
              <IconSparkles className={`h-3.5 w-3.5 ${aiOpen ? '' : 'text-primary'}`} />
              <span className="hidden sm:inline">{t('smart_fill')}</span>
              <IconChevronDown className={`h-3 w-3 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </DialogHeader>
        {enablePhotoScan && aiOpen && (
          <div id="ai-fill-panel" className="border-b bg-muted/20 px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t('scan_header_sub')}</p>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  {t('useinfo_label')}
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? t('useinfo_loading') : `(${t('useinfo_more')})`}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">{t('profile_preamble')}</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">{t('useinfo_error')}</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_analyzing')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_analyzing_sub')}</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('scan_success')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_success_sub')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_upload')}</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />{t('scan_camera_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />{t('scan_file_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />{t('scan_doc_btn')}
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder={t('scan_text_placeholder')}
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title={t('paste')}
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />{t('scan_text_analyze')}
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 min-w-0 max-sm:[&_input]:h-11">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
            {(() => {
              const renderField = (k: string) => {
                const inlineHints = computedLayout.anchors[k] ?? [];
                const refs = applookupRefs[k] ?? [];
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    {fieldBlocks[k]}
                    {refs.map(({ lookupKey }) => {
                      // Show the live numeric value the formula will pull from
                      // the selected lookup target (e.g. "Monatspreis: 34,90 €"
                      // under the Tarif combobox). Hidden while no lookup is
                      // selected or the target field is non-numeric.
                      const v = resolveApplookupRef(k, lookupKey, fields as Record<string, unknown>, computedContext);
                      if (v === null) return null;
                      const lbl = APPLOOKUP_LABELS[k]?.[lookupKey] ?? lookupKey;
                      const text = formatSummaryValue(lookupKey, v);
                      return (
                        <div key={`alh-${k}-${lookupKey}`} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{lbl}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                    {inlineHints.map((cKey) => {
                      const v = computedValues[cKey];
                      const text = formatSummaryValue(cKey, v);
                      if (text === '—') return null;
                      return (
                        <div key={cKey} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{summaryLabel(cKey)}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return orderedFields.map((item, idx) => {
                if (typeof item === 'string') return renderField(item);
                const cols = item.cols ?? `repeat(${item.row.length}, minmax(0, 1fr))`;
                return (
                  <div key={`row-${idx}`} className="grid gap-3" style={{ gridTemplateColumns: cols }}>
                    {item.row.map(renderField)}
                  </div>
                );
              });
            })()}
            {(computedLayout.aggregates.length > 0 || computedLayout.finalTotal) && (
              <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                {computedLayout.aggregates.length > 0 && (
                  <dl className="space-y-1.5 pb-2">
                    {computedLayout.aggregates.map((k) => {
                      const userVal = (fields as Record<string, unknown>)[k];
                      const computed = computedValues[k];
                      const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                      return (
                        <div key={k} className="flex justify-between items-baseline gap-3">
                          <dt className="text-sm text-muted-foreground truncate">{summaryLabel(k)}</dt>
                          <dd className="text-sm font-medium tabular-nums whitespace-nowrap">{formatSummaryValue(k, v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {computedLayout.finalTotal && (() => {
                  const k = computedLayout.finalTotal;
                  const userVal = (fields as Record<string, unknown>)[k];
                  const computed = computedValues[k];
                  const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                  // Innere Border nur wenn aggregates existieren — sonst hätten wir
                  // zwei direkt aufeinanderfolgende Striche (Outer + Inner) mit nur
                  // einer Aggregat-Zeile dazwischen → zu viel visuelles Rauschen.
                  const sep = computedLayout.aggregates.length > 0 ? 'pt-3 border-t border-border' : 'pt-1';
                  return (
                    <div className={`flex justify-between items-baseline gap-3 ${sep}`}>
                      <span className="text-base font-semibold text-foreground">{summaryLabel(k)}</span>
                      <span className="text-lg font-bold tabular-nums whitespace-nowrap text-foreground">{formatSummaryValue(k, v)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            {showErrors && missingRequired.length > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
                {t('missing_required')}
              </p>
            )}
            {recordId && (
              <div className="pt-2 border-t border-border">
                <AttachmentsSection appId={APP_IDS.TICKETS} recordId={recordId} />
              </div>
            )}
          </div>
          {submitError && (
            <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive" role="alert">
              <IconAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{submitError}</span>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 gap-2 max-sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} className="max-sm:h-12 max-sm:flex-1 max-sm:text-base">{t('cancel')}</Button>
            <Button
              type="submit"
              className="max-sm:h-12 max-sm:flex-1 max-sm:text-base"
              disabled={saving || !isDirty || (showErrors && missingRequired.length > 0)}
            >
              {saving ? t('saving') : defaultValues ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {createMitarbeitendeOpen && (
      <MitarbeitendeDialog
        open={createMitarbeitendeOpen}
        onClose={() => setCreateMitarbeitendeOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createMitarbeitendeEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Mitarbeitende;
            setExtraMitarbeitende(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.MITARBEITENDE, result.id);
            setFields(prev => ({ ...prev, [createMitarbeitendeField]: url } as any));
          }
          setCreateMitarbeitendeOpen(false);
        }}
        defaultValues={createMitarbeitendeInitial
          ? ({ first_name: createMitarbeitendeInitial } as any)
          : undefined}
        teamsList={teamsList}
      />
    )}
    {createTeamsOpen && (
      <TeamsDialog
        open={createTeamsOpen}
        onClose={() => setCreateTeamsOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createTeam(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Teams;
            setExtraTeams(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.TEAMS, result.id);
            setFields(prev => ({ ...prev, [createTeamsField]: url } as any));
          }
          setCreateTeamsOpen(false);
        }}
        defaultValues={createTeamsInitial
          ? ({ name: createTeamsInitial } as any)
          : undefined}
        mitarbeitendeList={mitarbeitendeList}
      />
    )}
    {createAssetsOpen && (
      <AssetsDialog
        open={createAssetsOpen}
        onClose={() => setCreateAssetsOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createAsset(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Assets;
            setExtraAssets(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.ASSETS, result.id);
            setFields(prev => ({ ...prev, [createAssetsField]: url } as any));
          }
          setCreateAssetsOpen(false);
        }}
        defaultValues={createAssetsInitial
          ? ({ name: createAssetsInitial } as any)
          : undefined}
      />
    )}
    </>
  );
}