/**
 * Neues Ticket — 3-Schritt-Wizard.
 * Steps: 1) Meldung (Melderdaten + Titel + Beschreibung) → 2) Einordnung (Priorität, Kategorie, Datum) → 3) Asset (optional) → Prüfen & anlegen.
 * Reads: assets. Writes: tickets (createTicket).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { useClock } from '@/lib/polish';
import { tx } from '@/i18n';

export default function NeuesTicketPage() {
  const clock = useClock();
  const [step, setStep] = useState(1);

  const assets = useRecordSearch(servicePort, 'assets', {
    searchFields: ['name', 'serial_number'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'name') ?? tx('Unbenanntes Asset'),
      subtitle: fieldText(a, 'serial_number') ?? undefined,
    }),
  });

  const ticket = useStepForm('tickets', {
    steps: {
      reporter_name: 1,
      reporter_email: 1,
      reporter_phone: 1,
      title: 1,
      description: 1,
      priority: 2,
      category: 2,
      opened_on: 2,
      due: 2,
      affected_asset: 3,
    },
    initial: {
      opened_on: format(clock, 'yyyy-MM-dd'),
    },
    required: {
      reporter_phone: false,
      description: false,
      category: false,
      due: false,
      affected_asset: false,
    },
  });

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'ticket',
        entity: 'tickets',
        form: ticket,
        primary: true,
        values: { status: 'new' },
      },
    ],
    { draftKey: 'neues-ticket' },
  );

  return (
    <IntentWizardShell
      title={tx('Neues Ticket')}
      currentStep={step}
      onStepChange={setStep}
      forms={[ticket]}
      draftKey="neues-ticket"
      intro={{
        description: tx('Einen neuen Support-Auftrag in drei Schritten erfassen.'),
        needs: [tx('Name und Kontakt des Melders'), tx('Priorität und Kategorie')],
      }}
    >
      {/* Schritt 1: Meldung */}
      <WizardStep
        label={tx('Meldung')}
        description={tx('Wer meldet das Problem und was ist passiert?')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="reporter_name" />
          <Bound form={ticket} name="reporter_email" />
          <Bound form={ticket} name="reporter_phone" />
          <Bound form={ticket} name="title" />
          <Bound form={ticket} name="description" rows={4} />
          <StepNav
            hideBack
            onNext={() => ticket.validate(['reporter_name', 'reporter_email', 'title'])}
            nextStepLabel={tx('Einordnung')}
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Einordnung */}
      <WizardStep
        label={tx('Einordnung')}
        description={tx('Priorität, Kategorie und Termine festlegen.')}
      >
        <div className="space-y-4">
          <Field form={ticket} name="priority">
            <ChoiceGroup {...ticket.choice('priority')} />
          </Field>
          <Field form={ticket} name="category">
            <ChoiceGroup {...ticket.choice('category')} allowClear />
          </Field>
          <Bound form={ticket} name="opened_on" />
          <Bound form={ticket} name="due" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => ticket.validate(['priority', 'opened_on'])}
            nextStepLabel={tx('Asset (optional)')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Asset (optional) */}
      <WizardStep
        label={tx('Asset (optional)')}
        description={tx('Welches Gerät oder welche Ressource ist betroffen? Schritt kann übersprungen werden.')}
      >
        <EntitySelectStep
          {...assets.select}
          selectedId={ticket.get('affected_asset') as string}
          onSelect={id => {
            ticket.set('affected_asset', id, assets.labelOf(id));
          }}
          emptyText={tx('Kein Asset gefunden. Schritt kann übersprungen werden.')}
          searchPlaceholder={tx('Name oder Seriennummer suchen …')}
        />
        <StepNav
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextStepLabel={tx('Prüfen')}
          nextLabel={
            ticket.get('affected_asset')
              ? tx('Weiter: Prüfen')
              : tx('Überspringen & Prüfen')
          }
        />
      </WizardStep>

      {/* Schritt 4: Prüfen & anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[ticket]}
            submit={submit}
            whatHappensNext={tx(
              'Das Ticket erscheint sofort in der Warteschlange mit Status „Neu" und kann einem Mitarbeitenden zugewiesen werden.',
            )}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[ticket]}
          next={[
            { label: tx('Weiteres Ticket erfassen'), onClick: () => { submit.reset(); ticket.reset(); setStep(1); } },
            { label: tx('Ticket zuweisen'), href: '#/intents/ticket-zuweisen' },
            { label: tx('Notiz hinzufügen'), href: '#/intents/notiz-hinzufuegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx(
            'Das Ticket kann nun einem Agenten zugewiesen oder mit einer Notiz versehen werden.',
          )}
        />
      )}
    </IntentWizardShell>
  );
}
