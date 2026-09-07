/**
 * Ticket zuweisen — 3-Schritt-Wizard.
 * Steps: 1) Ticket wählen → 2) Agent & Team wählen → 3) Prüfen & aktualisieren.
 * Reads: tickets (gefiltert: status not 'closed'/'resolved'), mitarbeitende (active=true), teams (alle).
 * Writes: tickets (updateTicketsEntry — setzt assigned_agent, team, status='in_progress').
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
  const [step, setStep] = useState(1);

  // Step 1: Tickets — only open/active ones (not closed or resolved)
  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status not in ['closed', 'resolved']",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key !== 'closed' && key !== 'resolved';
    },
    searchFields: ['title', 'reporter_name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title') ?? tx('Ohne Titel'),
      subtitle: fieldText(t, 'reporter_name') ?? undefined,
      status: fieldLookup(t, 'status') ?? undefined,
    }),
  });

  // Step 2a: Mitarbeitende — only active agents
  const mitarbeitende = useRecordSearch(servicePort, 'mitarbeitende', {
    filter: "r.v_active == True",
    where: r => r.fields['active'] === true,
    searchFields: ['first_name', 'last_name', 'email'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'first_name') ?? ''} ${fieldText(m, 'last_name') ?? ''}`.trim() || tx('Ohne Name'),
      subtitle: fieldText(m, 'email') ?? undefined,
    }),
  });

  // Step 2b: Teams — all teams eligible
  const teams = useRecordSearch(servicePort, 'teams', {
    searchFields: ['name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'name') ?? tx('Ohne Name'),
    }),
  });

  // One form for the update — fields: assigned_agent, team (team is optional in this flow)
  const zuweisung = useStepForm('tickets', {
    steps: { assigned_agent: 2, team: 2 },
    required: { team: false },
  });

  // Update-only plan: updates the picked ticket with agent, team, and status='in_progress'
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'ticket',
      entity: 'tickets',
      form: zuweisung,
      updates: zuweisung.get('_recordId') as string,
      primary: true,
      values: { status: 'in_progress' },
    },
  ], { draftKey: 'ticket-zuweisen' });

  return (
    <IntentWizardShell
      title={tx('Ticket zuweisen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[zuweisung]}
      draftKey="ticket-zuweisen"
      intro={{
        description: tx('Ein offenes Ticket einem Agenten zuweisen und den Status auf „In Bearbeitung" setzen.'),
        needs: [tx('Ticket'), tx('Zuständiger Agent')],
      }}
    >
      {/* Step 1 — Ticket wählen */}
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Ein offenes oder laufendes Ticket auswählen, das zugewiesen werden soll.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={zuweisung.get('_recordId') as string | undefined}
          onSelect={id => {
            zuweisung.set('_recordId', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen Tickets vorhanden. Alle Tickets sind geschlossen oder gelöst.')}
          searchPlaceholder={tx('Ticket suchen …')}
          create={false}
        />
      </WizardStep>

      {/* Step 2 — Agent & Team wählen */}
      <WizardStep
        label={tx('Agent & Team')}
        description={tx('Einen aktiven Agenten wählen. Ein Team ist optional.')}
        needs={['_recordId']}
      >
        <div className="space-y-8">
          {/* Agent selection */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">{tx('Zuständiger Agent')}</p>
            <EntitySelectStep
              {...mitarbeitende.select}
              selectedId={zuweisung.get('assigned_agent') as string | undefined}
              onSelect={id => {
                zuweisung.set('assigned_agent', id, mitarbeitende.labelOf(id));
              }}
              emptyText={tx('Keine aktiven Mitarbeitenden gefunden.')}
              searchPlaceholder={tx('Agent suchen …')}
              create={false}
            />
          </div>

          {/* Team selection (optional) */}
          <div>
            <p className="text-sm font-medium text-foreground mb-1">{tx('Team')}</p>
            <p className="text-xs text-muted-foreground mb-3">{tx('Optional — Ticket einem Team zuordnen.')}</p>
            <EntitySelectStep
              {...teams.select}
              selectedId={zuweisung.get('team') as string | undefined}
              onSelect={id => {
                zuweisung.set('team', id, teams.labelOf(id));
              }}
              emptyText={tx('Keine Teams vorhanden.')}
              searchPlaceholder={tx('Team suchen …')}
              create={false}
            />
          </div>

          <StepNav
            onNext={() => zuweisung.validate(['assigned_agent'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Step 3 — Prüfen & bestätigen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[zuweisung]}
            submit={submit}
            items={[
              {
                key: 'status_change',
                keys: ['status_change'],
                label: tx('Neuer Status'),
                value: tx('In Bearbeitung'),
              },
            ]}
            whatHappensNext={tx('Das Ticket wird sofort dem gewählten Agenten zugewiesen und auf „In Bearbeitung" gesetzt.')}
            confirmLabel={tx('Jetzt zuweisen')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[zuweisung]}
          actions={{ copy: false, print: false }}
          next={[
            {
              label: tx('Weiteres Ticket zuweisen'),
              onClick: () => {
                submit.reset();
                zuweisung.reset();
                setStep(1);
              },
            },
            { label: tx('Notiz hinzufügen'), href: '#/intents/notiz-hinzufuegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Der Agent erhält die Zuweisung. Über „Notiz hinzufügen" kannst du weitere Informationen zum Ticket ergänzen.')}
        />
      )}
    </IntentWizardShell>
  );
}
