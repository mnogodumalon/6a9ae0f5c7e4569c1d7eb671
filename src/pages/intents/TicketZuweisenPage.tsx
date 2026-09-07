/**
 * Ticket zuweisen — 4-Schritt-Wizard (Update-Flow).
 * Steps: 1) Ticket wählen → 2) Agent wählen → 3) Team (optional) → 4) Prüfen & speichern.
 * Reads: tickets (status new/in_progress), mitarbeitende (active=true), teams (alle).
 * Writes: tickets (update assigned_agent + team on the selected ticket).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useRecordSearch,
  useStepForm,
  useJourneySubmit,
  fieldLookup,
  fieldText,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

const DRAFT_KEY = 'ticket-zuweisen';

export default function TicketZuweisenPage() {
  const [step, setStep] = useState(1);

  // Step 1 — only tickets with status new or in_progress
  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status in ['new', 'in_progress']",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key === 'new' || key === 'in_progress';
    },
    searchFields: ['title', 'reporter_name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title'),
      subtitle: fieldText(t, 'reporter_name'),
      status: fieldLookup(t, 'status') ?? undefined,
    }),
  });

  // Step 2 — only active mitarbeitende
  const agenten = useRecordSearch(servicePort, 'mitarbeitende', {
    filter: "r.v_active == True",
    where: r => r.fields['active'] === true,
    searchFields: ['first_name', 'last_name', 'email'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'first_name')} ${fieldText(m, 'last_name')}`.trim(),
      subtitle: fieldText(m, 'email'),
    }),
  });

  // Step 3 — all teams (optional step)
  const teams = useRecordSearch(servicePort, 'teams', {
    searchFields: ['name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'name'),
      subtitle: fieldText(t, 'cost_center'),
    }),
  });

  // Form: only the fields we update on the ticket
  const f = useStepForm('tickets', {
    fields: ['assigned_agent', 'team'],
    steps: { assigned_agent: 2, team: 3 },
    required: { team: false },
  });

  // ticketId is stored separately since the ticket itself is the record we update
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketLabel, setTicketLabel] = useState<string>('');

  // Plan: update the selected ticket
  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'zuweisung',
        entity: 'tickets',
        form: f,
        updates: () => ticketId ?? '',
        primary: true,
        verb: 'update',
      },
    ],
    { draftKey: DRAFT_KEY },
  );

  const restart = () => {
    submit.reset();
    f.reset();
    setTicketId(null);
    setTicketLabel('');
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Ticket zuweisen')}
      subtitle={tx('Offenes Ticket einem Agenten und optional einem Team zuordnen.')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey={DRAFT_KEY}
      intro={{
        description: tx('Ein offenes Ticket einem aktiven Agenten zuweisen.'),
        needs: [tx('Das Ticket, das zugewiesen werden soll'), tx('Den Namen des Agenten')],
      }}
    >
      {/* Step 1 — Ticket wählen */}
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Nur offene und in Bearbeitung befindliche Tickets werden angezeigt.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={ticketId}
          onSelect={id => {
            setTicketId(id);
            setTicketLabel(tickets.labelOf(id) ?? '');
            setStep(2);
          }}
          emptyText={tx('Keine offenen Tickets vorhanden. Alle Tickets sind bereits geschlossen oder gelöst.')}
          searchPlaceholder={tx('Ticket oder meldende Person suchen …')}
          avatar="none"
        />
      </WizardStep>

      {/* Step 2 — Agent wählen */}
      <WizardStep
        label={tx('Agent wählen')}
        description={tx('Nur aktive Mitarbeitende sind verfügbar.')}
      >
        {step === 2 && !ticketId ? (
          <StepNav
            onBack={() => setStep(1)}
            nextDisabled
          >
            {tx('Bitte zuerst ein Ticket wählen.')}
          </StepNav>
        ) : (
          <EntitySelectStep
            {...agenten.select}
            selectedId={f.get('assigned_agent') as string | null}
            onSelect={id => {
              f.set('assigned_agent', id, agenten.labelOf(id));
              setStep(3);
            }}
            emptyText={tx('Keine aktiven Mitarbeitenden gefunden.')}
            searchPlaceholder={tx('Name oder E-Mail suchen …')}
            avatar="initials"
          />
        )}
      </WizardStep>

      {/* Step 3 — Team (optional) */}
      <WizardStep
        label={tx('Team (optional)')}
        description={tx('Du kannst das Ticket zusätzlich einem Team zuordnen — oder diesen Schritt überspringen.')}
      >
        {step === 3 && !f.get('assigned_agent') ? (
          <StepNav
            onBack={() => setStep(2)}
            nextDisabled
          >
            {tx('Bitte zuerst einen Agenten wählen.')}
          </StepNav>
        ) : (
          <>
            <EntitySelectStep
              {...teams.select}
              selectedId={f.get('team') as string | null}
              onSelect={id => {
                f.set('team', id, teams.labelOf(id));
                setStep(4);
              }}
              emptyText={tx('Noch keine Teams angelegt.')}
              searchPlaceholder={tx('Team suchen …')}
              avatar="none"
            />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              nextStepLabel={tx('Prüfen')}
            />
          </>
        )}
      </WizardStep>

      {/* Step 4 — Prüfen & speichern */}
      <WizardStep label={tx('Prüfen')}>
        {step === 4 && (!ticketId || !f.get('assigned_agent')) ? (
          <StepNav
            onBack={() => setStep(!f.get('assigned_agent') ? 2 : 1)}
            nextDisabled
          >
            {tx('Bitte Ticket und Agenten auswählen, bevor du bestätigst.')}
          </StepNav>
        ) : !submit.result ? (
          <SummaryStep
            forms={[f]}
            submit={submit}
            items={[
              {
                key: '_ticket',
                label: tx('Ticket'),
                value: ticketLabel,
                step: 1,
              },
            ]}
            whatHappensNext={tx('Das Ticket wird sofort dem gewählten Agenten zugeordnet.')}
            confirmLabel={tx('Zuweisen')}
          />
        ) : null}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          verb="updated"
          title={tx('Ticket zugewiesen')}
          whatHappensNext={tx('Der Agent sieht das Ticket in seiner Aufgabenliste. Notizen können über den Ablauf „Notiz hinzufügen" ergänzt werden.')}
          next={[
            { label: tx('Weiteres Ticket zuweisen'), onClick: restart },
            { label: tx('Notiz hinzufügen'), href: '#/intents/notiz-hinzufuegen' },
            { label: tx('Neues Ticket erfassen'), href: '#/intents/neues-ticket' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          actions={{ copy: false, print: false }}
        />
      )}
    </IntentWizardShell>
  );
}
