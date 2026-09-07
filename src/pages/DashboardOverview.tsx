import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { lookupKey, formatDateTime } from '@/lib/formatters';
import { lookupOption, LOOKUP_OPTIONS, APP_IDS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { useMemo } from 'react';
import { format, isBefore, parseISO } from 'date-fns';
import {
  IconAlertTriangle,
  IconTicket,
  IconPlayerPlay,
  IconHourglass,
  IconUserQuestion,
  IconCircleCheck,
} from '@tabler/icons-react';

// Status-Reihenfolge im Workflow
const STATUS_NEXT: Record<string, string> = {
  new: 'in_progress',
  in_progress: 'resolved',
  waiting_for_customer: 'in_progress',
  resolved: 'closed',
};

function toneForStatus(status: string | undefined): KanbanTone {
  if (status === 'new') return 'warning';
  if (status === 'in_progress') return 'primary';
  if (status === 'waiting_for_customer') return 'warning';
  if (status === 'resolved') return 'success';
  return 'default'; // closed
}

function priorityTone(priority: string | undefined): string {
  if (priority === 'critical') return 'text-destructive font-semibold';
  if (priority === 'high') return 'text-amber-600 font-medium';
  return 'text-muted-foreground';
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    tickets, mitarbeitende, teams,
    mitarbeitendeMap, teamsMap, ticketsMap,
    setTickets, fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'tickets') return undefined;
      const t = top.record;
      const currentStatus = lookupKey(t.fields.status);
      const nextStatus = currentStatus ? STATUS_NEXT[currentStatus] : undefined;
      if (!nextStatus) return undefined;
      const nextLabel = LOOKUP_OPTIONS['tickets']?.['status']?.find(o => o.key === nextStatus)?.label ?? nextStatus;
      return {
        label: tx`→ ${nextLabel}`,
        onClick: () => void advanceTicket(t, nextStatus),
      };
    },
  });

  const enrichedTickets = crud.enriched.tickets;

  // Advance ticket status — shared helper for banner, worklist, overlay footer
  async function advanceTicket(ticket: (typeof tickets)[0], toStatus: string) {
    const prevStatus = ticket.fields.status;
    setTickets(prev =>
      prev.map(t =>
        t.record_id === ticket.record_id
          ? { ...t, fields: { ...t.fields, status: lookupOption('tickets', 'status', toStatus) } }
          : t,
      ),
    );
    const statusLabel = LOOKUP_OPTIONS['tickets']?.['status']?.find(o => o.key === toStatus)?.label ?? toStatus;
    undoToast(tx`${ticket.fields.title ?? '—'} → ${statusLabel}`, async () => {
      const prevKey = lookupKey(prevStatus) ?? 'new';
      setTickets(prev =>
        prev.map(t =>
          t.record_id === ticket.record_id
            ? { ...t, fields: { ...t.fields, status: lookupOption('tickets', 'status', prevKey) } }
            : t,
        ),
      );
      try {
        await LivingAppsService.updateTicket(ticket.record_id, { status: prevKey });
      } catch {
        await fetchAll();
      }
    });
    try {
      await LivingAppsService.updateTicket(ticket.record_id, { status: toStatus });
    } catch {
      await fetchAll();
    }
  }

  // Derivations from clock
  const todayStr = format(clock, 'yyyy-MM-dd');

  const openTickets = useMemo(
    () => tickets.filter(t => {
      const s = lookupKey(t.fields.status);
      return s !== 'closed' && s !== 'resolved';
    }),
    [tickets],
  );

  const overdueTickets = useMemo(
    () => tickets.filter(t => {
      const s = lookupKey(t.fields.status);
      if (s === 'closed' || s === 'resolved') return false;
      if (!t.fields.due) return false;
      return isBefore(parseISO(t.fields.due), clock);
    }),
    [tickets, clock],
  );

  const newTickets = useMemo(
    () => tickets.filter(t => lookupKey(t.fields.status) === 'new'),
    [tickets],
  );

  const inProgressTickets = useMemo(
    () => tickets.filter(t => lookupKey(t.fields.status) === 'in_progress'),
    [tickets],
  );

  const waitingTickets = useMemo(
    () => tickets.filter(t => lookupKey(t.fields.status) === 'waiting_for_customer'),
    [tickets],
  );

  const unassignedOpen = useMemo(
    () => openTickets.filter(t => !t.fields.assigned_agent),
    [openTickets],
  );

  // KanbanWidget columns — inside component body (locale-aware labels)
  const COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  // Sort cards: critical/high first, then by due date
  const cards = useMemo<KanbanCard[]>(
    () => {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return [...enrichedTickets]
        .sort((a, b) => {
          const pa = priorityOrder[lookupKey(a.fields.priority) ?? 'low'] ?? 3;
          const pb = priorityOrder[lookupKey(b.fields.priority) ?? 'low'] ?? 3;
          if (pa !== pb) return pa - pb;
          const da = a.fields.due ?? '';
          const db = b.fields.due ?? '';
          return da.localeCompare(db);
        })
        .map(t => {
          const status = lookupKey(t.fields.status) ?? 'new';
          const isOverdue = t.fields.due && isBefore(parseISO(t.fields.due), clock);
          const pKey = lookupKey(t.fields.priority);
          return {
            id: `ticket:${t.record_id}`,
            column: status,
            title: t.fields.title ?? tx('Ohne Titel'),
            subtitle: (
              <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[12px]">
                {t.assigned_agentName && (
                  <span className="text-muted-foreground truncate">{t.assigned_agentName}</span>
                )}
                {!t.assigned_agentName && (
                  <span className="text-amber-600">{tx('Nicht zugewiesen')}</span>
                )}
                {t.fields.due && (
                  <span className={isOverdue ? 'text-destructive' : 'text-muted-foreground'}>
                    {isOverdue ? tx('Überfällig') : formatDateTime(t.fields.due)}
                  </span>
                )}
                {pKey && pKey !== 'medium' && pKey !== 'low' && (
                  <span className={priorityTone(pKey)}>
                    {t.fields.priority?.label}
                  </span>
                )}
              </span>
            ),
            tone: isOverdue ? 'destructive' : toneForStatus(status),
          };
        });
    },
    [enrichedTickets, clock],
  );

  // onCardMove — optimistic + undo toast
  async function moveCard(cardId: string, newColumn: string) {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const ticket = tickets.find(t => t.record_id === rid);
    if (!ticket) return;
    await advanceTicket(ticket, newColumn);
  }

  // Overdue names for hero
  const overdueNames = overdueTickets
    .slice(0, 3)
    .map(t => t.fields.title ?? t.fields.reporter_name ?? '—');

  // Context line
  const contextLine = (() => {
    if (openTickets.length === 0) return tx('Alle Tickets erledigt — großartige Arbeit!');
    if (overdueTickets.length > 0) {
      const n = namen(overdueNames);
      return tx`${n} — ${overdueTickets.length > 1 ? tx('überfällige Tickets') : tx('überfälliges Ticket')} — sofort handeln.`;
    }
    const newCount = newTickets.length;
    if (newCount > 0) {
      return tx`${newCount} ${newCount === 1 ? tx('neues Ticket') : tx('neue Tickets')} warten auf Zuweisung.`;
    }
    return tx`${openTickets.length} offene ${openTickets.length === 1 ? tx('Ticket') : tx('Tickets')} in Bearbeitung.`;
  })();

  // Aside 1: Overdue tickets — use enrichedTickets for agent name
  const urgentItems = useMemo(() => {
    const overdueIds = new Set(overdueTickets.map(t => t.record_id));
    return enrichedTickets
      .filter(t => overdueIds.has(t.record_id))
      .sort((a, b) => (a.fields.due ?? '').localeCompare(b.fields.due ?? ''))
      .slice(0, 8)
      .map(t => {
        const nextStatus = lookupKey(t.fields.status) ? STATUS_NEXT[lookupKey(t.fields.status)!] : undefined;
        const raw = tickets.find(r => r.record_id === t.record_id)!;
        return {
          id: t.record_id,
          title: t.fields.title ?? tx('Ohne Titel'),
          secondLine: (
            <span className="flex gap-2 text-xs">
              <span className="font-medium text-destructive">{tx('Überfällig')}</span>
              {t.fields.due && (
                <span className="text-muted-foreground">{formatDateTime(t.fields.due)}</span>
              )}
              {t.assigned_agentName && (
                <span className="text-muted-foreground">{t.assigned_agentName}</span>
              )}
            </span>
          ),
          action: nextStatus ? {
            label: tx('Weiter'),
            onClick: () => void advanceTicket(raw, nextStatus),
          } : undefined,
        };
      });
  }, [overdueTickets, enrichedTickets, tickets]);

  // Aside 2: Unassigned tickets
  const unassignedItems = useMemo(() => {
    return unassignedOpen
      .sort((a, b) => (a.fields.due ?? '').localeCompare(b.fields.due ?? ''))
      .slice(0, 8)
      .map(t => ({
        id: t.record_id,
        title: t.fields.title ?? tx('Ohne Titel'),
        secondLine: (
          <span className="flex gap-2 text-xs">
            <span className="font-medium text-amber-600">{tx('Nicht zugewiesen')}</span>
            {t.fields.category && (
              <span className="text-muted-foreground">{t.fields.category.label}</span>
            )}
            <span className={`font-medium ${priorityTone(lookupKey(t.fields.priority))}`}>
              {t.fields.priority?.label}
            </span>
          </span>
        ),
        action: {
          label: tx('Zuweisen'),
          onClick: () => crud.tickets.openEdit(t),
        },
      }));
  }, [unassignedOpen]);

  // Strip counts
  const stripItems = [
    {
      key: 'new',
      title: tx('Neu'),
      value: newTickets.length,
      icon: <IconTicket size={14} className="shrink-0" />,
      tone: newTickets.length > 0 ? 'warning' as const : 'default' as const,
    },
    {
      key: 'in_progress',
      title: tx('In Bearbeitung'),
      value: inProgressTickets.length,
      icon: <IconPlayerPlay size={14} className="shrink-0" />,
      tone: 'primary' as const,
    },
    {
      key: 'waiting',
      title: tx('Wartet auf Kunde'),
      value: waitingTickets.length,
      icon: <IconHourglass size={14} className="shrink-0" />,
      tone: waitingTickets.length > 0 ? 'warning' as const : 'default' as const,
    },
    {
      key: 'overdue',
      title: tx('Überfällig'),
      value: overdueTickets.length,
      icon: <IconAlertTriangle size={14} className="shrink-0" />,
      tone: overdueTickets.length > 0 ? 'destructive' as const : 'default' as const,
    },
    {
      key: 'unassigned',
      title: tx('Nicht zugewiesen'),
      value: unassignedOpen.length,
      icon: <IconUserQuestion size={14} className="shrink-0" />,
      tone: unassignedOpen.length > 0 ? 'warning' as const : 'default' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: todayStr })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconTicket size={16} className="shrink-0" />
          {tx('Neues Ticket')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          overdueTickets.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('In Bearbeitung'),
                onClick: () => {
                  const first = overdueTickets[0];
                  if (first) void advanceTicket(first, 'in_progress');
                },
              }}
            >
              <b>{namen(overdueNames)}</b>{' '}
              {overdueTickets.length === 1
                ? tx('— überfälliges Ticket, sofort bearbeiten.')
                : tx`— ${overdueTickets.length} überfällige Tickets, sofort bearbeiten.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            {stripItems.map(item => (
              <StatStripItem
                key={item.key}
                title={item.title}
                value={item.value}
                icon={item.icon}
                tone={item.tone}
              />
            ))}
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
            onAddCard={column => {
              crud.tickets.openCreate({ status: column, priority: 'medium', opened_on: todayStr });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Überfällige Tickets')}
              items={urgentItems}
              onItemClick={id => {
                const ticket = tickets.find(t => t.record_id === id);
                if (ticket) crud.tickets.openDetail(ticket);
              }}
              empty={{
                text: tx('Keine überfälligen Tickets — alles im Zeitplan.'),
                action: {
                  label: tx('Neues Ticket'),
                  onClick: () => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: todayStr }),
                },
              }}
            />
            <WorkList
              title={tx('Nicht zugewiesen')}
              items={unassignedItems}
              onItemClick={id => {
                const ticket = tickets.find(t => t.record_id === id);
                if (ticket) crud.tickets.openDetail(ticket);
              }}
              empty={{
                text: tx('Alle offenen Tickets haben einen Bearbeiter.'),
                action: {
                  label: tx('Neues Ticket'),
                  onClick: () => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: todayStr }),
                },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
