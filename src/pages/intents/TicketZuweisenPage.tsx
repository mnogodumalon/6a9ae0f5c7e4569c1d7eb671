/**
 * Ticket zuweisen — 2-Schritt-Wizard.
 * Steps: 1) Ticket wählen (nur neue oder laufende) → 2) Zuweisung (Agent, Team, Status).
 * Reads: tickets, mitarbeitende, teams. Writes: tickets (update via updateTicketsEntry).
 * Composes: IntentWizardShell, EntitySelectStep, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { APP_IDS } from '@/types/app';
import { tx } from '@/i18n';
import { Field } from '@/components/blocks/Field';

export default function TicketZuweisenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Tickets — nur neue oder laufende anzeigen
  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status == 'new' or r.v_status == 'in_progress'",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key === 'new' || key === 'in_progress';
    },
    searchFields: ['title', 'reporter_name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title') ?? tx('Ohne Titel'),
      subtitle: fieldText(t, 'reporter_name') ?? undefined,
      status: fieldLookup(t, 'status') ?? undefined,
    }),
  });

  // Step 2: Mitarbeitende — nur aktive
  const mitarbeitende = useRecordSearch(servicePort, 'mitarbeitende', {
    filter: 'r.v_active == True',
    where: r => r.fields['active'] === true,
    searchFields: ['first_name', 'last_name', 'email'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'first_name') ?? ''} ${fieldText(m, 'last_name') ?? ''}`.trim(),
      subtitle: fieldText(m, 'email') ?? undefined,
    }),
  });

  // Step 2: Teams — alle Teams
  const teams = useRecordSearch(servicePort, 'teams', {
    searchFields: ['name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'name') ?? tx('Ohne Name'),
    }),
  });

  // Formular für Schritt 1: Ticket-Auswahl (kein Schreiben, nur Tracking)
  const step1selectForm = useStepForm('tickets', {
    steps: { _ticket: 1 },
  });

  // Formular für Schritt 2: Zuweisung
  const step2form = useStepForm('tickets', {
    steps: {
      assigned_agent: 2,
      team: 2,
      status: 2,
    },
  });

  // Wir merken uns die Ticket-ID für das Update
  const selectedTicketId = step1selectForm.get('_ticket') as string | undefined;

  // Plan: Ticket aktualisieren mit neuem Agenten, Team und Status
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'zuweisung',
      entity: 'tickets',
      form: step2form,
      updates: selectedTicketId ?? '',
      values: {
        assigned_agent: step2form.get('assigned_agent') as string | undefined
          ? `${APP_IDS.MITARBEITENDE}/${step2form.get('assigned_agent')}`
          : undefined,
        team: step2form.get('team') as string | undefined
          ? `${APP_IDS.TEAMS}/${step2form.get('team')}`
          : undefined,
      },
      primary: true,
    },
  ], { draftKey: 'ticket-zuweisen' });

  const restart = () => {
    submit.reset();
    step1selectForm.reset();
    step2form.reset();
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Ticket zuweisen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[step1selectForm, step2form]}
      draftKey="ticket-zuweisen"
      intro={{
        description: tx('Ein Ticket einem Mitarbeitenden und einem Team zuweisen.'),
        needs: [tx('Offenes oder laufendes Ticket'), tx('Zuständiger Mitarbeitende')],
      }}
    >
      {/* Schritt 1: Ticket wählen */}
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Nur offene und laufende Tickets können zugewiesen werden.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={step1selectForm.get('_ticket') as string | undefined}
          onSelect={id => {
            step1selectForm.set('_ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen oder laufenden Tickets vorhanden.')}
          create={false}
        />
      </WizardStep>

      {/* Schritt 2: Zuweisung */}
      <WizardStep
        label={tx('Zuweisung')}
        description={tx('Agent, Team und Status für das Ticket festlegen.')}
        needs={['_ticket']}
      >
        <div className="space-y-6">
          {/* Agenten wählen */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">{tx('Zuständiger Mitarbeitender')}</p>
            <EntitySelectStep
              {...mitarbeitende.select}
              selectedId={step2form.get('assigned_agent') as string | undefined}
              onSelect={id => {
                step2form.set('assigned_agent', id, mitarbeitende.labelOf(id));
              }}
              emptyText={tx('Keine aktiven Mitarbeitenden gefunden.')}
              create={false}
            />
          </div>

          {/* Team wählen */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">{tx('Team')}</p>
            <EntitySelectStep
              {...teams.select}
              selectedId={step2form.get('team') as string | undefined}
              onSelect={id => {
                step2form.set('team', id, teams.labelOf(id));
              }}
              create={false}
            />
          </div>

          {/* Status */}
          <Field form={step2form} name="status">
            <ChoiceGroup {...step2form.choice('status')} />
          </Field>

          <StepNav
            onNext={() => step2form.validate(['assigned_agent', 'status'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Prüfen & Bestätigen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[step1selectForm, step2form]}
            submit={submit}
            whatHappensNext={tx('Das Ticket wird sofort dem gewählten Mitarbeitenden und Team zugewiesen.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[step1selectForm, step2form]}
          next={[
            { label: tx('Weiteres Ticket zuweisen'), onClick: restart },
            { label: tx('Notiz hinzufügen'), href: '#/intents/notiz-hinzufuegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Der Mitarbeitende sieht das Ticket in seiner Übersicht.')}
        />
      )}
    </IntentWizardShell>
  );
}
