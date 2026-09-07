/**
 * Neues Ticket — 4-Schritt-Wizard für Helpdesk-Dispatcher.
 * Steps: 1) Melder (reporter_name, reporter_email, reporter_phone)
 *        → 2) Ticket-Details (title, description, priority, category, due, estimated_hours)
 *        → 3) Asset (optional, affected_asset via EntitySelectStep)
 *        → 4) Prüfen & anlegen.
 * Reads: assets. Writes: tickets (createTicketsEntry).
 * Composes: IntentWizardShell, WizardStep, StepNav, ChoiceGroup, EntitySelectStep, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, todayIso } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';

export default function NeuesTicketPage() {
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
      title: 2,
      description: 2,
      priority: 2,
      category: 2,
      due: 2,
      estimated_hours: 2,
      affected_asset: 3,
    },
    initial: {
      opened_on: format(new Date(), 'yyyy-MM-dd'),
    },
    required: {
      affected_asset: false,
      estimated_hours: false,
      description: false,
      reporter_phone: false,
    },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'ticket',
      entity: 'tickets',
      form: ticket,
      primary: true,
      values: {
        status: 'new',
        opened_on: format(new Date(), 'yyyy-MM-dd'),
      },
    },
  ], { draftKey: 'neues-ticket' });

  const priorityOptions = LOOKUP_OPTIONS['tickets']?.['priority'] ?? [];
  const categoryOptions = LOOKUP_OPTIONS['tickets']?.['category'] ?? [];

  return (
    <IntentWizardShell
      title={tx('Neues Ticket')}
      currentStep={step}
      onStepChange={setStep}
      forms={[ticket]}
      draftKey="neues-ticket"
      intro={{
        description: tx('Helpdesk-Ticket mit Melderdaten, Priorität und Kategorie eröffnen.'),
        needs: [tx('Name des Melders'), tx('E-Mail-Adresse'), tx('Titel und Kategorie')],
      }}
    >
      {/* Step 1: Melder */}
      <WizardStep
        label={tx('Melder')}
        description={tx('Kontaktdaten der meldenden Person erfassen.')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="reporter_name" />
          <Bound form={ticket} name="reporter_email" />
          <Bound form={ticket} name="reporter_phone" />
          <StepNav
            onNext={() => ticket.validate(['reporter_name', 'reporter_email'])}
            nextStepLabel={tx('Ticket-Details')}
            hideBack
          />
        </div>
      </WizardStep>

      {/* Step 2: Ticket-Details */}
      <WizardStep
        label={tx('Ticket-Details')}
        description={tx('Titel, Beschreibung, Priorität und Kategorie des Tickets festlegen.')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="title" />
          <Bound form={ticket} name="description" rows={3} />
          <Field form={ticket} name="priority">
            <ChoiceGroup
              {...ticket.choice('priority')}
              options={priorityOptions}
            />
          </Field>
          <Field form={ticket} name="category">
            <ChoiceGroup
              {...ticket.choice('category')}
              options={categoryOptions}
            />
          </Field>
          <Bound form={ticket} name="due" />
          <Bound form={ticket} name="estimated_hours" hint={tx('Stunden')} />
          <StepNav
            onNext={() => ticket.validate(['title', 'priority', 'category', 'due'])}
            nextStepLabel={tx('Asset (optional)')}
          />
        </div>
      </WizardStep>

      {/* Step 3: Asset (optional) */}
      <WizardStep
        label={tx('Asset')}
        description={tx('Betroffenes Gerät oder Asset auswählen — dieser Schritt ist optional.')}
      >
        <EntitySelectStep
          {...assets.select}
          selectedId={ticket.get('affected_asset') as string | undefined}
          onSelect={id => {
            ticket.set('affected_asset', id, assets.labelOf(id));
            setStep(4);
          }}
          searchPlaceholder={tx('Asset suchen …')}
          emptyText={tx('Kein Asset gefunden. Fahre ohne weiter.')}
        />
        <div className="mt-4">
          <StepNav
            onNext={() => { setStep(4); return undefined; }}
            nextStepLabel={tx('Prüfen')}
            nextLabel={tx('Überspringen')}
          />
        </div>
      </WizardStep>

      {/* Step 4: Review */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[ticket]}
            submit={submit}
            whatHappensNext={tx('Das Ticket erscheint sofort in der Helpdesk-Übersicht und kann einem Agenten zugewiesen werden.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[ticket]}
          next={[
            {
              label: tx('Ticket zuweisen'),
              href: '#/intents/ticket-zuweisen',
            },
            {
              label: tx('Weiteres Ticket eröffnen'),
              onClick: () => { submit.reset(); ticket.reset(); setStep(1); },
            },
            {
              label: tx('Zum Dashboard'),
              href: '#/',
            },
          ]}
          whatHappensNext={tx('Das Ticket kann jetzt einem Agenten zugewiesen oder mit einer Notiz versehen werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
