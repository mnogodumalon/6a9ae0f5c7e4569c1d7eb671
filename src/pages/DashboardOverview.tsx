import { useMemo, useState } from 'react';
import { format, isBefore, parseISO } from 'date-fns';
import { IconAlertTriangle, IconTicket, IconClock, IconUserOff, IconCircleCheck, IconPlus } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { lookupKey, formatDateTime } from '@/lib/formatters';
import { lookupOption, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget, type KanbanCard, type KanbanColumn } from '@/components/widgets/KanbanWidget';
import { Button } from '@/components/ui/button';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    tickets, setTickets, mitarbeitende, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'tickets') return undefined;
      const t = top.record;
      const status = lookupKey(t.fields.status);
      if (status === 'new') return { label: tx('In Bearbeitung setzen'), onClick: () => void advanceTicket(t.record_id, 'in_progress') };
      if (status === 'in_progress') return { label: tx('Gelöst markieren'), onClick: () => void advanceTicket(t.record_id, 'resolved') };
      if (status === 'waiting_for_customer') return { label: tx('Lösung bestätigen'), onClick: () => void advanceTicket(t.record_id, 'resolved') };
      if (status === 'resolved') return { label: tx('Schließen'), onClick: () => void advanceTicket(t.record_id, 'closed') };
      return undefined;
    },
  });

  const enrichedTickets = crud.enriched.tickets;

  const clock = useClock();
  const todayKey = format(clock, 'yyyy-MM-dd');

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Optimistic advance helper — shared by board drag, aside action and overlay footer
  const advanceTicket = async (id: string, newStatus: string) => {
    const prev = tickets.find(t => t.record_id === id);
    if (!prev) return;
    const optimistic = lookupOption('tickets', 'status', newStatus);
    setTickets(ts => ts.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, status: optimistic } } : t));
    const label = optimistic.label;
    undoToast(
      tx`Status auf „${label}" gesetzt`,
      async () => {
        const revert = prev.fields.status;
        setTickets(ts => ts.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, status: revert ?? undefined } } : t));
        try { await LivingAppsService.updateTicket(id, { status: lookupKey(revert) }); } catch { await fetchAll(); }
      },
    );
    try {
      await LivingAppsService.updateTicket(id, { status: newStatus });
    } catch {
      await fetchAll();
    }
  };

  // KPI derivations
  const openTickets = useMemo(() => tickets.filter(t => {
    const s = lookupKey(t.fields.status);
    return s === 'new' || s === 'in_progress' || s === 'waiting_for_customer';
  }), [tickets]);

  const overdueTickets = useMemo(() => openTickets.filter(t => {
    if (!t.fields.due) return false;
    try { return isBefore(parseISO(t.fields.due), clock); } catch { return false; }
  }), [openTickets, clock]);

  const unassignedTickets = useMemo(() => tickets.filter(t => {
    const s = lookupKey(t.fields.status);
    return (s === 'new' || s === 'in_progress') && !t.fields.assigned_agent;
  }), [tickets]);

  const resolvedToday = useMemo(() => tickets.filter(t => {
    const s = lookupKey(t.fields.status);
    return (s === 'resolved' || s === 'closed') && (t.updatedat ?? '').startsWith(todayKey);
  }), [tickets, todayKey]);

  const newTickets = useMemo(() => tickets.filter(t => lookupKey(t.fields.status) === 'new'), [tickets]);

  // Critical = overdue critical/high priority
  const criticalOverdue = useMemo(() => overdueTickets.filter(t => {
    const p = lookupKey(t.fields.priority);
    return p === 'critical' || p === 'high';
  }), [overdueTickets]);

  // Context line names
  const overdueNames = useMemo(() => overdueTickets.slice(0, 3).map(t => t.fields.reporter_name ?? t.fields.title ?? ''), [overdueTickets]);
  const newNames = useMemo(() => newTickets.slice(0, 2).map(t => t.fields.reporter_name ?? ''), [newTickets]);

  // Kanban columns — inside body for locale-aware labels
  const COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['tickets']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  // Tone per card
  const toneForCard = (status: string | undefined, priority: string | undefined) => {
    if (status === 'new' && (priority === 'critical' || priority === 'high')) return 'destructive' as const;
    if (status === 'new') return 'warning' as const;
    if (status === 'in_progress') return 'primary' as const;
    if (status === 'waiting_for_customer') return 'default' as const;
    if (status === 'resolved') return 'success' as const;
    return 'default' as const;
  };

  // Filter by clicked status strip segment
  const visibleTickets = useMemo(() => {
    if (!statusFilter) return enrichedTickets;
    return enrichedTickets.filter(t => lookupKey(t.fields.status) === statusFilter);
  }, [enrichedTickets, statusFilter]);

  const cards = useMemo<KanbanCard[]>(
    () => visibleTickets.map(t => {
      const status = lookupKey(t.fields.status) ?? COLUMNS[0]?.key ?? '';
      const priority = lookupKey(t.fields.priority);
      const agent = t.assigned_agentName;
      return {
        id: `ticket:${t.record_id}`,
        column: status,
        title: t.fields.title ?? tx('Kein Titel'),
        subtitle: agent
          ? tx`${agent} · ${t.fields.priority?.label ?? ''}`
          : tx`${t.fields.reporter_name ?? ''} · ${t.fields.priority?.label ?? ''}`,
        tone: toneForCard(status, priority),
      };
    }),
    [visibleTickets, COLUMNS],
  );

  const moveCard = async (cardId: string, newColumn: string): Promise<void | string> => {
    const id = cardId.split(':')[1];
    if (!id) return;
    const ticket = tickets.find(t => t.record_id === id);
    if (!ticket) return;
    const currentStatus = lookupKey(ticket.fields.status);
    // Block: cannot move closed ticket
    if (currentStatus === 'closed') {
      return tx('Geschlossene Tickets können nicht mehr verschoben werden.');
    }
    const optimistic = lookupOption('tickets', 'status', newColumn);
    const prevStatus = ticket.fields.status;
    setTickets(ts => ts.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, status: optimistic } } : t));
    undoToast(
      tx`Ticket auf „${optimistic.label}" gesetzt`,
      async () => {
        setTickets(ts => ts.map(t => t.record_id === id ? { ...t, fields: { ...t.fields, status: prevStatus ?? undefined } } : t));
        try { await LivingAppsService.updateTicket(id, { status: lookupKey(prevStatus) }); } catch { await fetchAll(); }
      },
    );
    try {
      await LivingAppsService.updateTicket(id, { status: newColumn });
    } catch {
      await fetchAll();
    }
  };

  // Aside: overdue + unassigned work lists
  const overdueItems = useMemo(() => overdueTickets.slice(0, 8).map(t => ({
    id: t.record_id,
    title: t.fields.title ?? tx('Kein Titel'),
    secondLine: (
      <span className="flex gap-2 min-w-0">
        <span className="font-medium text-destructive truncate">{tx('Überfällig')}</span>
        <span className="text-muted-foreground shrink-0">· {formatDateTime(t.fields.due)}</span>
      </span>
    ),
    action: lookupKey(t.fields.status) !== 'resolved' && lookupKey(t.fields.status) !== 'closed'
      ? { label: tx('Lösen'), onClick: () => void advanceTicket(t.record_id, 'resolved') }
      : undefined,
  })), [overdueTickets]);

  const unassignedItems = useMemo(() => unassignedTickets.slice(0, 8).map(t => {
    const enriched = enrichedTickets.find(e => e.record_id === t.record_id);
    return {
      id: t.record_id,
      title: t.fields.title ?? tx('Kein Titel'),
      secondLine: (
        <span className="flex gap-2 min-w-0">
          <span className="text-amber-600 font-medium truncate">{tx('Nicht zugewiesen')}</span>
          <span className="text-muted-foreground shrink-0 truncate">· {t.fields.category?.label ?? ''}</span>
        </span>
      ),
      action: { label: tx('Zuweisen'), onClick: () => { const rec = enriched; if (rec) crud.tickets.openEdit(rec); } },
    };
  }), [unassignedTickets, enrichedTickets]);

  // Hero: critical overdue tickets
  const heroTicket = criticalOverdue[0];
  const enrichedHero = heroTicket ? enrichedTickets.find(e => e.record_id === heroTicket.record_id) : undefined;

  // Context line
  const contextLine = useMemo(() => {
    if (overdueTickets.length > 0 && newTickets.length > 0) {
      return tx`${namen(overdueNames)} überfällig · ${newTickets.length} neue Anfrage${newTickets.length !== 1 ? 'n' : ''}`;
    }
    if (overdueTickets.length > 0) {
      return tx`${namen(overdueNames)} ${overdueTickets.length === 1 ? 'überfällig' : 'überfällig'}`;
    }
    if (newTickets.length > 0) {
      return tx`${namen(newNames)} ${newTickets.length === 1 ? 'wartet' : 'warten'} auf Bearbeitung`;
    }
    if (resolvedToday.length > 0) {
      return tx`${resolvedToday.length} Ticket${resolvedToday.length !== 1 ? 's' : ''} heute gelöst — alles läuft gut`;
    }
    return tx('Alle Tickets im grünen Bereich');
  }, [overdueTickets.length, newTickets.length, resolvedToday.length, overdueNames, newNames]);

  // Active agents count
  const activeAgents = useMemo(() => mitarbeitende.filter(m => m.fields.active !== false).length, [mitarbeitende]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1 text-sm truncate">{contextLine}</p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: format(clock, 'yyyy-MM-dd') })}
        >
          <IconPlus size={16} className="mr-1 shrink-0" />
          {tx('Neues Ticket')}
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          heroTicket && enrichedHero ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{ label: tx('Sofort bearbeiten'), onClick: () => crud.tickets.openDetail(heroTicket) }}
            >
              <b>{namen(criticalOverdue.map(t => t.fields.reporter_name ?? t.fields.title ?? ''))}</b>
              {' — '}{tx('kritisches Ticket überfällig seit')}{' '}
              <b>{formatDateTime(heroTicket.fields.due)}</b>
              {enrichedHero.assigned_agentName ? tx` · zuständig: ${enrichedHero.assigned_agentName}` : tx(' · noch nicht zugewiesen')}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={openTickets.length}
              icon={<IconTicket size={16} className="shrink-0" />}
              tone={openTickets.length > 20 ? 'warning' : 'default'}
              onClick={() => setStatusFilter(f => f === 'new' ? null : 'new')}
              active={statusFilter === 'new'}
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
              onClick={() => setStatusFilter(f => f === 'unassigned' ? null : 'unassigned')}
              active={statusFilter === 'unassigned'}
            />
            <StatStripItem
              title={tx('Heute gelöst')}
              value={resolvedToday.length}
              icon={<IconCircleCheck size={16} className="shrink-0" />}
              tone={resolvedToday.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Agenten aktiv')}
              value={activeAgents}
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
              const id = card.id.split(':')[1];
              const rec = tickets.find(t => t.record_id === id);
              if (rec) crud.tickets.openDetail(rec);
            }}
            onCardMove={moveCard}
            onAddCard={column => crud.tickets.openCreate({ status: column, priority: 'medium', opened_on: format(clock, 'yyyy-MM-dd') })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Überfällig & Kritisch')}
              items={overdueItems}
              onItemClick={id => {
                const rec = tickets.find(t => t.record_id === id);
                if (rec) crud.tickets.openDetail(rec);
              }}
              empty={{
                text: tx('Keine überfälligen Tickets — alles im Zeitplan'),
                action: { label: tx('Neues Ticket'), onClick: () => crud.tickets.openCreate({ status: 'new', priority: 'medium', opened_on: format(clock, 'yyyy-MM-dd') }) },
              }}
            />
            <WorkList
              title={tx('Nicht zugewiesen')}
              items={unassignedItems}
              onItemClick={id => {
                const rec = tickets.find(t => t.record_id === id);
                if (rec) crud.tickets.openDetail(rec);
              }}
              empty={{
                text: tx('Alle offenen Tickets sind zugewiesen'),
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
