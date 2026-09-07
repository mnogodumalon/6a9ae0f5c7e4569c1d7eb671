/**
 * Ticket zuweisen — 3-Schritt-Wizard.
 * Steps: 1) Ticket wählen → 2) Mitarbeitende/r wählen → 3) Team wählen (optional) → 4) Prüfen & aktualisieren.
 * Reads: tickets (filter: status != closed/resolved), mitarbeitende (filter: active = true), teams (alle).
 * Writes: tickets (updateTicket) — setzt assigned_agent, team (optional), status auf 'in_progress' wenn 'new'.
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
import { tx } from '@/i18n';

export default function TicketZuweisenPage() {
  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status != 'closed' and r.v_status != 'resolved'",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key !== 'closed' && key !== 'resolved';
    },
    searchFields: ['title', 'reporter_name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title') ?? tx('(Kein Titel)'),
      subtitle: fieldText(t, 'reporter_name') ?? undefined,
      status: fieldLookup(t, 'status') ?? undefined,
    }),
  });

  const mitarbeitende = useRecordSearch(servicePort, 'mitarbeitende', {
    filter: "r.v_active == True",
    where: r => r.fields['active'] === true,
    searchFields: ['first_name', 'last_name', 'email'],
    toItem: m => ({
      id: m.id,
      title: [fieldText(m, 'first_name'), fieldText(m, 'last_name')].filter(Boolean).join(' ') || tx('(Kein Name)'),
      subtitle: fieldText(m, 'email') ?? undefined,
    }),
  });

  const teams = useRecordSearch(servicePort, 'teams', {
    searchFields: ['name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'name') ?? tx('(Kein Name)'),
    }),
  });

  const [step, setStep] = useState(1);

  // Form für den Ticket-Update: nur die zu ändernden Felder (kein create)
  const ticketForm = useStepForm('tickets', {
    steps: {
      ticket: 1,
      assigned_agent: 2,
      team: 3,
    },
    required: {
      ticket: true,
      assigned_agent: true,
      team: false,
    },
  });

  // Update-only plan: das Ticket wird aktualisiert, kein neuer Datensatz
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'zuweisung',
      entity: 'tickets',
      updates: ticketForm.get('ticket') as string,
      primary: true,
      values: (() => {
        const ticketId = ticketForm.get('ticket') as string;
        const ticketRecord = ticketId ? tickets.recordOf(ticketId) : null;
        const currentStatus = ticketRecord ? fieldLookup(ticketRecord, 'status')?.key : undefined;
        const agentId = ticketForm.get('assigned_agent') as string | undefined;
        const teamId = ticketForm.get('team') as string | undefined;
        const result: Record<string, unknown> = {};
        if (agentId) result['assigned_agent'] = agentId;
        if (teamId) result['team'] = teamId;
        if (currentStatus === 'new') result['status'] = 'in_progress';
        return result;
      })(),
    },
  ], { draftKey: 'ticket-zuweisen' });

  const restart = () => { submit.reset(); ticketForm.reset(); setStep(1); };

  return (
    <IntentWizardShell
      title={tx('Ticket zuweisen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[ticketForm]}
      draftKey="ticket-zuweisen"
      intro={{
        description: tx('Ticket einem Mitarbeitenden und optional einem Team zuweisen.'),
        needs: [tx('Offenes Ticket'), tx('Aktive/r Mitarbeitende/r')],
      }}
    >
      <WizardStep
        label={tx('Ticket')}
        description={tx('Wähle das zuzuweisende Ticket aus — nur offene und laufende Tickets werden angezeigt.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={ticketForm.get('ticket') as string}
          onSelect={id => {
            ticketForm.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen oder laufenden Tickets vorhanden.')}
          create={false}
        />
      </WizardStep>

      <WizardStep
        label={tx('Mitarbeitende/r')}
        description={tx('Wähle die Person, die dieses Ticket bearbeiten soll — nur aktive Mitarbeitende.')}
      >
        {ticketForm.get('ticket') ? (
          <>
            <EntitySelectStep
              {...mitarbeitende.select}
              selectedId={ticketForm.get('assigned_agent') as string}
              onSelect={id => {
                ticketForm.set('assigned_agent', id, mitarbeitende.labelOf(id));
                setStep(3);
              }}
              emptyText={tx('Keine aktiven Mitarbeitenden gefunden.')}
              create={false}
            />
          </>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst ein Ticket auswählen.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep
        label={tx('Team (optional)')}
        description={tx('Optional: Weise das Ticket zusätzlich einem Team zu.')}
      >
        {ticketForm.get('assigned_agent') ? (
          <div className="space-y-4">
            <EntitySelectStep
              {...teams.select}
              selectedId={ticketForm.get('team') as string}
              onSelect={id => {
                ticketForm.set('team', id, teams.labelOf(id));
                setStep(4);
              }}
              emptyText={tx('Noch keine Teams vorhanden.')}
              create={false}
            />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => { setStep(4); return undefined; }}
              nextStepLabel={tx('Prüfen')}
              nextLabel={tx('Weiter ohne Team')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(2)} nextDisabled>
            {tx('Bitte zuerst eine Person auswählen.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (() => {
          const ticketId = ticketForm.get('ticket') as string | undefined;
          const rec = ticketId ? tickets.recordOf(ticketId) : null;
          const currentStatus = rec ? fieldLookup(rec, 'status')?.key : undefined;
          const extraItems = currentStatus === 'new'
            ? [{ key: 'status_change', label: tx('Status wird gesetzt auf'), value: tx('In Bearbeitung') }]
            : [];
          return (
            <SummaryStep
              forms={[ticketForm]}
              submit={submit}
              whatHappensNext={tx('Das Ticket wird dem gewählten Mitarbeitenden zugewiesen und erscheint sofort in seiner Warteschlange.')}
              items={extraItems}
            />
          );
        })()}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[ticketForm]}
          actions={{ copy: false, print: false }}
          next={[
            { label: tx('Weiteres Ticket zuweisen'), onClick: restart },
            { label: tx('Neues Ticket erstellen'), href: '#/intents/neues-ticket' },
            { label: tx('Notiz hinzufügen'), href: '#/intents/notiz-hinzufuegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Der Mitarbeitende sieht das Ticket in seiner Aufgabenliste.')}
        />
      )}
    </IntentWizardShell>
  );
}
