import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { formatDate, formatDateTime, lookupKey } from '@/lib/formatters';
import { lookupOption, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { IconAlertTriangle, IconTicket, IconClock, IconUsers, IconCheck } from '@tabler/icons-react';
import { isBefore, parseISO, format } from 'date-fns';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    tickets, setTickets, mitarbeitende, teams, notizen,
    mitarbeitendeMap,
    fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'tickets') return undefined;
      const t = top.record;
      const statusKey = lookupKey(t.fields.status);
      if (statusKey === 'new') return { label: tx('In Bearbeitung setzen'), onClick: () => advanceStatus(t, 'in_progress') };
      if (statusKey === 'in_progress') return { label: tx('Als gelöst markieren'), onClick: () => advanceStatus(t, 'resolved') };
      if (statusKey === 'resolved') return { label: tx('Schließen'), onClick: () => advanceStatus(t, 'closed') };
      return undefined;
    },
  });

  const enrichedTickets = crud.enriched.tickets;

  // --- Helpers ---
  async function advanceStatus(ticket: typeof tickets[0], nextStatus: string) {
    const prevStatus = ticket.fields.status;
    const newLookup = lookupOption('tickets', 'status', nextStatus);
    setTickets(prev => prev.map(t =>
      t.record_id === ticket.record_id
        ? { ...t, fields: { ...t.fields, status: newLookup } }
        : t
    ));
    undoToast(
      tx`${ticket.fields.title ?? ''} — ${newLookup.label}`,
      async () => {
        setTickets(prev => prev.map(t =>
          t.record_id === ticket.record_id
            ? { ...t, fields: { ...t.fields, status: prevStatus } }
            : t
        ));
        await LivingAppsService.updateTicket(ticket.record_id, { status: typeof prevStatus === 'object' && prevStatus ? (prevStatus as any).key : prevStatus });
      }
    );
    try {
      await LivingAppsService.updateTicket(ticket.record_id, { status: nextStatus });
    } catch {
      fetchAll();
    }
  }

  // --- Derived data ---
  const todayStr = format(clock, 'yyyy-MM-dd');

  const openTickets = tickets.filter(t => {
    const s = lookupKey(t.fields.status);
    return s !== 'closed' && s !== 'resolved';
  });

  const overdueTickets = openTickets.filter(t =>
    t.fields.due && isBefore(parseISO(t.fields.due), clock)
  );

  const waitingTickets = tickets.filter(t =>
    lookupKey(t.fields.status) === 'waiting_for_customer'
  );

  const newTickets = tickets.filter(t => lookupKey(t.fields.status) === 'new');

  const criticalOpen = openTickets.filter(t =>
    lookupKey(t.fields.priority) === 'critical' || lookupKey(t.fields.priority) === 'high'
  );

  const slaBreached = tickets.filter(t => t.fields.sla_breached === true && lookupKey(t.fields.status) !== 'closed');

  const activeAgents = mitarbeitende.filter(a => a.fields.active !== false);

  // --- Kanban columns (inside component body — locale-aware getters) ---
  const columns: KanbanColumn[] = (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).map(o => ({
    key: o.key,
    label: o.label,
    tone: o.key === 'new' ? 'primary'
      : o.key === 'in_progress' ? 'warning'
      : o.key === 'waiting_for_customer' ? 'default'
      : o.key === 'resolved' ? 'success'
      : 'default',
  }));

  const cards: KanbanCard[] = enrichedTickets.map(t => {
    const pKey = lookupKey(t.fields.priority);
    const isOverdue = t.fields.due ? isBefore(parseISO(t.fields.due), clock) : false;
    return {
      id: `ticket:${t.record_id}`,
      column: lookupKey(t.fields.status) ?? 'new',
      title: t.fields.title ?? tx('Ohne Titel'),
      subtitle: (
        <span className="flex flex-col gap-0.5">
          {t.assigned_agentName ? (
            <span className="text-xs text-muted-foreground truncate">{t.assigned_agentName}</span>
          ) : (
            <span className="text-xs text-amber-600 font-medium">{tx('Nicht zugewiesen')}</span>
          )}
          {t.fields.due && (
            <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {isOverdue ? tx('Überfällig') + ' · ' : ''}{formatDateTime(t.fields.due)}
            </span>
          )}
        </span>
      ),
      tone: pKey === 'critical' ? 'destructive'
        : pKey === 'high' ? 'warning'
        : 'default',
    };
  });

  // Sort cards: overdue first, then by due date
  cards.sort((a, b) => {
    const ta = enrichedTickets.find(t => `ticket:${t.record_id}` === a.id);
    const tb = enrichedTickets.find(t => `ticket:${t.record_id}` === b.id);
    const da = ta?.fields.due ? parseISO(ta.fields.due).getTime() : Infinity;
    const db = tb?.fields.due ? parseISO(tb.fields.due).getTime() : Infinity;
    return da - db;
  });

  // Chart rows
  const chartRows = tickets.map(t => ({
    id: `ticket:${t.record_id}`,
    data: t,
  }));

  // --- Context line ---
  const contextLine = (() => {
    if (overdueTickets.length > 0) {
      const names = overdueTickets.slice(0, 3).map(t => t.fields.reporter_name ?? t.fields.title ?? '');
      return tx`${namen(names)} ${overdueTickets.length === 1 ? tx('hat ein überfälliges Ticket') : tx('haben überfällige Tickets')} — sofort prüfen.`;
    }
    if (newTickets.length > 0) {
      return tx`${String(newTickets.length)} ${newTickets.length === 1 ? tx('neues Ticket') : tx('neue Tickets')} warten auf Zuweisung.`;
    }
    if (openTickets.length === 0) {
      return tx('Alle Tickets sind geschlossen — gute Arbeit!');
    }
    return tx`${String(openTickets.length)} ${openTickets.length === 1 ? tx('offenes Ticket') : tx('offene Tickets')} im System.`;
  })();

  // --- WorkList items: today's + overdue ---
  const urgentItems = openTickets
    .filter(t => t.fields.due)
    .sort((a, b) => {
      const da = a.fields.due ? parseISO(a.fields.due).getTime() : Infinity;
      const db = b.fields.due ? parseISO(b.fields.due).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 10);

  const urgentWorkItems = urgentItems.map(t => {
    const enriched = enrichedTickets.find(e => e.record_id === t.record_id);
    const isOverdue = t.fields.due ? isBefore(parseISO(t.fields.due), clock) : false;
    const pKey = lookupKey(t.fields.priority);
    const statusKey = lookupKey(t.fields.status);
    return {
      id: t.record_id,
      title: t.fields.title ?? tx('Ohne Titel'),
      secondLine: (
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-medium ${isOverdue ? 'text-destructive' : 'text-amber-600'}`}>
            {isOverdue ? tx('Überfällig') : tx('Fällig')}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{formatDateTime(t.fields.due)}</span>
          {enriched?.assigned_agentName && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{enriched.assigned_agentName}</span>
            </>
          )}
        </span>
      ),
      action: statusKey === 'new' ? {
        label: tx('Annehmen'),
        onClick: () => advanceStatus(t, 'in_progress'),
      } : statusKey === 'in_progress' ? {
        label: tx('Lösen'),
        onClick: () => advanceStatus(t, 'resolved'),
      } : undefined,
    };
  });

  // --- Waiting list ---
  const waitingItems = waitingTickets.slice(0, 8).map(t => {
    const enriched = enrichedTickets.find(e => e.record_id === t.record_id);
    return {
      id: t.record_id,
      title: t.fields.title ?? tx('Ohne Titel'),
      secondLine: (
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="text-amber-600 font-medium">{tx('Wartet auf Kunde')}</span>
          {enriched?.assigned_agentName && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{enriched.assigned_agentName}</span>
            </>
          )}
        </span>
      ),
      action: {
        label: tx('Lösen'),
        onClick: () => advanceStatus(t, 'resolved'),
      },
    };
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          onClick={() => crud.tickets.openCreate({ status: 'new', opened_on: todayStr })}
        >
          <IconTicket size={16} className="shrink-0" />
          {tx('Neues Ticket')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={overdueTickets.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: tx('Jetzt annehmen'),
              onClick: () => {
                const first = overdueTickets.find(t => lookupKey(t.fields.status) === 'new') ?? overdueTickets[0];
                if (first) crud.tickets.openDetail(first);
              },
            }}
          >
            <b>{namen(overdueTickets.map(t => t.fields.title ?? ''))}</b>
            {' '}— {overdueTickets.length === 1 ? tx('überfällig seit') : tx('überfällig')}{' '}
            {overdueTickets.length === 1 && overdueTickets[0].fields.due ? formatDateTime(overdueTickets[0].fields.due) : ''}
            {overdueTickets.length > 1 && tx`${String(overdueTickets.length)} Tickets`}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={openTickets.length}
              icon={<IconTicket size={16} />}
              tone={openTickets.length > 20 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Neu')}
              value={newTickets.length}
              icon={<IconTicket size={16} />}
              tone={newTickets.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={overdueTickets.length}
              icon={<IconAlertTriangle size={16} />}
              tone={overdueTickets.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('SLA verletzt')}
              value={slaBreached.length}
              icon={<IconClock size={16} />}
              tone={slaBreached.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Aktive Agenten')}
              value={activeAgents.length}
              icon={<IconUsers size={16} />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            columns={columns}
            cards={cards}
            defaultCollapsed={['closed']}
            onCardClick={(card) => {
              const id = card.id.split(':')[1];
              const ticket = tickets.find(t => t.record_id === id);
              if (ticket) crud.tickets.openDetail(ticket);
            }}
            onAddCard={(column) => {
              crud.tickets.openCreate({ status: column, opened_on: todayStr });
            }}
            onCardMove={async (cardId, newColumn) => {
              const id = cardId.split(':')[1];
              const ticket = tickets.find(t => t.record_id === id);
              if (!ticket) return;
              const prevStatus = ticket.fields.status;
              const newLookup = lookupOption('tickets', 'status', newColumn);
              setTickets(prev => prev.map(t =>
                t.record_id === id
                  ? { ...t, fields: { ...t.fields, status: newLookup } }
                  : t
              ));
              undoToast(
                tx`${ticket.fields.title ?? ''} — ${newLookup.label}`,
                async () => {
                  setTickets(prev => prev.map(t =>
                    t.record_id === id
                      ? { ...t, fields: { ...t.fields, status: prevStatus } }
                      : t
                  ));
                  await LivingAppsService.updateTicket(id, { status: typeof prevStatus === 'object' && prevStatus ? (prevStatus as any).key : prevStatus });
                }
              );
              try {
                await LivingAppsService.updateTicket(id, { status: newColumn });
              } catch {
                fetchAll();
              }
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Fällig & überfällig')}
              items={urgentWorkItems}
              onItemClick={(id) => {
                const ticket = tickets.find(t => t.record_id === id);
                if (ticket) crud.tickets.openDetail(ticket);
              }}
              empty={{
                text: tx('Kein Ticket überfällig — alles im Zeitplan.'),
                action: { label: tx('Neues Ticket'), onClick: () => crud.tickets.openCreate({ status: 'new' }) },
              }}
            />
            <WorkList
              title={tx('Wartet auf Kunden')}
              items={waitingItems}
              onItemClick={(id) => {
                const ticket = tickets.find(t => t.record_id === id);
                if (ticket) crud.tickets.openDetail(ticket);
              }}
              empty={{
                text: tx('Keine Tickets warten auf Kunden-Rückmeldung.'),
              }}
            />
          </>
        }
      />

      {/* Chart band: tickets by category + by priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartWidget
          title={tx('Tickets nach Kategorie')}
          rows={chartRows}
          dimension={{ kind: 'category', accessor: r => r.data.fields.category }}
        />
        <ChartWidget
          title={tx('Tickets nach Priorität')}
          rows={chartRows}
          dimension={{ kind: 'category', accessor: r => r.data.fields.priority }}
        />
      </div>

      {crud.surfaces}
    </div>
  );
}
