/**
 * Neues Ticket — 3-Schritt-Wizard für Helpdesk-Dispatcher.
 * Steps: 1) Ticket-Details (Titel, Beschreibung, Kategorie, Priorität, Aufwand, Fälligkeit)
 *        → 2) Meldende Person (Name, E-Mail, Telefon)
 *        → 3) Betroffenes Asset (optional, EntitySelectStep über assets)
 *        → Prüfen & anlegen.
 * Reads: assets. Writes: tickets (createTicketsEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup,
 *           StepNav, SummaryStep, SuccessStep, Bound, Field.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, todayIso } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function NeuesTicketPage() {
  const [step, setStep] = useState(1);
  const [skipAsset, setSkipAsset] = useState(false);

  const assets = useRecordSearch(servicePort, 'assets', {
    searchFields: ['name', 'serial_number'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'name') ?? tx('Unbenannt'),
      subtitle: fieldText(a, 'serial_number') ?? undefined,
    }),
  });

  const ticket = useStepForm('tickets', {
    steps: {
      title: 1,
      description: 1,
      category: 1,
      priority: 1,
      estimated_hours: 1,
      due: 1,
      reporter_name: 2,
      reporter_email: 2,
      reporter_phone: 2,
      affected_asset: 3,
    },
    initial: {
      opened_on: format(new Date(), 'yyyy-MM-dd'),
    },
    required: {
      // reporter_phone is optional in the flow
      reporter_phone: false,
      // description and category are optional
      description: false,
      category: false,
      // affected_asset is optional
      affected_asset: false,
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

  return (
    <IntentWizardShell
      title={tx('Neues Ticket anlegen')}
      subtitle={tx('Helpdesk-Dispatcher')}
      currentStep={step}
      onStepChange={setStep}
      forms={[ticket]}
      draftKey="neues-ticket"
      intro={{
        description: tx('Ein neues Support-Ticket erfassen und der richtigen Kategorie zuordnen.'),
        needs: [tx('Kurzer Titel des Problems'), tx('Name und E-Mail der meldenden Person')],
      }}
    >
      {/* Schritt 1: Ticket-Details */}
      <WizardStep
        label={tx('Ticket-Details')}
        description={tx('Titel, Kategorie und Priorität des Tickets festhalten.')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="title" />
          <Bound form={ticket} name="description" rows={3} />
          <Bound form={ticket} name="category" />
          <Bound form={ticket} name="priority" />
          <Bound form={ticket} name="estimated_hours" hint={tx('Geschätzter Aufwand in Stunden')} />
          <Bound form={ticket} name="due" />
          <StepNav
            onNext={() => ticket.validate(['title', 'priority', 'estimated_hours', 'due'])}
            nextStepLabel={tx('Meldende Person')}
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Meldende Person */}
      <WizardStep
        label={tx('Meldende Person')}
        description={tx('Kontaktdaten der Person erfassen, die das Problem gemeldet hat.')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="reporter_name" />
          <Bound form={ticket} name="reporter_email" />
          <Bound form={ticket} name="reporter_phone" hint={tx('Optional')} />
          <StepNav
            onNext={() => ticket.validate(['reporter_name', 'reporter_email'])}
            nextStepLabel={tx('Betroffenes Asset')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Betroffenes Asset (optional) */}
      <WizardStep
        label={tx('Betroffenes Asset')}
        description={tx('Optional: Das betroffene Gerät oder Asset auswählen.')}
        enabledIf={!skipAsset}
      >
        <div className="space-y-4">
          <EntitySelectStep
            {...assets.select}
            selectedId={ticket.get('affected_asset') as string | undefined}
            onSelect={id => {
              ticket.set('affected_asset', id, assets.labelOf(id));
              setStep(4);
            }}
            emptyText={tx('Kein Asset gefunden. Suche anpassen oder Schritt überspringen.')}
            create={false}
          />
          <StepNav
            onBack={() => setStep(2)}
            nextLabel={tx('Schritt überspringen')}
            onNext={() => {
              setSkipAsset(true);
              return ticket.validate([]);
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[ticket]}
            submit={submit}
            whatHappensNext={tx('Das Ticket erscheint sofort in der Helpdesk-Übersicht und kann einem Mitarbeiter zugewiesen werden.')}
            items={[
              {
                key: 'status_info',
                label: tx('Status'),
                value: tx('Neu'),
              },
            ]}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[ticket]}
          next={[
            {
              label: tx('Weiteres Ticket anlegen'),
              onClick: () => {
                submit.reset();
                ticket.reset();
                setSkipAsset(false);
                setStep(1);
              },
            },
            {
              label: tx('Ticket zuweisen'),
              href: '#/intents/ticket-zuweisen',
            },
            {
              label: tx('Notiz hinzufügen'),
              href: '#/intents/notiz-hinzufuegen',
            },
            {
              label: tx('Zum Dashboard'),
              href: '#/',
            },
          ]}
          whatHappensNext={tx('Das Ticket ist angelegt und kann jetzt dem passenden Mitarbeiter zugewiesen werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
