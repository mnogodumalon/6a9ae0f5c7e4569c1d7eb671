import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDateTime, lookupKey } from '@/lib/formatters';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard } from '@/components/widgets/KanbanWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { Button } from '@/components/ui/button';
import {
  IconPlus,
  IconAlertTriangle,
  IconTicket,
  IconClock,
  IconUserQuestion,
  IconCircleCheck,
} from '@tabler/icons-react';
import { format, parseISO, isBefore } from 'date-fns';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    tickets, mitarbeitende, mitarbeitendeMap,
    setTickets, fetchAll,
  } = data;

  const clock = useClock();
  const todayKey = format(clock, 'yyyy-MM-dd');

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'tickets') return undefined;
      const t = top.record;
      const statusK = lookupKey(t.fields.status);
      if (statusK === 'new') return { label: tx('Bearbeitung starten'), onClick: () => advanceTicket(t, 'in_progress') };
      if (statusK === 'in_progress') return { label: tx('Als gelöst markieren'), onClick: () => advanceTicket(t, 'resolved') };
      if (statusK === 'resolved') return { label: tx('Schließen'), onClick: () => advanceTicket(t, 'closed') };
      if (statusK === 'waiting_for_customer') return { label: tx('Antwort erhalten'), onClick: () => advanceTicket(t, 'in_progress') };
      return undefined;
    },
  });

  const enrichedTickets = crud.enriched.tickets;

  // --- derived state ---
  const openTickets = enrichedTickets.filter(t => {
    const k = lookupKey(t.fields.status);
    return k !== 'closed' && k !== 'resolved';
  });

  const overdueTickets = enrichedTickets.filter(t => {
    const k = lookupKey(t.fields.status);
    if (k === 'closed' || k === 'resolved') return false;
    if (!t.fields.due) return false;
    return isBefore(parseISO(t.fields.due), clock);
  });

  const slaBreached = enrichedTickets.filter(t => {
    const k = lookupKey(t.fields.status);
    return t.fields.sla_breached === true && k !== 'closed' && k !== 'resolved';
  });

  const unassigned = enrichedTickets.filter(t => {
    const k = lookupKey(t.fields.status);
    return !t.fields.assigned_agent && k !== 'closed' && k !== 'resolved';
  });

  const criticalOpen = enrichedTickets.filter(t => {
    const k = lookupKey(t.fields.status);
    const p = lookupKey(t.fields.priority);
    return (p === 'critical' || p === 'high') && k !== 'closed' && k !== 'resolved';
  });

  const newTickets = enrichedTickets.filter(t => lookupKey(t.fields.status) === 'new');
  const inProgress = enrichedTickets.filter(t => lookupKey(t.fields.status) === 'in_progress');

  const activeAgents = mitarbeitende.filter(m => m.fields.active !== false);

  // --- shared advance helper ---
  async function advanceTicket(ticket: typeof enrichedTickets[0], newStatus: string) {
    const prev = ticket.fields.status;
    const newLv = lookupOption('tickets', 'status', newStatus);
    setTickets(prev2 => prev2.map(t =>
      t.record_id === ticket.record_id
        ? { ...t, fields: { ...t.fields, status: newLv } }
        : t
    ));
    undoToast(tx`${ticket.fields.title ?? ''} — ${newLv.label}`, async () => {
      setTickets(prev2 => prev2.map(t =>
        t.record_id === ticket.record_id
          ? { ...t, fields: { ...t.fields, status: prev } }
          : t
      ));
      await LivingAppsService.updateTicket(ticket.record_id, { status: typeof prev === 'object' && prev && 'key' in prev ? (prev as { key: string }).key : String(prev ?? '') });
    });
    try {
      await LivingAppsService.updateTicket(ticket.record_id, { status: newStatus });
    } catch {
      await fetchAll();
    }
  }

  // --- context line ---
  const overdueNames = namen(overdueTickets.map(t => t.fields.reporter_name ?? t.fields.title ?? '').filter(Boolean));
  const contextLine = overdueTickets.length > 0
    ? tx`${overdueNames} — ${overdueTickets.length} Tickets überfällig`
    : newTickets.length > 0
      ? tx`${newTickets.length} neue Tickets warten auf Zuweisung`
      : tx`Alle Tickets im Plan — ${openTickets.length} offen`;

  // --- kanban columns (inside body — locale-aware) ---
  const columns = (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).map(o => ({
    key: o.key,
    label: o.label,
    tone: o.key === 'new' ? ('primary' as const)
      : o.key === 'in_progress' ? ('warning' as const)
      : o.key === 'waiting_for_customer' ? ('default' as const)
      : o.key === 'resolved' ? ('success' as const)
      : ('default' as const),
  }));

  // --- kanban cards ---
  const cards: KanbanCard[] = enrichedTickets.map(t => {
    const statusK = lookupKey(t.fields.status) ?? 'new';
    const priorityK = lookupKey(t.fields.priority);
    const isOverdue = t.fields.due && isBefore(parseISO(t.fields.due), clock) && statusK !== 'closed' && statusK !== 'resolved';
    const tone = t.fields.sla_breached
      ? ('destructive' as const)
      : isOverdue
        ? ('destructive' as const)
        : priorityK === 'critical'
          ? ('destructive' as const)
          : priorityK === 'high'
            ? ('warning' as const)
            : ('default' as const);
    return {
      id: `ticket:${t.record_id}`,
      column: statusK,
      title: t.fields.title ?? tx('Kein Titel'),
      subtitle: (
        <span className="text-xs text-muted-foreground">
          {t.fields.reporter_name ?? '—'}
          {t.fields.due && (
            <> · <span className={isOverdue ? 'text-destructive font-medium' : ''}>{formatDateTime(t.fields.due)}</span></>
          )}
          {t.assigned_agentName && <> · {t.assigned_agentName}</>}
          {t.fields.category?.label && <> · {t.fields.category.label}</>}
        </span>
      ),
      tone,
    };
  }).sort((a, b) => {
    // Sort by priority: critical first, then by due date
    const tA = enrichedTickets.find(t => `ticket:${t.record_id}` === a.id);
    const tB = enrichedTickets.find(t => `ticket:${t.record_id}` === b.id);
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const pA = pOrder[lookupKey(tA?.fields.priority) as keyof typeof pOrder] ?? 2;
    const pB = pOrder[lookupKey(tB?.fields.priority) as keyof typeof pOrder] ?? 2;
    return pA - pB;
  });

  // --- chart rows ---
  const chartRows = enrichedTickets
    .filter(t => lookupKey(t.fields.status) !== 'closed')
    .map(t => ({ id: `ticket:${t.record_id}`, data: t }));

  // --- chart rows for opened_on trend ---
  const trendRows = enrichedTickets.map(t => ({ id: `ticket:${t.record_id}`, data: t }));

  // --- urgent signal ---
  const urgentList = [...overdueTickets, ...slaBreached.filter(t => !overdueTickets.includes(t))].slice(0, 5);
  const firstUrgent = urgentList[0];

  // --- hero action ---
  function handleUrgentAction() {
    if (firstUrgent) {
      crud.tickets.openDetail(firstUrgent);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <Button onClick={() => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: todayKey })} className="shrink-0">
          <IconPlus size={16} className="shrink-0 mr-1.5" />
          {tx('Ticket erfassen')}
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={urgentList.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{ label: tx('Ticket öffnen'), onClick: handleUrgentAction }}
          >
            <b>{namen(urgentList.map(t => t.fields.reporter_name ?? t.fields.title ?? '').filter(Boolean))}</b>
            {' — '}
            {urgentList.length === 1
              ? tx`1 Ticket überfällig oder SLA verletzt`
              : tx`${urgentList.length} Tickets überfällig oder SLA verletzt`}
            {firstUrgent?.fields.due && (
              <> · {tx('Fällig')}: <b>{formatDateTime(firstUrgent.fields.due)}</b></>
            )}
          </HeroBanner>
        )}
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
              icon={<IconUserQuestion size={16} />}
              tone={newTickets.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('In Bearbeitung')}
              value={inProgress.length}
              icon={<IconClock size={16} />}
              tone="default"
            />
            <StatStripItem
              title={tx('Überfällig')}
              value={overdueTickets.length}
              icon={<IconAlertTriangle size={16} />}
              tone={overdueTickets.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Nicht zugewiesen')}
              value={unassigned.length}
              icon={<IconUserQuestion size={16} />}
              tone={unassigned.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Aktive Agenten')}
              value={activeAgents.length}
              icon={<IconCircleCheck size={16} />}
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
              const rec = enrichedTickets.find(t => t.record_id === id);
              if (rec) crud.tickets.openDetail(rec);
            }}
            onCardMove={async (cardId, newColumn) => {
              const id = cardId.split(':')[1];
              const ticket = enrichedTickets.find(t => t.record_id === id);
              if (!ticket) return;
              const prevStatus = ticket.fields.status;
              const newLv = lookupOption('tickets', 'status', newColumn);
              setTickets(prev => prev.map(t =>
                t.record_id === id
                  ? { ...t, fields: { ...t.fields, status: newLv } }
                  : t
              ));
              undoToast(tx`${ticket.fields.title ?? ''} → ${newLv.label}`, async () => {
                setTickets(prev => prev.map(t =>
                  t.record_id === id
                    ? { ...t, fields: { ...t.fields, status: prevStatus } }
                    : t
                ));
                await LivingAppsService.updateTicket(id, { status: typeof prevStatus === 'object' && prevStatus && 'key' in prevStatus ? (prevStatus as { key: string }).key : String(prevStatus ?? '') });
              });
              try {
                await LivingAppsService.updateTicket(id, { status: newColumn });
              } catch {
                await fetchAll();
              }
            }}
            onAddCard={(column) => crud.tickets.openCreate({ status: column, priority: 'medium', opened_on: todayKey })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Nicht zugewiesen')}
              items={unassigned.slice(0, 8).map(t => ({
                id: t.record_id,
                title: t.fields.title ?? tx('Kein Titel'),
                secondLine: (
                  <>
                    <span className={`font-medium ${lookupKey(t.fields.priority) === 'critical' ? 'text-destructive' : lookupKey(t.fields.priority) === 'high' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {t.fields.priority?.label ?? '—'}
                    </span>
                    {t.fields.category?.label && (
                      <span className="text-muted-foreground"> · {t.fields.category.label}</span>
                    )}
                    {t.fields.reporter_name && (
                      <span className="text-muted-foreground"> · {t.fields.reporter_name}</span>
                    )}
                  </>
                ),
                action: { label: tx('Zuweisen'), onClick: () => crud.tickets.openEdit(t) },
              }))}
              onItemClick={(id) => {
                const rec = enrichedTickets.find(t => t.record_id === id);
                if (rec) crud.tickets.openDetail(rec);
              }}
              empty={{
                text: tx('Alle Tickets sind zugewiesen — super!'),
                action: { label: tx('Neues Ticket'), onClick: () => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: todayKey }) },
              }}
            />
            <ChartWidget
              title={tx('Tickets nach Kategorie')}
              rows={chartRows}
              dimension={{ kind: 'category', accessor: r => r.data.fields.category }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
