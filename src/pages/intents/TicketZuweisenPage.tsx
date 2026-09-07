/**
 * Ticket zuweisen — 4-Schritt-Wizard (Update-only).
 * Steps: 1) Ticket wählen (nur new/in_progress) → 2) Agent zuweisen (nur aktive Mitarbeitende)
 *        → 3) Team & Status festlegen → 4) Prüfen & bestätigen.
 * Reads: tickets, mitarbeitende, teams. Writes: tickets (update — assigned_agent, team, status).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, StepNav,
 *            SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import {
  useRecordSearch,
  useStepForm,
  useJourneySubmit,
  fieldText,
  fieldLookup,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';

const DRAFT_KEY = 'ticket-zuweisen';

// Only the three assignable statuses (resolved/closed are not assignment targets)
const ASSIGNABLE_STATUSES = ['new', 'in_progress', 'waiting_for_customer'] as const;

export default function TicketZuweisenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Open tickets — only new or in_progress qualify
  const tickets = useRecordSearch(servicePort, 'tickets', {
    searchFields: ['title', 'reporter_name'],
    filter: "r.v_status in ['new', 'in_progress']",
    where: r => {
      const s = fieldLookup(r, 'status')?.key;
      return s === 'new' || s === 'in_progress';
    },
    toItem: r => ({
      id: r.id,
      title: fieldText(r, 'title'),
      subtitle: fieldText(r, 'reporter_name'),
      status: fieldLookup(r, 'status') ?? undefined,
    }),
    orderby: ['r.v_status asc', 'r.v_title asc'],
  });

  // Step 2: Active agents only
  const agenten = useRecordSearch(servicePort, 'mitarbeitende', {
    searchFields: ['first_name', 'last_name', 'email'],
    filter: "r.v_active == True",
    where: r => r.fields['active'] === true,
    toItem: r => ({
      id: r.id,
      title: `${fieldText(r, 'first_name')} ${fieldText(r, 'last_name')}`.trim(),
      subtitle: fieldText(r, 'email'),
    }),
    orderby: ['r.v_last_name asc'],
  });

  // Step 3 (optional): All teams
  const teams = useRecordSearch(servicePort, 'teams', {
    searchFields: ['name'],
    toItem: r => ({ id: r.id, title: fieldText(r, 'name') }),
    orderby: ['r.v_name asc'],
  });

  // One form that covers the fields we update on the ticket
  const f = useStepForm('tickets', {
    fields: ['assigned_agent', 'team', 'status'],
    steps: { assigned_agent: 2, team: 3, status: 3 },
    required: {
      // Fields not asked by this flow that are required on the entity:
      // title, priority, reporter_name, reporter_email, due, opened_on, estimated_hours
      // are NOT changed — suppress their required-guard so the summary doesn't list them
      title: false,
      priority: false,
      reporter_name: false,
      reporter_email: false,
      due: false,
      opened_on: false,
      estimated_hours: false,
      // team is genuinely optional
      team: false,
    },
    messages: {
      assigned_agent: tx('Bitte einen aktiven Agenten für dieses Ticket auswählen.'),
      status: tx('Bitte den neuen Status für dieses Ticket wählen.'),
    },
  });

  // Track the selected ticket's id for the update plan
  const [ticketId, setTicketId] = useState<string | null>(null);

  // Plan: update the selected ticket with the form values
  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'ticket',
        entity: 'tickets',
        form: f,
        updates: () => ticketId ?? undefined,
        primary: true,
        verb: 'update',
      },
    ],
    { draftKey: DRAFT_KEY },
  );

  // Status options: only the three assignable ones
  const allStatusOptions = LOOKUP_OPTIONS['tickets']?.['status'] ?? [];
  const statusOptions = allStatusOptions.filter(o =>
    (ASSIGNABLE_STATUSES as readonly string[]).includes(o.key),
  );

  return (
    <IntentWizardShell
      title={tx('Ticket zuweisen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey={DRAFT_KEY}
      intro={{
        description: tx('Ein offenes Ticket einem aktiven Agenten und optional einem Team zuweisen.'),
        needs: [tx('Ticket-Titel oder Name der meldenden Person')],
      }}
    >
      {/* Step 1: Pick an open ticket */}
      <WizardStep
        label={tx('Ticket')}
        description={tx('Wähle ein offenes Ticket aus — nur Tickets mit Status „Neu" oder „In Bearbeitung" werden angezeigt.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={ticketId}
          onSelect={id => {
            setTicketId(id);
            // Pre-fill status from the existing ticket record
            const rec = tickets.recordOf(id);
            if (rec) {
              const currentStatus = fieldLookup(rec, 'status')?.key ?? null;
              // Only pre-fill if it's one of the assignable statuses
              if (currentStatus && (ASSIGNABLE_STATUSES as readonly string[]).includes(currentStatus)) {
                f.set('status', currentStatus);
              }
              // Pre-fill existing agent if any
              const existingAgent = rec.fields['assigned_agent'];
              if (existingAgent) {
                const agentId = typeof existingAgent === 'string'
                  ? existingAgent.split('/').pop() ?? null
                  : null;
                if (agentId) {
                  f.set('assigned_agent', agentId, agenten.labelOf(agentId));
                }
              }
            }
            setStep(2);
          }}
          emptyText={tx('Keine offenen Tickets — alle Tickets sind abgeschlossen oder warten auf den Kunden.')}
          create={false}
          avatar="none"
          searchPlaceholder={tx('Ticket suchen…')}
        />
      </WizardStep>

      {/* Step 2: Assign an active agent */}
      <WizardStep
        label={tx('Agent')}
        description={tx('Wähle einen aktiven Agenten aus — inaktive Mitarbeitende werden nicht angezeigt.')}
        needs={['status']}
      >
        {ticketId ? (
          <EntitySelectStep
            {...agenten.select}
            selectedId={f.get('assigned_agent') as string | null}
            onSelect={id => {
              f.set('assigned_agent', id, agenten.labelOf(id));
              setStep(3);
            }}
            emptyText={tx('Keine aktiven Agenten gefunden — bitte zuerst Mitarbeitende als aktiv markieren.')}
            create={false}
            avatar="initials"
            searchPlaceholder={tx('Agent suchen…')}
          />
        ) : (
          <StepNav
            onBack={() => setStep(1)}
            nextDisabled
          >
            {tx('Bitte zuerst ein Ticket in Schritt 1 auswählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Step 3: Optional team + status */}
      <WizardStep
        label={tx('Team & Status')}
        description={tx('Optional ein Team zuweisen und den Status des Tickets festlegen.')}
      >
        <div className="space-y-6">
          {/* Optional team pick */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              {tx('Team')}
              <span className="ml-1 text-xs text-muted-foreground">{tx('(optional)')}</span>
            </p>
            <EntitySelectStep
              {...teams.select}
              selectedId={f.get('team') as string | null}
              onSelect={id => {
                // Toggle: clicking the selected team deselects it
                const current = f.get('team') as string | null;
                if (current === id) {
                  f.set('team', null, '');
                } else {
                  f.set('team', id, teams.labelOf(id));
                }
              }}
              emptyText={tx('Keine Teams vorhanden.')}
              create={false}
              avatar="none"
              searchPlaceholder={tx('Team suchen…')}
              mode="pills"
            />
          </div>

          {/* Status choice — only the three assignable values */}
          <Field form={f} name="status">
            <ChoiceGroup
              {...f.choice('status')}
              options={statusOptions}
            />
          </Field>

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => f.validate(['status'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Step 4: Review & confirm */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done ? (
          <SummaryStep
            forms={[f]}
            submit={submit}
            items={
              ticketId
                ? [
                    {
                      key: '_ticket',
                      label: tx('Ticket'),
                      value: tickets.labelOf(ticketId) ?? ticketId,
                      step: 1,
                    },
                  ]
                : []
            }
            whatHappensNext={tx('Das Ticket wird sofort dem gewählten Agenten zugewiesen und der Status aktualisiert.')}
            confirmLabel={tx('Zuweisen')}
          />
        ) : null}
      </WizardStep>

      {/* Success screen */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          forms={[f]}
          verb="updated"
          restartLabel={tx('Weiteres Ticket zuweisen')}
          whatHappensNext={tx('Der Agent sieht das Ticket in seiner Übersicht. Du kannst jetzt eine Notiz hinzufügen.')}
          next={[
            {
              label: tx('Notiz hinzufügen'),
              href: '#/intents/notiz-hinzufuegen',
            },
            {
              label: tx('Neues Ticket erfassen'),
              href: '#/intents/neues-ticket',
            },
            {
              label: tx('Zum Dashboard'),
              href: '#/',
            },
          ]}
          actions={{ copy: false, print: false }}
        />
      )}
    </IntentWizardShell>
  );
}
