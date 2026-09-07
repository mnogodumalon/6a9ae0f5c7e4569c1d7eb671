import { useMemo, useState, useCallback } from 'react';
import { format, isPast, isToday, parseISO } from 'date-fns';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDateTime } from '@/lib/formatters';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { IconAlertTriangle, IconTicket, IconClock, IconCircleCheck, IconPlayerPlay } from '@tabler/icons-react';

function toneForPriority(priority: string | undefined): KanbanTone {
  if (priority === 'critical') return 'destructive';
  if (priority === 'high') return 'warning';
  if (priority === 'medium') return 'primary';
  return 'default';
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    tickets, setTickets, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'tickets') return undefined;
      const rec = top.record;
      const status = lookupKey(rec.fields.status);
      if (status === 'new') return { label: tx('In Bearbeitung setzen'), onClick: () => void advanceStatus(rec, 'in_progress') };
      if (status === 'in_progress') return { label: tx('Als gelöst markieren'), onClick: () => void advanceStatus(rec, 'resolved') };
      if (status === 'resolved') return { label: tx('Schließen'), onClick: () => void advanceStatus(rec, 'closed') };
      return undefined;
    },
  });

  const enrichedTickets = crud.enriched.tickets;

  const clock = useClock();

  const [filterKey, setFilterKey] = useState<string | null>(null);

  // Status-Spalten aus dem Schema — im Component Body, nie als Modul-Konstante
  const COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  // Status-Fortschritt: neu → in_progress → resolved → closed
  const NEXT_STATUS: Record<string, string> = {
    new: 'in_progress',
    in_progress: 'resolved',
    resolved: 'closed',
  };

  const advanceStatus = useCallback(async (ticket: typeof tickets[0], toStatus?: string) => {
    const currentKey = lookupKey(ticket.fields.status);
    const nextKey = toStatus ?? NEXT_STATUS[currentKey ?? ''];
    if (!nextKey) return;

    const prevFields = { ...ticket.fields };
    const newLookup = lookupOption('tickets', 'status', nextKey);

    setTickets(prev =>
      prev.map(t =>
        t.record_id === ticket.record_id
          ? { ...t, fields: { ...t.fields, status: newLookup } }
          : t,
      ),
    );

    try {
      await LivingAppsService.updateTicket(ticket.record_id, { status: nextKey });
      const newLabel = newLookup.label;
      undoToast(
        tx`${ticket.fields.title ?? ''} — ${newLabel}`,
        async () => {
          setTickets(prev =>
            prev.map(t =>
              t.record_id === ticket.record_id
                ? { ...t, fields: prevFields }
                : t,
            ),
          );
          await LivingAppsService.updateTicket(ticket.record_id, { status: currentKey ?? 'new' });
        },
      );
    } catch {
      await fetchAll();
    }
  }, [setTickets, fetchAll]);

  // Überfällige und kritische Tickets
  const nowStr = format(clock, "yyyy-MM-dd'T'HH:mm");
  const openStatuses = new Set(['new', 'in_progress', 'waiting_for_customer']);

  const openTickets = useMemo(
    () => enrichedTickets.filter(t => openStatuses.has(lookupKey(t.fields.status) ?? '')),
    [enrichedTickets],
  );

  const overdueTickets = useMemo(
    () => openTickets.filter(t => {
      if (!t.fields.due) return false;
      return t.fields.due < nowStr;
    }),
    [openTickets, nowStr],
  );

  const criticalTickets = useMemo(
    () => openTickets.filter(t => lookupKey(t.fields.priority) === 'critical'),
    [openTickets],
  );

  const todayTickets = useMemo(
    () => openTickets.filter(t => {
      if (!t.fields.due) return false;
      try { return isToday(parseISO(t.fields.due)); } catch { return false; }
    }),
    [openTickets],
  );

  // Hero-Signal: Überfällige kritische Tickets
  const heroTickets = useMemo(
    () => overdueTickets.filter(t => lookupKey(t.fields.priority) === 'critical'),
    [overdueTickets],
  );

  // Kanban-Karten mit optionalem Status-Filter
  const cards = useMemo<KanbanCard[]>(() => {
    const source = filterKey
      ? enrichedTickets.filter(t => lookupKey(t.fields.category) === filterKey)
      : enrichedTickets;
    return source
      .sort((a, b) => {
        // Kritische zuerst, dann nach Fälligkeit
        const pa = lookupKey(a.fields.priority) ?? '';
        const pb = lookupKey(b.fields.priority) ?? '';
        const order = ['critical', 'high', 'medium', 'low'];
        const diff = order.indexOf(pa) - order.indexOf(pb);
        if (diff !== 0) return diff;
        return (a.fields.due ?? '').localeCompare(b.fields.due ?? '');
      })
      .map(t => {
        const statusKey = lookupKey(t.fields.status) ?? '';
        const priorityKey = lookupKey(t.fields.priority);
        const isOverdue = t.fields.due && t.fields.due < nowStr && openStatuses.has(statusKey);
        return {
          id: `ticket:${t.record_id}`,
          column: statusKey,
          title: t.fields.title ?? tx('Ohne Titel'),
          subtitle: (
            <span className="flex flex-col gap-0.5">
              {t.assigned_agentName ? (
                <span className="truncate text-xs text-muted-foreground">{t.assigned_agentName}</span>
              ) : null}
              {t.fields.due ? (
                <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {isOverdue ? tx('Überfällig') : ''}{isOverdue ? ' · ' : ''}{formatDateTime(t.fields.due)}
                </span>
              ) : null}
            </span>
          ),
          tone: isOverdue ? 'destructive' : toneForPriority(priorityKey),
        };
      });
  }, [enrichedTickets, filterKey, nowStr]);

  const moveCard = useCallback(async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const ticket = tickets.find(t => t.record_id === rid);
    if (!ticket) return;

    const prevFields = { ...ticket.fields };
    const newLookup = lookupOption('tickets', 'status', newColumn);

    setTickets(prev =>
      prev.map(t =>
        t.record_id === rid
          ? { ...t, fields: { ...t.fields, status: newLookup } }
          : t,
      ),
    );

    try {
      await LivingAppsService.updateTicket(rid, { status: newColumn });
      undoToast(
        tx`${ticket.fields.title ?? ''} — ${newLookup.label}`,
        async () => {
          setTickets(prev =>
            prev.map(t =>
              t.record_id === rid
                ? { ...t, fields: prevFields }
                : t,
            ),
          );
          await LivingAppsService.updateTicket(rid, { status: lookupKey(prevFields.status) ?? 'new' });
        },
      );
    } catch {
      await fetchAll();
    }
  }, [tickets, setTickets, fetchAll]);

  // Kontext-Zeile
  const contextLine = useMemo(() => {
    if (overdueTickets.length > 0) {
      const names = namen(overdueTickets.map(t => t.fields.reporter_name ?? t.fields.title ?? ''));
      return overdueTickets.length === 1
        ? tx`Überfällig: ${names} — sofort handeln.`
        : tx`${String(overdueTickets.length)} überfällige Tickets, darunter ${names}.`;
    }
    if (openTickets.length === 0) return tx('Alle Tickets erledigt — super!');
    if (todayTickets.length > 0) {
      return tx`${String(todayTickets.length)} Tickets heute fällig.`;
    }
    return tx`${String(openTickets.length)} offene Tickets in Bearbeitung.`;
  }, [overdueTickets, openTickets, todayTickets]);

  const heroAgent = heroTickets[0];

  // Chart-Reihen für Kategorie-Verteilung
  const chartRows = useMemo(
    () => openTickets.map(t => ({ id: `ticket:${t.record_id}`, data: t })),
    [openTickets],
  );

  return (
    <div className="space-y-6">
      {/* Seiten-Kopf */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
            {gruss(clock)}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.tickets.openCreate({ status: 'new', priority: 'medium' })}
          className="mt-2 sm:mt-0 inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconTicket size={16} className="shrink-0" />
          {tx('Neues Ticket')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          heroAgent ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('In Bearbeitung setzen'),
                onClick: () => void advanceStatus(heroAgent, 'in_progress'),
              }}
            >
              <b>{namen(heroTickets.map(t => t.fields.title ?? ''))}</b>{' '}
              {heroTickets.length === 1
                ? tx('— kritisches Ticket ist überfällig.')
                : tx`— ${String(heroTickets.length)} kritische Tickets sind überfällig.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={openTickets.length}
              icon={<IconTicket size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title={tx('Kritisch')}
              value={criticalTickets.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={criticalTickets.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilterKey(k => k === 'critical_prio' ? null : 'critical_prio')}
              active={filterKey === 'critical_prio'}
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={overdueTickets.length}
              icon={<IconClock size={16} className="shrink-0" />}
              tone={overdueTickets.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Heute fällig')}
              value={todayTickets.length}
              icon={<IconCircleCheck size={16} className="shrink-0" />}
              tone={todayTickets.length > 0 ? 'primary' : 'default'}
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
          >
            {filterKey && (
              <div className="flex items-center gap-2 pb-2">
                <span className="text-xs text-muted-foreground">
                  {tx('Gefiltert nach Kategorie')}
                </span>
                <button
                  onClick={() => setFilterKey(null)}
                  className="text-xs text-primary hover:underline"
                >
                  {tx('Filter aufheben')}
                </button>
              </div>
            )}
          </KanbanWidget>
        }
        aside={
          <>
            <WorkList
              title={tx('Kritisch & überfällig')}
              items={[...criticalTickets, ...overdueTickets]
                .filter((t, i, arr) => arr.findIndex(x => x.record_id === t.record_id) === i)
                .slice(0, 8)
                .map(t => {
                  const statusKey = lookupKey(t.fields.status);
                  const isOverdue = t.fields.due && t.fields.due < nowStr;
                  return {
                    id: t.record_id,
                    title: t.fields.title ?? tx('Ohne Titel'),
                    secondLine: (
                      <>
                        {isOverdue && (
                          <span className="font-medium text-destructive">{tx('Überfällig')}</span>
                        )}
                        {isOverdue && t.assigned_agentName && <span className="text-muted-foreground"> · </span>}
                        {t.assigned_agentName && (
                          <span className="text-muted-foreground">{t.assigned_agentName}</span>
                        )}
                        {!t.assigned_agentName && !isOverdue && (
                          <span className="text-amber-600">{tx('Nicht zugewiesen')}</span>
                        )}
                      </>
                    ),
                    action: statusKey && NEXT_STATUS[statusKey]
                      ? {
                          label: statusKey === 'new' ? tx('Annehmen') : tx('Weiter'),
                          onClick: () => void advanceStatus(t),
                          icon: <IconPlayerPlay size={14} className="shrink-0" />,
                        }
                      : undefined,
                  };
                })}
              onItemClick={id => {
                const ticket = tickets.find(t => t.record_id === id);
                if (ticket) crud.tickets.openDetail(ticket);
              }}
              empty={{
                text: tx('Keine kritischen oder überfälligen Tickets — alles im Griff!'),
                action: {
                  label: tx('Neues Ticket'),
                  onClick: () => crud.tickets.openCreate({ status: 'new', priority: 'medium' }),
                },
              }}
            />
            <ChartWidget
              title={tx('Offene Tickets nach Kategorie')}
              rows={chartRows}
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
