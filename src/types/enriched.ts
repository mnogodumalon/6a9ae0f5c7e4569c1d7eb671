import type { Mitarbeitende, Notizen, Teams, Tickets } from './app';

export type EnrichedTeams = Teams & {
  leadName: string;
};

export type EnrichedMitarbeitende = Mitarbeitende & {
  teamName: string;
};

export type EnrichedTickets = Tickets & {
  assigned_agentName: string;
  teamName: string;
  parent_ticketName: string;
  affected_assetName: string;
};

export type EnrichedNotizen = Notizen & {
  ticketName: string;
};
