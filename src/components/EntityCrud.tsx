/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'assets'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.assets.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.assets.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.assets.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.assets              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   assets: name, serial_number, location, purchased_on, warranty_until  ·  ← tickets (list + contextual +)
 *   teams: lead, name, cost_center  ·  → mitarbeitende · ← mitarbeitende (list + contextual +) · ← tickets (list + contextual +)
 *   mitarbeitende: first_name, last_name, email, phone, active, working_hours_per_week, team  ·  → teams · ← teams (list + contextual +) · ← tickets (list + contextual +)
 *   tickets: assigned_agent, team, parent_ticket, title, description, priority, status, category, …  ·  → mitarbeitende · → teams · → tickets · → assets · ← notizen (list + contextual +)
 *   notizen: ticket, text, author, visible_to_reporter  ·  → tickets
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Assets, Teams, Mitarbeitende, Tickets, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichTeams, enrichMitarbeitende, enrichTickets, enrichNotizen } from '@/lib/enrich';
import type { EnrichedTeams, EnrichedMitarbeitende, EnrichedTickets, EnrichedNotizen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { AssetsDialog, type AssetsDialogDefaults } from '@/components/dialogs/AssetsDialog';
import { AssetsDetails } from '@/components/details/AssetsDetails';
import { TeamsDialog, type TeamsDialogDefaults } from '@/components/dialogs/TeamsDialog';
import { TeamsDetails } from '@/components/details/TeamsDetails';
import { MitarbeitendeDialog, type MitarbeitendeDialogDefaults } from '@/components/dialogs/MitarbeitendeDialog';
import { MitarbeitendeDetails } from '@/components/details/MitarbeitendeDetails';
import { TicketsDialog, type TicketsDialogDefaults } from '@/components/dialogs/TicketsDialog';
import { TicketsDetails } from '@/components/details/TicketsDetails';
import { NotizenDialog, type NotizenDialogDefaults } from '@/components/dialogs/NotizenDialog';
import { NotizenDetails } from '@/components/details/NotizenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'assets'; record: Assets }
  | { type: 'teams'; record: EnrichedTeams }
  | { type: 'mitarbeitende'; record: EnrichedMitarbeitende }
  | { type: 'tickets'; record: EnrichedTickets }
  | { type: 'notizen'; record: EnrichedNotizen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  assets: EntityCrudApi<Assets, AssetsDialogDefaults>;
  teams: EntityCrudApi<Teams, TeamsDialogDefaults>;
  mitarbeitende: EntityCrudApi<Mitarbeitende, MitarbeitendeDialogDefaults>;
  tickets: EntityCrudApi<Tickets, TicketsDialogDefaults>;
  notizen: EntityCrudApi<Notizen, NotizenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { assets: Assets[]; teams: EnrichedTeams[]; mitarbeitende: EnrichedMitarbeitende[]; tickets: EnrichedTickets[]; notizen: EnrichedNotizen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [assetsDialog, setAssetsDialog] = useState<{ defaults?: AssetsDialogDefaults; editing?: Assets } | null>(null);
  const [teamsDialog, setTeamsDialog] = useState<{ defaults?: TeamsDialogDefaults; editing?: Teams } | null>(null);
  const [mitarbeitendeDialog, setMitarbeitendeDialog] = useState<{ defaults?: MitarbeitendeDialogDefaults; editing?: Mitarbeitende } | null>(null);
  const [ticketsDialog, setTicketsDialog] = useState<{ defaults?: TicketsDialogDefaults; editing?: Tickets } | null>(null);
  const [notizenDialog, setNotizenDialog] = useState<{ defaults?: NotizenDialogDefaults; editing?: Notizen } | null>(null);
  const enrichedTeams = useMemo(() => enrichTeams(data.teams, { mitarbeitendeMap: data.mitarbeitendeMap }), [data.teams, data.mitarbeitendeMap]);
  const enrichedMitarbeitende = useMemo(() => enrichMitarbeitende(data.mitarbeitende, { teamsMap: data.teamsMap }), [data.mitarbeitende, data.teamsMap]);
  const enrichedTickets = useMemo(() => enrichTickets(data.tickets, { mitarbeitendeMap: data.mitarbeitendeMap, teamsMap: data.teamsMap, ticketsMap: data.ticketsMap, assetsMap: data.assetsMap }), [data.tickets, data.mitarbeitendeMap, data.teamsMap, data.ticketsMap, data.assetsMap]);
  const enrichedNotizen = useMemo(() => enrichNotizen(data.notizen, { ticketsMap: data.ticketsMap }), [data.notizen, data.ticketsMap]);

  function detailAssets(record: Assets, push = false) {
    const item: OverlayItem = { type: 'assets', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAssets(fields: Assets['fields']) {
    const editing = assetsDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAssets(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAsset(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('assets')} — ${t('crud_updated')}`, async () => {
        data.setAssets(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAsset(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAsset(fields);
      undoToast(`${appLabel('assets')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailTeams(record: Teams, push = false) {
    const rec = enrichedTeams.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'teams', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitTeams(fields: Teams['fields']) {
    const editing = teamsDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setTeams(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateTeam(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('teams')} — ${t('crud_updated')}`, async () => {
        data.setTeams(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateTeam(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createTeam(fields);
      undoToast(`${appLabel('teams')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailMitarbeitende(record: Mitarbeitende, push = false) {
    const rec = enrichedMitarbeitende.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'mitarbeitende', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitMitarbeitende(fields: Mitarbeitende['fields']) {
    const editing = mitarbeitendeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setMitarbeitende(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateMitarbeitendeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('mitarbeitende')} — ${t('crud_updated')}`, async () => {
        data.setMitarbeitende(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateMitarbeitendeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createMitarbeitendeEntry(fields);
      undoToast(`${appLabel('mitarbeitende')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailTickets(record: Tickets, push = false) {
    const rec = enrichedTickets.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'tickets', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitTickets(fields: Tickets['fields']) {
    const editing = ticketsDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setTickets(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateTicket(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('tickets')} — ${t('crud_updated')}`, async () => {
        data.setTickets(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateTicket(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createTicket(fields);
      undoToast(`${appLabel('tickets')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailNotizen(record: Notizen, push = false) {
    const rec = enrichedNotizen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'notizen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitNotizen(fields: Notizen['fields']) {
    const editing = notizenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setNotizen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateNotizenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('notizen')} — ${t('crud_updated')}`, async () => {
        data.setNotizen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateNotizenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createNotizenEntry(fields);
      undoToast(`${appLabel('notizen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <AssetsDialog
        open={assetsDialog !== null}
        onClose={() => setAssetsDialog(null)}
        onSubmit={submitAssets}
        defaultValues={assetsDialog?.defaults}
        recordId={assetsDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Assets']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Assets']}
      />
      <TeamsDialog
        open={teamsDialog !== null}
        onClose={() => setTeamsDialog(null)}
        onSubmit={submitTeams}
        defaultValues={teamsDialog?.defaults}
        recordId={teamsDialog?.editing?.record_id}
        mitarbeitendeList={data.mitarbeitende}
        enablePhotoScan={AI_PHOTO_SCAN['Teams']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Teams']}
      />
      <MitarbeitendeDialog
        open={mitarbeitendeDialog !== null}
        onClose={() => setMitarbeitendeDialog(null)}
        onSubmit={submitMitarbeitende}
        defaultValues={mitarbeitendeDialog?.defaults}
        recordId={mitarbeitendeDialog?.editing?.record_id}
        teamsList={data.teams}
        enablePhotoScan={AI_PHOTO_SCAN['Mitarbeitende']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitarbeitende']}
      />
      <TicketsDialog
        open={ticketsDialog !== null}
        onClose={() => setTicketsDialog(null)}
        onSubmit={submitTickets}
        defaultValues={ticketsDialog?.defaults}
        recordId={ticketsDialog?.editing?.record_id}
        mitarbeitendeList={data.mitarbeitende}
        teamsList={data.teams}
        ticketsList={data.tickets}
        assetsList={data.assets}
        enablePhotoScan={AI_PHOTO_SCAN['Tickets']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Tickets']}
      />
      <NotizenDialog
        open={notizenDialog !== null}
        onClose={() => setNotizenDialog(null)}
        onSubmit={submitNotizen}
        defaultValues={notizenDialog?.defaults}
        recordId={notizenDialog?.editing?.record_id}
        ticketsList={data.tickets}
        enablePhotoScan={AI_PHOTO_SCAN['Notizen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Notizen']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'assets') {
            return (
              <>
                <RecordHeader title={top.record.fields.name ?? appLabel('assets')} subtitle={top.record.fields.purchased_on ? formatDate(top.record.fields.purchased_on) : undefined} />
                <AssetsDetails
                  record={top.record}
                  ticketsList={data.tickets}
                  onOpenTickets={(r) => detailTickets(r, true)}
                  onAddTickets={() => setTicketsDialog({ defaults: { affected_asset: createRecordUrl(APP_IDS.ASSETS, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'teams') {
            return (
              <>
                <RecordHeader title={top.record.fields.name ?? appLabel('teams')} subtitle={undefined} />
                <TeamsDetails
                  record={top.record}
                  mitarbeitendeList={data.mitarbeitende}
                  onOpenMitarbeitende={(r) => detailMitarbeitende(r, true)}
                  onAddMitarbeitende={() => setMitarbeitendeDialog({ defaults: { team: createRecordUrl(APP_IDS.TEAMS, top.record.record_id) } })}
                  ticketsList={data.tickets}
                  onOpenTickets={(r) => detailTickets(r, true)}
                  onAddTickets={() => setTicketsDialog({ defaults: { team: createRecordUrl(APP_IDS.TEAMS, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'mitarbeitende') {
            return (
              <>
                <RecordHeader title={top.record.fields.first_name ?? appLabel('mitarbeitende')} subtitle={undefined} />
                <MitarbeitendeDetails
                  record={top.record}
                  teamsList={data.teams}
                  onOpenTeams={(r) => detailTeams(r, true)}
                  onAddTeams={() => setTeamsDialog({ defaults: { lead: createRecordUrl(APP_IDS.MITARBEITENDE, top.record.record_id) } })}
                  ticketsList={data.tickets}
                  onOpenTickets={(r) => detailTickets(r, true)}
                  onAddTickets={() => setTicketsDialog({ defaults: { assigned_agent: createRecordUrl(APP_IDS.MITARBEITENDE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'tickets') {
            return (
              <>
                <RecordHeader title={top.record.fields.title ?? appLabel('tickets')} subtitle={top.record.fields.due ? formatDate(top.record.fields.due) : undefined} />
                <TicketsDetails
                  record={top.record}
                  mitarbeitendeList={data.mitarbeitende}
                  onOpenMitarbeitende={(r) => detailMitarbeitende(r, true)}
                  teamsList={data.teams}
                  onOpenTeams={(r) => detailTeams(r, true)}
                  ticketsList={data.tickets}
                  onOpenTickets={(r) => detailTickets(r, true)}
                  assetsList={data.assets}
                  onOpenAssets={(r) => detailAssets(r, true)}
                  notizenList={data.notizen}
                  onOpenNotizen={(r) => detailNotizen(r, true)}
                  onAddNotizen={() => setNotizenDialog({ defaults: { ticket: createRecordUrl(APP_IDS.TICKETS, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'notizen') {
            return (
              <>
                <RecordHeader title={top.record.fields.author ?? appLabel('notizen')} subtitle={undefined} />
                <NotizenDetails
                  record={top.record}
                  ticketsList={data.tickets}
                  onOpenTickets={(r) => detailTickets(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'assets') setAssetsDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'teams') setTeamsDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'mitarbeitende') setMitarbeitendeDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'tickets') setTicketsDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'notizen') setNotizenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    assets: {
      openCreate: (defaults?: AssetsDialogDefaults) => setAssetsDialog({ defaults }),
      openEdit: (record: Assets) => setAssetsDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Assets) => detailAssets(record, false),
    },
    teams: {
      openCreate: (defaults?: TeamsDialogDefaults) => setTeamsDialog({ defaults }),
      openEdit: (record: Teams) => setTeamsDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Teams) => detailTeams(record, false),
    },
    mitarbeitende: {
      openCreate: (defaults?: MitarbeitendeDialogDefaults) => setMitarbeitendeDialog({ defaults }),
      openEdit: (record: Mitarbeitende) => setMitarbeitendeDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Mitarbeitende) => detailMitarbeitende(record, false),
    },
    tickets: {
      openCreate: (defaults?: TicketsDialogDefaults) => setTicketsDialog({ defaults }),
      openEdit: (record: Tickets) => setTicketsDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Tickets) => detailTickets(record, false),
    },
    notizen: {
      openCreate: (defaults?: NotizenDialogDefaults) => setNotizenDialog({ defaults }),
      openEdit: (record: Notizen) => setNotizenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Notizen) => detailNotizen(record, false),
    },
    enriched: { assets: data.assets, teams: enrichedTeams, mitarbeitende: enrichedMitarbeitende, tickets: enrichedTickets, notizen: enrichedNotizen },
  };
}
