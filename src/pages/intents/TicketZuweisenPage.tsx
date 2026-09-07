/**
 * Ticket zuweisen — 3-Schritt-Wizard + Prüfen & Bestätigen.
 * Steps: 1) Ticket wählen (nur new/in_progress/waiting_for_customer) →
 *         2) Agent wählen (nur aktive Mitarbeitende) →
 *         3) Team wählen (optional) →
 *         4) Prüfen & Zuweisen.
 * Reads: tickets, mitarbeitende, teams.
 * Writes: tickets (update assigned_agent, team, status via useJourneySubmit).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { APP_IDS } from '@/types/app';
import { tx } from '@/i18n';

export default function TicketZuweisenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Nur offene Tickets (new, in_progress, waiting_for_customer)
  const tickets = useRecordSearch(servicePort, 'tickets', {
    searchFields: ['title', 'reporter_name'],
    filter: "r.v_status in ['new', 'in_progress', 'waiting_for_customer']",
    where: r => {
      const key = fieldLookup(r, 'status')?.key ?? (r.fields.status as string | undefined);
      return key === 'new' || key === 'in_progress' || key === 'waiting_for_customer';
    },
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title') ?? tx('(Kein Titel)'),
      subtitle: fieldText(t, 'reporter_name') ?? undefined,
      status: fieldLookup(t, 'status') ?? undefined,
    }),
  });

  // Step 2: Nur aktive Agenten
  const agenten = useRecordSearch(servicePort, 'mitarbeitende', {
    searchFields: ['first_name', 'last_name', 'email'],
    filter: "r.v_active == True",
    where: r => r.fields.active === true,
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'first_name') ?? ''} ${fieldText(m, 'last_name') ?? ''}`.trim(),
      subtitle: fieldText(m, 'email') ?? undefined,
    }),
  });

  // Step 3: Alle Teams (optional)
  const teams = useRecordSearch(servicePort, 'teams', {
    searchFields: ['name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'name') ?? tx('(Kein Name)'),
    }),
  });

  // Ein Formular für das Update-Ticket (nur die Felder, die wir schreiben)
  const f = useStepForm('tickets', {
    steps: {
      ticket_id: 1,
      assigned_agent: 2,
      team: 3,
    },
    required: {
      ticket_id: true,
      assigned_agent: true,
      team: false,
    },
  });

  const selectedTicketId = f.get('ticket_id') as string | undefined;
  const selectedAgentId = f.get('assigned_agent') as string | undefined;
  const selectedTeamId = f.get('team') as string | undefined;

  // Plan: Update des Tickets mit Agent, optionalem Team und Status
  const extraValues: Record<string, string> = { status: 'in_progress' };
  if (selectedAgentId) {
    extraValues['assigned_agent'] = `${location.origin}/rest/apps/${APP_IDS.MITARBEITENDE}/records/${selectedAgentId}`;
  }
  if (selectedTeamId) {
    extraValues['team'] = `${location.origin}/rest/apps/${APP_IDS.TEAMS}/records/${selectedTeamId}`;
  }

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'ticket',
        entity: 'tickets',
        form: f,
        updates: selectedTicketId ?? '',
        primary: true,
        values: extraValues,
      },
    ],
    { draftKey: 'ticket-zuweisen' },
  );

  const ticketTitle = (selectedTicketId ? tickets.labelOf(selectedTicketId) : '') ?? '';
  const agentName = (selectedAgentId ? agenten.labelOf(selectedAgentId) : '') ?? '';
  const teamName = (selectedTeamId ? teams.labelOf(selectedTeamId) : '') ?? '';

  return (
    <IntentWizardShell
      title={tx('Ticket zuweisen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="ticket-zuweisen"
      intro={{
        description: tx('Ein offenes Ticket einem aktiven Agenten zuweisen.'),
        needs: [tx('Offenes Ticket'), tx('Zuständiger Agent')],
      }}
    >
      {/* Schritt 1: Ticket wählen */}
      <WizardStep
        label={tx('Ticket')}
        description={tx('Ein offenes Ticket wählen — gelöste und geschlossene Tickets sind ausgeblendet.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={selectedTicketId}
          onSelect={id => {
            f.set('ticket_id', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen Tickets gefunden. Alle Tickets sind bereits gelöst oder geschlossen.')}
          create={false}
        />
      </WizardStep>

      {/* Schritt 2: Agent wählen */}
      <WizardStep
        label={tx('Agent')}
        description={tx('Einen aktiven Agenten für dieses Ticket wählen.')}
        needs={['ticket_id']}
      >
        <EntitySelectStep
          {...agenten.select}
          selectedId={selectedAgentId}
          onSelect={id => {
            f.set('assigned_agent', id, agenten.labelOf(id));
            setStep(3);
          }}
          emptyText={tx('Keine aktiven Agenten gefunden. Bitte zuerst einen Agenten aktivieren.')}
          create={false}
        />
      </WizardStep>

      {/* Schritt 3: Team wählen (optional) */}
      <WizardStep
        label={tx('Team')}
        description={tx('Optional: Dem Ticket ein Team zuordnen.')}
        needs={['ticket_id', 'assigned_agent']}
      >
        <EntitySelectStep
          {...teams.select}
          selectedId={selectedTeamId}
          onSelect={id => {
            f.set('team', id, teams.labelOf(id));
            setStep(4);
          }}
          emptyText={tx('Noch keine Teams vorhanden.')}
          create={false}
        />
        <StepNav
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextStepLabel={tx('Prüfen')}
          nextLabel={selectedTeamId ? undefined : tx('Ohne Team fortfahren')}
        />
      </WizardStep>

      {/* Schritt 4: Prüfen & Bestätigen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            items={[
              { key: 'ticket', label: tx('Ticket'), value: ticketTitle, step: 1, keys: ['ticket_id'], fieldId: 'ticket_id' },
              { key: 'agent', label: tx('Agent'), value: agentName, step: 2, keys: ['assigned_agent'], fieldId: 'assigned_agent' },
              ...(teamName
                ? [{ key: 'team', label: tx('Team'), value: teamName, step: 3, keys: ['team'], fieldId: 'team' }]
                : []),
              { key: 'status', label: tx('Neuer Status'), value: tx('In Bearbeitung'), keys: [], fieldId: '' },
            ]}
            whatHappensNext={tx(
              'Das Ticket wird sofort dem Agenten zugewiesen und der Status auf „In Bearbeitung" gesetzt.',
            )}
            confirmLabel={tx('Jetzt zuweisen')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          title={tx('Ticket zugewiesen')}
          whatHappensNext={tx(
            'Der Agent kann das Ticket nun bearbeiten. Mit „Notiz hinzufügen" kannst du weitere Informationen ergänzen.',
          )}
          next={[
            {
              label: tx('Weiteres Ticket zuweisen'),
              onClick: () => {
                submit.reset();
                f.reset();
                setStep(1);
              },
            },
            {
              label: tx('Notiz hinzufügen'),
              href: '#/intents/notiz-hinzufuegen',
            },
            { label: tx('Neues Ticket erstellen'), href: '#/intents/neues-ticket' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          actions={{ copy: true, print: false }}
        />
      )}
    </IntentWizardShell>
  );
}
