import type { EnrichedMitarbeitende, EnrichedNotizen, EnrichedTeams, EnrichedTickets } from '@/types/enriched';
import type { Assets, Mitarbeitende, Notizen, Teams, Tickets } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface TeamsMaps {
  mitarbeitendeMap: Map<string, Mitarbeitende>;
}

export function enrichTeams(
  teams: Teams[],
  maps: TeamsMaps
): EnrichedTeams[] {
  return teams.map(r => ({
    ...r,
    leadName: resolveDisplay(r.fields.lead, maps.mitarbeitendeMap, 'first_name', 'last_name'),
  }));
}

interface MitarbeitendeMaps {
  teamsMap: Map<string, Teams>;
}

export function enrichMitarbeitende(
  mitarbeitende: Mitarbeitende[],
  maps: MitarbeitendeMaps
): EnrichedMitarbeitende[] {
  return mitarbeitende.map(r => ({
    ...r,
    teamName: resolveDisplay(r.fields.team, maps.teamsMap, 'name'),
  }));
}

interface TicketsMaps {
  mitarbeitendeMap: Map<string, Mitarbeitende>;
  teamsMap: Map<string, Teams>;
  ticketsMap: Map<string, Tickets>;
  assetsMap: Map<string, Assets>;
}

export function enrichTickets(
  tickets: Tickets[],
  maps: TicketsMaps
): EnrichedTickets[] {
  return tickets.map(r => ({
    ...r,
    assigned_agentName: resolveDisplay(r.fields.assigned_agent, maps.mitarbeitendeMap, 'first_name', 'last_name'),
    teamName: resolveDisplay(r.fields.team, maps.teamsMap, 'name'),
    parent_ticketName: resolveDisplay(r.fields.parent_ticket, maps.ticketsMap, 'title'),
    affected_assetName: resolveDisplay(r.fields.affected_asset, maps.assetsMap, 'name'),
  }));
}

interface NotizenMaps {
  ticketsMap: Map<string, Tickets>;
}

export function enrichNotizen(
  notizen: Notizen[],
  maps: NotizenMaps
): EnrichedNotizen[] {
  return notizen.map(r => ({
    ...r,
    ticketName: resolveDisplay(r.fields.ticket, maps.ticketsMap, 'title'),
  }));
}
