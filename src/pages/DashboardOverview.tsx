import { useMemo, useState, useCallback } from 'react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDate, formatDateTime } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import {
  IconAlertTriangle,
  IconCirclePlus,
  IconUserOff,
  IconClock,
  IconCheckbox,
} from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    tickets, setTickets, mitarbeitende, notizen, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'tickets') {
        const statusKey = lookupKey(top.record.fields.status);
        if (statusKey === 'new') {
          return {
            label: tx('In Bearbeitung setzen'),
            onClick: () => void advanceTicket(top.record, 'in_progress'),
          };
        }
        if (statusKey === 'in_progress') {
          return {
            label: tx('Als gelöst markieren'),
            onClick: () => void advanceTicket(top.record, 'resolved'),
          };
        }
        if (statusKey === 'resolved') {
          return {
            label: tx('Schließen'),
            onClick: () => void advanceTicket(top.record, 'closed'),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedTickets = crud.enriched.tickets;
  const enrichedMitarbeitende = crud.enriched.mitarbeitende;

  const clock = useClock();

  // Columns from schema — inside component body for locale-aware labels
  const COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).map(o => ({
      key: o.key,
      label: o.label,
      tone: o.key === 'new' ? 'warning' as const
        : o.key === 'in_progress' ? 'primary' as const
        : o.key === 'resolved' ? 'success' as const
        : 'default' as const,
    })),
    [],
  );

  // Kanban cards — sorted: critical first, then by due date
  const cards = useMemo<KanbanCard[]>(
    () =>
      enrichedTickets
        .slice()
        .sort((a, b) => {
          const priOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          const pa = priOrder[lookupKey(a.fields.priority) ?? 'low'] ?? 3;
          const pb = priOrder[lookupKey(b.fields.priority) ?? 'low'] ?? 3;
          if (pa !== pb) return pa - pb;
          return (a.fields.due ?? '').localeCompare(b.fields.due ?? '');
        })
        .map(t => {
          const statusKey = lookupKey(t.fields.status) ?? 'new';
          const priorityKey = lookupKey(t.fields.priority);
          const tone: KanbanCard['tone'] =
            priorityKey === 'critical' ? 'destructive'
            : priorityKey === 'high' ? 'warning'
            : 'default';
          return {
            id: `ticket:${t.record_id}`,
            column: statusKey,
            title: t.fields.title ?? tx('Ohne Titel'),
            subtitle: t.assigned_agentName
              ? t.assigned_agentName
              : t.fields.due
                ? formatDateTime(t.fields.due)
                : undefined,
            tone,
          };
        }),
    [enrichedTickets],
  );

  // Shared advance helper — used by hero, worklist rows, and overlay footer
  const advanceTicket = useCallback(async (ticket: typeof tickets[0], newStatus: string) => {
    const prev = ticket.fields.status;
    const prevLabel = LOOKUP_OPTIONS['tickets']?.['status']?.find(o => o.key === lookupKey(prev))?.label ?? lookupKey(prev) ?? '';
    const newLabel = LOOKUP_OPTIONS['tickets']?.['status']?.find(o => o.key === newStatus)?.label ?? newStatus;
    setTickets(prev => prev.map(t =>
      t.record_id === ticket.record_id
        ? { ...t, fields: { ...t.fields, status: lookupOption('tickets', 'status', newStatus) } }
        : t
    ));
    undoToast(
      tx`${ticket.fields.title ?? ''} — ${newLabel}`,
      async () => {
        setTickets(prev => prev.map(t =>
          t.record_id === ticket.record_id
            ? { ...t, fields: { ...t.fields, status: lookupOption('tickets', 'status', lookupKey(prev) ?? newStatus) } }
            : t
        ));
        await LivingAppsService.updateTicket(ticket.record_id, { status: lookupKey(prev) ?? newStatus }).catch(() => fetchAll());
      }
    );
    await LivingAppsService.updateTicket(ticket.record_id, { status: newStatus }).catch(() => fetchAll());
    void prevLabel; // used in undo
  }, [setTickets, fetchAll]);

  // onCardMove: optimistic + undo
  const moveCard = useCallback(async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const ticket = tickets.find(t => t.record_id === rid);
    if (!ticket) return;
    await advanceTicket(ticket, newColumn);
  }, [tickets, advanceTicket]);

  // KPIs
  const todayStr = `${clock.getFullYear()}-${String(clock.getMonth() + 1).padStart(2, '0')}-${String(clock.getDate()).padStart(2, '0')}`;
  const nowStr = `${todayStr}T${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`;

  const openTickets = useMemo(
    () => tickets.filter(t => {
      const s = lookupKey(t.fields.status);
      return s !== 'closed' && s !== 'resolved';
    }),
    [tickets]
  );

  const overdueTickets = useMemo(
    () => openTickets.filter(t => t.fields.due && t.fields.due < nowStr),
    [openTickets, nowStr]
  );

  const criticalOpen = useMemo(
    () => openTickets.filter(t => lookupKey(t.fields.priority) === 'critical'),
    [openTickets]
  );

  const unassigned = useMemo(
    () => openTickets.filter(t => !t.fields.assigned_agent),
    [openTickets]
  );

  const newToday = useMemo(
    () => tickets.filter(t => t.fields.opened_on === todayStr),
    [tickets, todayStr]
  );

  // KPI filter state
  const [filter, setFilter] = useState<'overdue' | 'critical' | 'unassigned' | null>(null);

  // Worklist: overdue + unassigned based on filter
  const worklistTickets = useMemo(() => {
    if (filter === 'overdue') return overdueTickets;
    if (filter === 'critical') return criticalOpen;
    if (filter === 'unassigned') return unassigned;
    return [...overdueTickets, ...unassigned.filter(t => !overdueTickets.find(o => o.record_id === t.record_id))]
      .slice(0, 20);
  }, [filter, overdueTickets, criticalOpen, unassigned]);

  // Active agents
  const activeAgents = useMemo(
    () => mitarbeitende.filter(m => m.fields.active !== false),
    [mitarbeitende]
  );

  // Context line naming people
  const contextLine = useMemo(() => {
    const names = enrichedMitarbeitende
      .filter(m => m.fields.active !== false)
      .slice(0, 3)
      .map(m => `${m.fields.first_name ?? ''} ${m.fields.last_name ?? ''}`.trim())
      .filter(Boolean);

    if (overdueTickets.length > 0) {
      const reporterNames = overdueTickets
        .slice(0, 2)
        .map(t => t.fields.reporter_name ?? tx('Unbekannt'))
        .filter(Boolean);
      return overdueTickets.length === 1
        ? tx`Überfälliges Ticket von ${namen(reporterNames)} — sofort handeln.`
        : tx`${overdueTickets.length} Tickets überfällig — ${namen(reporterNames)} warten auf Antwort.`;
    }
    if (newToday.length > 0) {
      return tx`${newToday.length} neue Tickets heute. ${namen(names)} im Dienst.`;
    }
    if (openTickets.length === 0) {
      return tx`Alle Tickets erledigt — ${namen(names)} im Dienst.`;
    }
    return tx`${openTickets.length} offene Tickets. ${namen(names)} im Einsatz.`;
  }, [enrichedMitarbeitende, overdueTickets, newToday, openTickets]);

  // Note count for worklist subtitle
  const notesByTicket = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notizen) {
      const tid = n.fields.ticket ? n.fields.ticket.match(/([a-f0-9]{24})$/i)?.[1] : null;
      if (tid) map.set(tid, (map.get(tid) ?? 0) + 1);
    }
    return map;
  }, [notizen]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground truncate">
            {contextLine}
          </p>
        </div>
        <button
          onClick={() => crud.tickets.openCreate({ status: 'new', priority: 'medium' })}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <IconCirclePlus size={16} className="shrink-0" />
          <span>{tx('Ticket erstellen')}</span>
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          overdueTickets.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: overdueTickets.length === 1
                  ? tx('In Bearbeitung setzen')
                  : tx('Ältestes öffnen'),
                onClick: () => {
                  if (overdueTickets.length === 1) {
                    void advanceTicket(overdueTickets[0], 'in_progress');
                  } else {
                    const oldest = overdueTickets.slice().sort((a, b) =>
                      (a.fields.due ?? '').localeCompare(b.fields.due ?? '')
                    )[0];
                    if (oldest) crud.tickets.openDetail(oldest);
                  }
                },
              }}
            >
              <b>{namen(overdueTickets.map(t => t.fields.title ?? ''))}</b>{' '}
              {overdueTickets.length === 1
                ? tx`— überfällig seit ${formatDateTime(overdueTickets[0].fields.due)}.`
                : tx`— ${overdueTickets.length} Tickets überfällig.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={openTickets.length}
              icon={<IconClock size={16} />}
              tone="default"
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={overdueTickets.length}
              icon={<IconAlertTriangle size={16} />}
              tone={overdueTickets.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilter(f => f === 'overdue' ? null : 'overdue')}
              active={filter === 'overdue'}
            />
            <StatStripItem
              title={tx('Kritisch')}
              value={criticalOpen.length}
              icon={<IconAlertTriangle size={16} />}
              tone={criticalOpen.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'critical' ? null : 'critical')}
              active={filter === 'critical'}
            />
            <StatStripItem
              title={tx('Unzugewiesen')}
              value={unassigned.length}
              icon={<IconUserOff size={16} />}
              tone={unassigned.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'unassigned' ? null : 'unassigned')}
              active={filter === 'unassigned'}
            />
            <StatStripItem
              title={tx('Heute neu')}
              value={newToday.length}
              icon={<IconCheckbox size={16} />}
              tone="default"
            />
            <StatStripItem
              title={tx('Aktive Agents')}
              value={activeAgents.length}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={COLUMNS}
            defaultCollapsed={['closed']}
            onCardClick={card => {
              const rid = card.id.split(':')[1];
              const ticket = tickets.find(t => t.record_id === rid);
              if (ticket) crud.tickets.openDetail(ticket);
            }}
            onCardMove={moveCard}
            onAddCard={column => crud.tickets.openCreate({ status: column, priority: 'medium' })}
          />
        }
        aside={
          <>
            <WorkList
              title={
                filter === 'overdue' ? tx('Überfällige Tickets')
                : filter === 'critical' ? tx('Kritische Tickets')
                : filter === 'unassigned' ? tx('Unzugewiesene Tickets')
                : tx('Handlungsbedarf')
              }
              items={worklistTickets.map(t => {
                const statusKey = lookupKey(t.fields.status);
                const priorityKey = lookupKey(t.fields.priority);
                const isOverdue = t.fields.due && t.fields.due < nowStr;
                const noteCount = notesByTicket.get(t.record_id) ?? 0;
                return {
                  id: t.record_id,
                  title: t.fields.title ?? tx('Ohne Titel'),
                  secondLine: (
                    <span className="flex flex-wrap gap-1 items-center">
                      {isOverdue && (
                        <span className="font-medium text-destructive">{tx('Überfällig')}</span>
                      )}
                      {priorityKey === 'critical' && (
                        <span className="font-medium text-amber-600">{tx('Kritisch')}</span>
                      )}
                      {!t.fields.assigned_agent && (
                        <span className="text-muted-foreground">{tx('Nicht zugewiesen')}</span>
                      )}
                      {t.fields.due && (
                        <span className="text-muted-foreground">· {formatDateTime(t.fields.due)}</span>
                      )}
                      {noteCount > 0 && (
                        <span className="text-muted-foreground">· {noteCount} {tx('Notizen')}</span>
                      )}
                      {!isOverdue && !t.fields.due && statusKey && (
                        <span className="text-muted-foreground">{t.fields.status?.label}</span>
                      )}
                    </span>
                  ),
                  action: statusKey === 'new'
                    ? { label: tx('Annehmen'), onClick: () => void advanceTicket(t, 'in_progress') }
                    : statusKey === 'in_progress'
                      ? { label: tx('Lösen'), onClick: () => void advanceTicket(t, 'resolved') }
                      : undefined,
                };
              })}
              onItemClick={id => {
                const ticket = tickets.find(t => t.record_id === id);
                if (ticket) crud.tickets.openDetail(ticket);
              }}
              empty={{
                text: openTickets.length === 0
                  ? tx('Alle Tickets erledigt — super!')
                  : tx('Kein akuter Handlungsbedarf.'),
                action: { label: tx('Ticket erstellen'), onClick: () => crud.tickets.openCreate({ status: 'new', priority: 'medium' }) },
              }}
              max={8}
            />
            <ChartWidget
              title={tx('Tickets nach Kategorie')}
              rows={tickets.map(t => ({
                id: `ticket:${t.record_id}`,
                data: t,
              }))}
              dimension={{
                kind: 'category',
                accessor: r => r.data.fields.category,
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
