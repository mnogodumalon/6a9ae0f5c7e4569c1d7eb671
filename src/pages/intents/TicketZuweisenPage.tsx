/**
 * Ticket zuweisen — 3-Schritt-Wizard.
 * Steps: 1) Ticket wählen → 2) Agenten zuweisen → 3) Team (optional) → 4) Prüfen & speichern.
 * Reads: tickets, mitarbeitende, teams. Writes: tickets (updateTicket — assigned_agent, team).
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
import { createRecordUrl } from '@/services/livingAppsService';
import { tx } from '@/i18n';

export default function TicketZuweisenPage() {
  const [step, setStep] = useState(1);

  const tickets = useRecordSearch(servicePort, 'tickets', {
    searchFields: ['title', 'reporter_name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title') ?? t.id,
      subtitle: fieldText(t, 'reporter_name') ?? undefined,
      status: fieldLookup(t, 'status') ?? undefined,
    }),
    filter: "r.v_status != 'closed' and r.v_status != 'resolved'",
    where: r => fieldLookup(r, 'status')?.key !== 'closed' && fieldLookup(r, 'status')?.key !== 'resolved',
  });

  const agenten = useRecordSearch(servicePort, 'mitarbeitende', {
    searchFields: ['first_name', 'last_name', 'email'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'first_name') ?? ''} ${fieldText(m, 'last_name') ?? ''}`.trim(),
      subtitle: fieldText(m, 'email') ?? undefined,
    }),
    filter: "r.v_active == True",
    where: r => r.fields.active === true,
  });

  const teams = useRecordSearch(servicePort, 'teams', {
    searchFields: ['name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'name') ?? t.id,
    }),
  });

  const f = useStepForm('tickets', {
    steps: {
      ticket: 1,
      assigned_agent: 2,
      team: 3,
    },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'zuweisung',
      run: async () => {
        const ticketId = f.get('ticket') as string;
        const agentId = f.get('assigned_agent') as string;
        const teamId = f.get('team') as string | undefined;
        return await import('@/services/livingAppsService').then(({ LivingAppsService }) =>
          LivingAppsService.updateTicket(ticketId, {
            assigned_agent: createRecordUrl(APP_IDS.MITARBEITENDE, agentId),
            team: teamId ? createRecordUrl(APP_IDS.TEAMS, teamId) : undefined,
          })
        );
      },
    },
  ], { draftKey: 'ticket-zuweisen' });

  const restart = () => {
    submit.reset();
    f.reset();
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Ticket zuweisen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="ticket-zuweisen"
      intro={{
        description: tx('Ein offenes Ticket einem Agenten und optional einem Team zuweisen.'),
        needs: [tx('Offenes Ticket'), tx('Aktiver Agent')],
      }}
    >
      <WizardStep
        label={tx('Ticket')}
        description={tx('Wähle das Ticket, das zugewiesen werden soll.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={f.get('ticket') as string | undefined}
          onSelect={id => {
            f.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen Tickets gefunden.')}
          searchPlaceholder={tx('Ticket oder Melder suchen…')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Agent')}
        description={tx('Wähle den Agenten, der das Ticket bearbeiten soll.')}
      >
        {f.get('ticket') ? (
          <EntitySelectStep
            {...agenten.select}
            selectedId={f.get('assigned_agent') as string | undefined}
            onSelect={id => {
              f.set('assigned_agent', id, agenten.labelOf(id));
              setStep(3);
            }}
            emptyText={tx('Keine aktiven Agenten gefunden.')}
            searchPlaceholder={tx('Name oder E-Mail suchen…')}
            create={false}
          />
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst ein Ticket wählen.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep
        label={tx('Team')}
        description={tx('Team optional zuweisen — kann auch leer bleiben.')}
      >
        {f.get('assigned_agent') ? (
          <div className="space-y-4">
            <EntitySelectStep
              {...teams.select}
              selectedId={f.get('team') as string | undefined}
              onSelect={id => {
                f.set('team', id, teams.labelOf(id));
              }}
              searchPlaceholder={tx('Team suchen…')}
              create={false}
            />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => true}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(2)} nextDisabled>
            {tx('Bitte zuerst einen Agenten wählen.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Das Ticket erscheint sofort in der Warteschlange des zugewiesenen Agenten.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          next={[
            { label: tx('Weiteres Ticket zuweisen'), onClick: restart },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Der Agent wird über die Zuweisung informiert.')}
        />
      )}
    </IntentWizardShell>
  );
}
