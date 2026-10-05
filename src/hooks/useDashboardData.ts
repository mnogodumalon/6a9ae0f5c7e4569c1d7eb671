import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Assets, Teams, Mitarbeitende, Tickets, Notizen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { t } from '@/i18n';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
/** Entities this hook can load — the same keys the journey layer uses. */
export type DashboardEntity = 'assets' | 'teams' | 'mitarbeitende' | 'tickets' | 'notizen';

export interface DashboardDataOptions {
  /** Entities this page does NOT need (picked through useRecordSearch instead).
   *  Every flow page mounts this hook on its own route, so without `omit` a
   *  page that searches 3.000 guests server-side would still pull all 3.000
   *  through the side door. */
  omit?: DashboardEntity[];
}

export function useDashboardData(options: DashboardDataOptions = {}) {
  // A string key, not the array: an inline `omit={['gaeste']}` is a new array
  // on every render and would restart the fetch forever.
  const omitKey = (options.omit ?? []).slice().sort().join('|');
  const [assets, setAssets] = useState<Assets[]>([]);
  const [teams, setTeams] = useState<Teams[]>([]);
  const [mitarbeitende, setMitarbeitende] = useState<Mitarbeitende[]>([]);
  const [tickets, setTickets] = useState<Tickets[]>([]);
  const [notizen, setNotizen] = useState<Notizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  /** Lists the signed-in user may not read (403 on the platform). They load as
   *  empty and the rest of the page loads normally — one forbidden list used to
   *  empty the whole dashboard (05.10.2026). Hide a block whose list is here. */
  const [forbidden, setForbidden] = useState<DashboardEntity[]>([]);

  // Every list on its own: a 403 is „not yours“, any other failure is an error.
  const settle = useCallback((settled: PromiseSettledResult<unknown>[]) => {
    const denied: DashboardEntity[] = [];
    let failure: unknown = null;
    // null = this list failed for another reason: its current data stays
    const pick = <T,>(i: number, key: DashboardEntity): T[] | null => {
      const s = settled[i];
      if (s.status === 'fulfilled') return s.value as T[];
      if ((s.reason as { status?: number } | null)?.status === 403) { denied.push(key); return []; }
      failure = failure ?? s.reason;
      return null;
    };
    { const rows = pick<Assets>(0, 'assets'); if (rows) setAssets(rows); }
    { const rows = pick<Teams>(1, 'teams'); if (rows) setTeams(rows); }
    { const rows = pick<Mitarbeitende>(2, 'mitarbeitende'); if (rows) setMitarbeitende(rows); }
    { const rows = pick<Tickets>(3, 'tickets'); if (rows) setTickets(rows); }
    { const rows = pick<Notizen>(4, 'notizen'); if (rows) setNotizen(rows); }
    setForbidden(prev => (prev.join('|') === denied.join('|') ? prev : denied));
    return failure;
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    const omit = new Set(omitKey ? omitKey.split('|') : []);
    try {
      const failure = settle(await Promise.allSettled([
        omit.has('assets') ? Promise.resolve([] as Assets[]) : LivingAppsService.getAssets(),
        omit.has('teams') ? Promise.resolve([] as Teams[]) : LivingAppsService.getTeams(),
        omit.has('mitarbeitende') ? Promise.resolve([] as Mitarbeitende[]) : LivingAppsService.getMitarbeitende(),
        omit.has('tickets') ? Promise.resolve([] as Tickets[]) : LivingAppsService.getTickets(),
        omit.has('notizen') ? Promise.resolve([] as Notizen[]) : LivingAppsService.getNotizen(),
      ]));
      if (failure) throw failure;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t('data_load_failed')));
    } finally {
      setLoading(false);
    }
  }, [omitKey, settle]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    const omit = new Set(omitKey ? omitKey.split('|') : []);
    async function silentRefresh() {
      try {
        // a failed list keeps its stale data out of the way: settle() only
        // replaces what loaded or was refused
        settle(await Promise.allSettled([
          omit.has('assets') ? Promise.resolve([] as Assets[]) : LivingAppsService.getAssets(),
          omit.has('teams') ? Promise.resolve([] as Teams[]) : LivingAppsService.getTeams(),
          omit.has('mitarbeitende') ? Promise.resolve([] as Mitarbeitende[]) : LivingAppsService.getMitarbeitende(),
          omit.has('tickets') ? Promise.resolve([] as Tickets[]) : LivingAppsService.getTickets(),
          omit.has('notizen') ? Promise.resolve([] as Notizen[]) : LivingAppsService.getNotizen(),
        ]));
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    // assistant:data-changed comes from the assistant (<la-klar-assistant>)
    // after every mutation. The element additionally fires the legacy
    // dashboard-refresh event for OLD deployed bundles — do NOT subscribe to
    // both here, or every mutation fetches twice.
    window.addEventListener('assistant:data-changed', handleRefresh);
    return () => window.removeEventListener('assistant:data-changed', handleRefresh);
  }, [omitKey, settle]);

  const assetsMap = useMemo(() => {
    const m = new Map<string, Assets>();
    assets.forEach(r => m.set(r.record_id, r));
    return m;
  }, [assets]);

  const teamsMap = useMemo(() => {
    const m = new Map<string, Teams>();
    teams.forEach(r => m.set(r.record_id, r));
    return m;
  }, [teams]);

  const mitarbeitendeMap = useMemo(() => {
    const m = new Map<string, Mitarbeitende>();
    mitarbeitende.forEach(r => m.set(r.record_id, r));
    return m;
  }, [mitarbeitende]);

  const ticketsMap = useMemo(() => {
    const m = new Map<string, Tickets>();
    tickets.forEach(r => m.set(r.record_id, r));
    return m;
  }, [tickets]);

  return { assets, setAssets, teams, setTeams, mitarbeitende, setMitarbeitende, tickets, setTickets, notizen, setNotizen, loading, error, fetchAll, forbidden, assetsMap, teamsMap, mitarbeitendeMap, ticketsMap };
}

/** The hook's return — the `data` prop of DashboardOverview in the Ready-Wrapper form. */
export type DashboardData = ReturnType<typeof useDashboardData>;