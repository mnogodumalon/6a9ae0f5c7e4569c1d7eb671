import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { LOOKUP_OPTIONS, lookupOption, APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { formatDateTime } from '@/lib/formatters';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { Button } from '@/components/ui/button';
import {
  IconAlertTriangle,
  IconTicket,
  IconClock,
  IconUserOff,
  IconCircleCheck,
  IconPlus,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { format, parseISO, isBefore, isToday } from 'date-fns';
import type { EnrichedTickets } from '@/types/enriched';

function priorityTone(key: string | undefined): KanbanTone {
  if (key === 'critical') return 'destructive';
  if (key === 'high') return 'warning';
  if (key === 'medium') return 'primary';
  return 'default';
}

function statusTone(key: string | undefined): KanbanTone {
  if (key === 'new') return 'warning';
  if (key === 'in_progress') return 'primary';
  if (key === 'waiting_for_customer') return 'default';
  if (key === 'resolved') return 'success';
  if (key === 'closed') return 'default';
  return 'default';
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    tickets, setTickets, mitarbeitende, mitarbeitendeMap, teamsMap, ticketsMap, assetsMap, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'tickets') return undefined;
      const t = top.record as EnrichedTickets;
      const status = lookupKey(t.fields.status);
      if (status === 'new') {
        return {
          label: tx('In Bearbeitung nehmen'),
          onClick: () => advanceTicket(t, 'in_progress'),
        };
      }
      if (status === 'in_progress') {
        return {
          label: tx('Als gelöst markieren'),
          onClick: () => advanceTicket(t, 'resolved'),
        };
      }
      if (status === 'resolved') {
        return {
          label: tx('Schließen'),
          onClick: () => advanceTicket(t, 'closed'),
        };
      }
      return undefined;
    },
  });

  const enrichedTickets = crud.enriched.tickets;

  const todayKey = format(clock, 'yyyy-MM-dd');
  const todayDateTimeKey = format(clock, "yyyy-MM-dd'T'HH:mm");

  // Overdue = not closed/resolved AND due is in the past
  const overdueTickets = useMemo(() => {
    return enrichedTickets.filter(t => {
      const status = lookupKey(t.fields.status);
      if (status === 'closed' || status === 'resolved') return false;
      if (!t.fields.due) return false;
      return t.fields.due < todayDateTimeKey;
    }).sort((a, b) => (a.fields.due ?? '').localeCompare(b.fields.due ?? ''));
  }, [enrichedTickets, todayDateTimeKey]);

  // Unassigned = no agent AND not closed/resolved
  const unassignedTickets = useMemo(() => {
    return enrichedTickets.filter(t => {
      const status = lookupKey(t.fields.status);
      if (status === 'closed' || status === 'resolved') return false;
      return !t.fields.assigned_agent;
    });
  }, [enrichedTickets]);

  // Critical + overdue for hero
  const criticalOverdue = useMemo(() => {
    return overdueTickets.filter(t => lookupKey(t.fields.priority) === 'critical');
  }, [overdueTickets]);

  // New tickets (for strip)
  const newTickets = useMemo(() => enrichedTickets.filter(t => lookupKey(t.fields.status) === 'new'), [enrichedTickets]);
  const openTickets = useMemo(() => enrichedTickets.filter(t => {
    const s = lookupKey(t.fields.status);
    return s !== 'closed' && s !== 'resolved';
  }), [enrichedTickets]);

  // Advance ticket status helper (shared by board, list, overlay footer)
  async function advanceTicket(ticket: EnrichedTickets, newStatus: string) {
    const oldStatus = ticket.fields.status;
    const newLookup = lookupOption('tickets', 'status', newStatus);
    const snapshot = tickets.map(t => t.record_id === ticket.record_id
      ? { ...t, fields: { ...t.fields, status: oldStatus } }
      : t
    );
    setTickets(tickets.map(t => t.record_id === ticket.record_id
      ? { ...t, fields: { ...t.fields, status: newLookup } }
      : t
    ));
    undoToast(
      tx`${ticket.fields.title ?? ''} — ${newLookup.label}`,
      async () => {
        setTickets(snapshot);
        await LivingAppsService.updateTicket(ticket.record_id, { status: oldStatus ? lookupKey(oldStatus) : undefined });
        fetchAll();
      }
    );
    try {
      await LivingAppsService.updateTicket(ticket.record_id, { status: newStatus });
    } catch {
      setTickets(snapshot);
      fetchAll();
    }
  }

  // Columns from schema — INSIDE component body (locale-aware getters)
  const columns = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).map(o => ({
      key: o.key,
      label: o.label,
      tone: statusTone(o.key),
    })),
    []
  );

  // Map tickets → kanban cards
  const cards = useMemo<KanbanCard[]>(
    () => enrichedTickets.map(t => {
      const status = lookupKey(t.fields.status) ?? columns[1]?.key ?? 'new';
      const priority = lookupKey(t.fields.priority);
      const isOverdue = t.fields.due && t.fields.due < todayDateTimeKey
        && status !== 'closed' && status !== 'resolved';
      return {
        id: `ticket:${t.record_id}`,
        column: status,
        title: t.fields.title ?? tx('Ohne Titel'),
        subtitle: (
          <span className="flex flex-col gap-0.5">
            {t.assigned_agentName && (
              <span className="text-muted-foreground truncate">{t.assigned_agentName}</span>
            )}
            {t.fields.due && (
              <span className={isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                {formatDateTime(t.fields.due)}
              </span>
            )}
            {t.fields.reporter_name && (
              <span className="text-muted-foreground truncate">{t.fields.reporter_name}</span>
            )}
          </span>
        ),
        tone: isOverdue ? 'destructive' : priorityTone(priority),
      };
    }).sort((a, b) => {
      // Sort by tone severity (destructive first), then by due date
      const toneOrder: Record<string, number> = { destructive: 0, warning: 1, primary: 2, success: 3, default: 4 };
      return (toneOrder[a.tone ?? 'default'] ?? 4) - (toneOrder[b.tone ?? 'default'] ?? 4);
    }),
    [enrichedTickets, todayDateTimeKey, columns]
  );

  // Card move handler — optimistic write
  async function handleCardMove(cardId: string, newColumn: string) {
    const ticketId = cardId.split(':')[1] ?? '';
    const ticket = tickets.find(t => t.record_id === ticketId);
    if (!ticket) return;
    const oldStatus = ticket.fields.status;
    const newLookup = lookupOption('tickets', 'status', newColumn);
    const snapshot = [...tickets];
    setTickets(tickets.map(t => t.record_id === ticketId
      ? { ...t, fields: { ...t.fields, status: newLookup } }
      : t
    ));
    undoToast(
      tx`${ticket.fields.title ?? ''} — ${newLookup.label}`,
      async () => {
        setTickets(snapshot);
        await LivingAppsService.updateTicket(ticketId, { status: oldStatus ? lookupKey(oldStatus) : undefined });
        fetchAll();
      }
    );
    try {
      await LivingAppsService.updateTicket(ticketId, { status: newColumn });
    } catch {
      setTickets(snapshot);
      fetchAll();
    }
  }

  // Context line: names people / counts
  const contextLine = useMemo(() => {
    const overdueCnt = overdueTickets.length;
    const newCnt = newTickets.length;
    const unassignedCnt = unassignedTickets.length;
    const agentNames = [...new Set(
      enrichedTickets
        .filter(t => lookupKey(t.fields.status) === 'in_progress' && t.assigned_agentName)
        .map(t => t.assigned_agentName)
    )].slice(0, 3);

    if (overdueCnt > 0 && unassignedCnt > 0) {
      return tx`${overdueCnt} überfällige und ${unassignedCnt} nicht zugewiesene Tickets brauchen Aufmerksamkeit.`;
    }
    if (overdueCnt > 0) {
      return tx`${overdueCnt} Tickets sind überfällig.`;
    }
    if (newCnt > 0 && agentNames.length > 0) {
      return tx`${newCnt} neue Tickets — ${namen(agentNames)} sind aktiv.`;
    }
    if (newCnt > 0) {
      return tx`${newCnt} neue Tickets warten auf Zuweisung.`;
    }
    if (agentNames.length > 0) {
      return tx`${namen(agentNames)} bearbeiten aktive Tickets.`;
    }
    return tx('Alle Tickets sind auf dem aktuellen Stand.');
  }, [overdueTickets.length, newTickets.length, unassignedTickets.length, enrichedTickets]);

  // Active agent for helpdesk context
  const activeAgents = useMemo(() => {
    return mitarbeitende.filter(m => m.fields.active !== false);
  }, [mitarbeitende]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{contextLine}</p>
        </div>
        <Button
          onClick={() => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: format(clock, 'yyyy-MM-dd') })}
          className="shrink-0 flex items-center gap-2"
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neues Ticket')}
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={criticalOverdue.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: tx('In Bearbeitung nehmen'),
              onClick: () => advanceTicket(criticalOverdue[0], 'in_progress'),
            }}
          >
            <b>{namen(criticalOverdue.map(t => t.fields.title ?? ''))}</b>
            {' '}{tx('— kritische Tickets überfällig seit')}{' '}
            {formatDateTime(criticalOverdue[0].fields.due)}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={openTickets.length}
              icon={<IconTicket size={16} className="shrink-0" />}
              tone={openTickets.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Neu')}
              value={newTickets.length}
              icon={<IconPlus size={16} className="shrink-0" />}
              tone={newTickets.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={overdueTickets.length}
              icon={<IconClock size={16} className="shrink-0" />}
              tone={overdueTickets.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Nicht zugewiesen')}
              value={unassignedTickets.length}
              icon={<IconUserOff size={16} className="shrink-0" />}
              tone={unassignedTickets.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Aktive Mitarbeitende')}
              value={activeAgents.length}
              icon={<IconCircleCheck size={16} className="shrink-0" />}
              tone="default"
            />
          </StatStrip>
        }
        aside={<>
          <WorkList
            title={tx('Überfällig & heute fällig')}
            items={[...overdueTickets, ...enrichedTickets.filter(t => {
              if (overdueTickets.some(o => o.record_id === t.record_id)) return false;
              const status = lookupKey(t.fields.status);
              if (status === 'closed' || status === 'resolved') return false;
              return t.fields.due && t.fields.due.startsWith(todayKey);
            })].slice(0, 8).map(t => {
              const isOverdue = t.fields.due && t.fields.due < todayDateTimeKey;
              const status = lookupKey(t.fields.status);
              const nextStatus = status === 'new' ? 'in_progress'
                : status === 'in_progress' ? 'resolved'
                : status === 'resolved' ? 'closed'
                : null;
              return {
                id: t.record_id,
                title: t.fields.title ?? tx('Ohne Titel'),
                secondLine: (
                  <span className="flex items-center gap-1.5 min-w-0">
                    {isOverdue
                      ? <span className="font-medium text-destructive">{tx('Überfällig')}</span>
                      : <span className="font-medium text-amber-600">{tx('Heute fällig')}</span>
                    }
                    {t.fields.due && (
                      <span className="text-muted-foreground truncate">
                        {' · '}{formatDateTime(t.fields.due)}
                      </span>
                    )}
                    {t.assigned_agentName && (
                      <span className="text-muted-foreground truncate">
                        {' · '}{t.assigned_agentName}
                      </span>
                    )}
                  </span>
                ),
                action: nextStatus ? {
                  label: nextStatus === 'in_progress' ? tx('Übernehmen') : nextStatus === 'resolved' ? tx('Gelöst') : tx('Schließen'),
                  onClick: () => advanceTicket(t, nextStatus),
                } : undefined,
              };
            })}
            onItemClick={id => {
              const t = enrichedTickets.find(t => t.record_id === id);
              if (t) crud.tickets.openDetail(t);
            }}
            empty={{
              text: tx('Alles im Zeitplan — kein Ticket ist überfällig.'),
              action: {
                label: tx('Neues Ticket'),
                onClick: () => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: format(clock, 'yyyy-MM-dd') }),
              },
            }}
          />
          <WorkList
            title={tx('Nicht zugewiesen')}
            items={unassignedTickets.slice(0, 8).map(t => {
              const priority = lookupKey(t.fields.priority);
              return {
                id: t.record_id,
                title: t.fields.title ?? tx('Ohne Titel'),
                secondLine: (
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={
                      priority === 'critical' ? 'font-medium text-destructive'
                      : priority === 'high' ? 'font-medium text-amber-600'
                      : 'text-muted-foreground'
                    }>
                      {t.fields.priority?.label ?? tx('Keine Priorität')}
                    </span>
                    {t.fields.category && (
                      <span className="text-muted-foreground truncate">
                        {' · '}{t.fields.category.label}
                      </span>
                    )}
                  </span>
                ),
                action: {
                  label: tx('Zuweisen'),
                  onClick: () => crud.tickets.openEdit(t),
                },
              };
            })}
            onItemClick={id => {
              const t = enrichedTickets.find(t => t.record_id === id);
              if (t) crud.tickets.openDetail(t);
            }}
            empty={{
              text: tx('Alle Tickets sind zugewiesen.'),
            }}
          />
        </>}
        primary={
          <KanbanWidget
            columns={columns}
            cards={cards}
            defaultCollapsed={['closed']}
            onCardClick={card => {
              const ticketId = card.id.split(':')[1] ?? '';
              const t = enrichedTickets.find(t => t.record_id === ticketId);
              if (t) crud.tickets.openDetail(t);
            }}
            onCardMove={handleCardMove}
            onAddCard={columnKey =>
              crud.tickets.openCreate({
                status: columnKey,
                priority: 'medium',
                opened_on: format(clock, 'yyyy-MM-dd'),
              })
            }
          />
        }
      />
      {crud.surfaces}
    </div>
  );
}
