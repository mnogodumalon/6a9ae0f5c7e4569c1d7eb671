/**
 * Neues Ticket — 4-Schritt-Wizard.
 * Steps: 1) Meldende Person → 2) Ticket-Details → 3) Betroffenes Asset (optional) → 4) Prüfen & anlegen.
 * Reads: assets. Writes: tickets (via servicePort).
 * Composes: IntentWizardShell, Bound, Field, StepNav, SummaryStep, SuccessStep, ChoiceGroup, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { APP_IDS } from '@/types/app';
import { createRecordUrl } from '@/services/livingAppsService';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

export default function NeuesTicketPage() {
  const [step, setStep] = useState(1);

  const assets = useRecordSearch(servicePort, 'assets', {
    searchFields: ['name', 'serial_number'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'name') ?? a.id,
      subtitle: fieldText(a, 'serial_number') ?? undefined,
    }),
  });

  // One form per logical group of fields; steps maps each field to its step number
  const reporter = useStepForm('tickets', {
    steps: {
      reporter_name: 1,
      reporter_email: 1,
      reporter_phone: 1,
    },
  });

  const ticketDetails = useStepForm('tickets', {
    steps: {
      title: 2,
      description: 2,
      priority: 2,
      category: 2,
      due: 2,
      estimated_hours: 2,
    },
  });

  const assetStep = useStepForm('tickets', {
    steps: { affected_asset: 3 },
  });

  const selectedAssetId = assetStep.get('affected_asset') as string | undefined;

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'ticket',
        entity: 'tickets',
        primary: true,
        run: async () => {
          const assetId = selectedAssetId;
          return servicePort.create('tickets', {
            ...reporter.payload(),
            ...ticketDetails.payload(),
            status: 'new',
            opened_on: format(new Date(), 'yyyy-MM-dd'),
            billable: false,
            ...(assetId
              ? { affected_asset: createRecordUrl(APP_IDS.ASSETS, assetId) }
              : {}),
          });
        },
      },
    ],
    { draftKey: 'neues-ticket' }
  );

  const restart = () => {
    submit.reset();
    reporter.reset();
    ticketDetails.reset();
    assetStep.reset();
    setStep(1);
  };

  const steps = [
    { label: tx('Meldende Person'), key: 'reporter' },
    { label: tx('Ticket-Details'), key: 'details' },
    { label: tx('Betroffenes Asset'), key: 'asset', enabledIf: true },
    { label: tx('Prüfen'), key: 'review' },
  ];

  return (
    <IntentWizardShell
      title={tx('Neues Ticket eröffnen')}
      currentStep={step}
      onStepChange={setStep}
      steps={steps}
      forms={[reporter, ticketDetails, assetStep]}
      draftKey="neues-ticket"
      intro={{
        description: tx('Support-Ticket mit Melder, Priorität und Kategorie anlegen.'),
        needs: [tx('Name und E-Mail der meldenden Person'), tx('Kurzer Titel und Priorität')],
      }}
    >
      {/* ── Step 1: Meldende Person ── */}
      {step === 1 && (
        <div className="space-y-4">
          <Bound form={reporter} name="reporter_name" />
          <Bound form={reporter} name="reporter_email" />
          <Bound form={reporter} name="reporter_phone" />
          <StepNav
            hideBack
            onNext={() => reporter.validate(['reporter_name', 'reporter_email'])}
            nextStepLabel={tx('Ticket-Details')}
          />
        </div>
      )}

      {/* ── Step 2: Ticket-Details ── */}
      {step === 2 && (
        <div className="space-y-4">
          <Bound form={ticketDetails} name="title" />
          <Bound form={ticketDetails} name="description" />
          <Field form={ticketDetails} name="priority">
            <ChoiceGroup {...ticketDetails.choice('priority')} />
          </Field>
          <Field form={ticketDetails} name="category">
            <ChoiceGroup {...ticketDetails.choice('category')} />
          </Field>
          <Bound form={ticketDetails} name="due" />
          <Bound form={ticketDetails} name="estimated_hours" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() =>
              ticketDetails.validate(['title', 'priority', 'due', 'estimated_hours'])
            }
            nextStepLabel={tx('Betroffenes Asset')}
          />
        </div>
      )}

      {/* ── Step 3: Betroffenes Asset (optional, skippable) ── */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {tx('Diesen Schritt kannst du überspringen, wenn kein Asset betroffen ist.')}
          </p>
          <EntitySelectStep
            {...assets.select}
            selectedId={selectedAssetId}
            onSelect={id => {
              if (id === selectedAssetId) {
                assetStep.set('affected_asset', '', '');
              } else {
                assetStep.set('affected_asset', id, assets.labelOf(id));
              }
            }}
            emptyText={tx('Keine Assets vorhanden.')}
            create={false}
          />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            nextStepLabel={tx('Prüfen')}
            nextLabel={selectedAssetId ? undefined : tx('Überspringen')}
          />
        </div>
      )}

      {/* ── Step 4: Prüfen & anlegen ── */}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[reporter, ticketDetails, assetStep]}
          submit={submit}
          whatHappensNext={tx(
            'Das Ticket erscheint sofort in der Ticket-Übersicht und kann einem Mitarbeitenden zugewiesen werden.'
          )}
        />
      )}

      {/* ── Erfolg ── */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[reporter, ticketDetails, assetStep]}
          next={[
            { label: tx('Weiteres Ticket eröffnen'), onClick: restart },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx(
            'Das Ticket kann über den Workflow „Ticket zuweisen" einem Mitarbeitenden oder Team zugeordnet werden.'
          )}
        />
      )}
    </IntentWizardShell>
  );
}
