import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { formatDateTime } from '@/lib/formatters';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { useMemo, useState } from 'react';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import {
  IconAlertTriangle,
  IconTicket,
  IconClockHour4,
  IconUserQuestion,
  IconCircleCheck,
  IconPlus,
} from '@tabler/icons-react';

function priorityTone(priority: string | undefined): KanbanTone {
  if (priority === 'critical') return 'destructive';
  if (priority === 'high') return 'warning';
  if (priority === 'medium') return 'primary';
  return 'default';
}

function statusTone(status: string | undefined): KanbanTone {
  if (status === 'new') return 'warning';
  if (status === 'in_progress') return 'primary';
  if (status === 'waiting_for_customer') return 'default';
  if (status === 'resolved') return 'success';
  if (status === 'closed') return 'default';
  return 'default';
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    tickets, setTickets,
    mitarbeitende,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'tickets') return undefined;
      const t = top.record;
      const status = lookupKey(t.fields.status);
      if (status === 'new') return { label: tx('Übernehmen'), onClick: () => advanceStatus(t.record_id, 'in_progress', t) };
      if (status === 'in_progress') return { label: tx('Als gelöst markieren'), onClick: () => advanceStatus(t.record_id, 'resolved', t) };
      if (status === 'waiting_for_customer') return { label: tx('In Bearbeitung'), onClick: () => advanceStatus(t.record_id, 'in_progress', t) };
      if (status === 'resolved') return { label: tx('Schließen'), onClick: () => advanceStatus(t.record_id, 'closed', t) };
      return undefined;
    },
  });

  const enrichedTickets = crud.enriched.tickets;

  const clock = useClock();

  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Computed KPIs
  const openTickets = useMemo(
    () => enrichedTickets.filter(t => !['closed', 'resolved'].includes(lookupKey(t.fields.status) ?? '')),
    [enrichedTickets],
  );

  const overdueTickets = useMemo(
    () => openTickets.filter(t => t.fields.due && new Date(t.fields.due) < clock),
    [openTickets, clock],
  );

  const unassignedTickets = useMemo(
    () => openTickets.filter(t => !t.fields.assigned_agent),
    [openTickets],
  );

  const newTickets = useMemo(
    () => enrichedTickets.filter(t => lookupKey(t.fields.status) === 'new'),
    [enrichedTickets],
  );

  const criticalTickets = useMemo(
    () => openTickets.filter(t => lookupKey(t.fields.priority) === 'critical'),
    [openTickets],
  );

  const activeAgents = useMemo(
    () => mitarbeitende.filter(a => a.fields.active !== false),
    [mitarbeitende],
  );

  // Shared advance-status helper (used by footer, WorkList actions, HeroBanner)
  const advanceStatus = async (
    recordId: string,
    newStatus: string,
    record: typeof tickets[0],
  ) => {
    const prev = record.fields.status;
    setTickets(prev2 =>
      prev2.map(t =>
        t.record_id === recordId
          ? { ...t, fields: { ...t.fields, status: lookupOption('tickets', 'status', newStatus) } }
          : t,
      ),
    );
    try {
      await LivingAppsService.updateTicket(recordId, { status: newStatus });
      const col = (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).find(o => o.key === newStatus);
      undoToast(
        tx`Ticket — ${col?.label ?? newStatus}`,
        async () => {
          setTickets(prev2 =>
            prev2.map(t =>
              t.record_id === recordId
                ? { ...t, fields: { ...t.fields, status: prev } }
                : t,
            ),
          );
          await LivingAppsService.updateTicket(recordId, { status: lookupKey(prev) ?? '' });
        },
      );
    } catch {
      await fetchAll();
    }
  };

  // Kanban setup — inside component body (locale-aware getters)
  const COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  const filteredTickets = useMemo(
    () => filterStatus ? enrichedTickets.filter(t => lookupKey(t.fields.status) === filterStatus) : enrichedTickets,
    [enrichedTickets, filterStatus],
  );

  const cards = useMemo<KanbanCard[]>(
    () =>
      filteredTickets.map(t => {
        const status = lookupKey(t.fields.status) ?? 'new';
        const priority = lookupKey(t.fields.priority);
        return {
          id: `ticket:${t.record_id}`,
          column: status,
          title: t.fields.title ?? tx('Ohne Titel'),
          subtitle: t.assigned_agentName
            ? tx`${t.assigned_agentName}`
            : tx('Nicht zugewiesen'),
          tone: priorityTone(priority),
        };
      }),
    [filteredTickets],
  );

  const moveCard = async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const record = tickets.find(t => t.record_id === rid);
    if (!record) return;
    const prevStatus = record.fields.status;
    setTickets(prev =>
      prev.map(t =>
        t.record_id === rid
          ? { ...t, fields: { ...t.fields, status: lookupOption('tickets', 'status', newColumn) } }
          : t,
      ),
    );
    try {
      await LivingAppsService.updateTicket(rid, { status: newColumn });
      const col = (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).find(o => o.key === newColumn);
      undoToast(
        tx`Ticket — ${col?.label ?? newColumn}`,
        async () => {
          setTickets(prev =>
            prev.map(t =>
              t.record_id === rid
                ? { ...t, fields: { ...t.fields, status: prevStatus } }
                : t,
            ),
          );
          await LivingAppsService.updateTicket(rid, { status: lookupKey(prevStatus) ?? '' });
        },
      );
    } catch {
      await fetchAll();
    }
  };

  // Context line — humanized
  const contextLine = useMemo(() => {
    if (openTickets.length === 0) return tx('Alle Tickets abgeschlossen — gute Arbeit!');
    if (overdueTickets.length > 0) {
      const names = overdueTickets.map(t => t.fields.reporter_name ?? t.fields.title ?? '').filter(Boolean);
      return tx`${namen(names)} — ${overdueTickets.length === 1 ? tx('Ticket überfällig') : tx('Tickets überfällig')}`;
    }
    if (unassignedTickets.length > 0) {
      return tx`${unassignedTickets.length === 1 ? tx('1 Ticket wartet auf Zuweisung') : tx`${String(unassignedTickets.length)} Tickets warten auf Zuweisung`}`;
    }
    return tx`${String(openTickets.length)} ${openTickets.length === 1 ? tx('offenes Ticket') : tx('offene Tickets')}`;
  }, [openTickets, overdueTickets, unassignedTickets]);

  const firstOverdue = overdueTickets[0];
  const firstOverdueRaw = firstOverdue ? tickets.find(t => t.record_id === firstOverdue.record_id) : undefined;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.tickets.openCreate({ status: 'new', priority: 'medium' })}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neues Ticket')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          overdueTickets.length > 0 && firstOverdueRaw ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('Jetzt bearbeiten'),
                onClick: () => advanceStatus(firstOverdueRaw.record_id, 'in_progress', firstOverdueRaw),
              }}
            >
              <b>{namen(overdueTickets.map(t => t.fields.reporter_name ?? t.fields.title ?? '').filter(Boolean))}</b>
              {' '}{overdueTickets.length === 1 ? tx('— Ticket überfällig seit') : tx('— Tickets überfällig, ältestes seit')}{' '}
              {formatDateTime(firstOverdue?.fields.due)}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={openTickets.length}
              icon={<IconTicket size={16} className="shrink-0" />}
              tone={openTickets.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={overdueTickets.length}
              icon={<IconClockHour4 size={16} className="shrink-0" />}
              tone={overdueTickets.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilterStatus(f => f === 'waiting_for_customer' ? null : 'waiting_for_customer')}
              active={filterStatus === 'waiting_for_customer'}
            />
            <StatStripItem
              title={tx('Ohne Zuweisung')}
              value={unassignedTickets.length}
              icon={<IconUserQuestion size={16} className="shrink-0" />}
              tone={unassignedTickets.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Kritisch')}
              value={criticalTickets.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={criticalTickets.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Agents aktiv')}
              value={activeAgents.length}
              icon={<IconCircleCheck size={16} className="shrink-0" />}
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
              const record = tickets.find(t => t.record_id === rid);
              if (record) crud.tickets.openDetail(record);
            }}
            onCardMove={moveCard}
            onAddCard={column => crud.tickets.openCreate({ status: column, priority: 'medium' })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Neu & nicht zugewiesen')}
              items={unassignedTickets.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.title ?? tx('Ohne Titel'),
                secondLine: (
                  <>
                    <span
                      className={
                        lookupKey(t.fields.priority) === 'critical'
                          ? 'font-medium text-destructive'
                          : lookupKey(t.fields.priority) === 'high'
                          ? 'font-medium text-amber-600'
                          : 'text-muted-foreground'
                      }
                    >
                      {t.fields.priority?.label ?? tx('Keine Priorität')}
                    </span>
                    {t.fields.category && (
                      <span className="text-muted-foreground"> · {t.fields.category.label}</span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Übernehmen'),
                  onClick: () => {
                    const raw = tickets.find(r => r.record_id === t.record_id);
                    if (raw) advanceStatus(raw.record_id, 'in_progress', raw);
                  },
                },
              }))}
              onItemClick={id => {
                const record = tickets.find(t => t.record_id === id);
                if (record) crud.tickets.openDetail(record);
              }}
              empty={{
                text: tx('Alle Tickets sind zugewiesen — super!'),
                action: {
                  label: tx('Neues Ticket'),
                  onClick: () => crud.tickets.openCreate({ status: 'new', priority: 'medium' }),
                },
              }}
            />
            <WorkList
              title={tx('Kritisch & in Bearbeitung')}
              items={criticalTickets
                .filter(t => lookupKey(t.fields.status) === 'in_progress')
                .slice(0, 8)
                .map(t => ({
                  id: t.record_id,
                  title: t.fields.title ?? tx('Ohne Titel'),
                  secondLine: (
                    <>
                      <span className="font-medium text-destructive">{tx('Kritisch')}</span>
                      {t.assigned_agentName && (
                        <span className="text-muted-foreground"> · {t.assigned_agentName}</span>
                      )}
                      {t.fields.due && (
                        <span className="text-muted-foreground"> · {tx('Fällig')}: {formatDateTime(t.fields.due)}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Gelöst'),
                    onClick: () => {
                      const raw = tickets.find(r => r.record_id === t.record_id);
                      if (raw) advanceStatus(raw.record_id, 'resolved', raw);
                    },
                  },
                }))}
              onItemClick={id => {
                const record = tickets.find(t => t.record_id === id);
                if (record) crud.tickets.openDetail(record);
              }}
              empty={{
                text: newTickets.length > 0
                  ? tx`${String(newTickets.length)} ${newTickets.length === 1 ? tx('neues Ticket wartet') : tx('neue Tickets warten')}`
                  : tx('Keine kritischen Tickets in Bearbeitung'),
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
