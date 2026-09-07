/**
 * Neues Ticket — 3-Schritt-Wizard.
 * Steps: 1) Meldung → Reporter-Infos + Titel + Beschreibung erfassen
 *        2) Details → Priorität, Kategorie, Fälligkeit, Eröffnungsdatum, Stunden
 *        3) Asset (optional) → betroffenes Asset per EntitySelectStep wählen
 *        4) Prüfen & anlegen
 * Reads: assets (Schritt 3). Writes: tickets (createTicket), Status preset 'new'.
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup,
 *           Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, todayIso } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

const DRAFT_KEY = 'neues-ticket';

export default function NeuesTicketPage() {
  const [step, setStep] = useState(1);

  // Assets für optionalen Schritt 3
  const assets = useRecordSearch(servicePort, 'assets', {
    searchFields: ['name', 'serial_number'],
    toItem: a => ({
      id: a.id,
      title: String(a.fields.name ?? ''),
      subtitle: a.fields.serial_number ? String(a.fields.serial_number) : undefined,
    }),
  });

  // Formular für das Ticket
  const ticket = useStepForm('tickets', {
    steps: {
      title: 1,
      reporter_name: 1,
      reporter_email: 1,
      reporter_phone: 1,
      description: 1,
      priority: 2,
      category: 2,
      due: 2,
      opened_on: 2,
      estimated_hours: 2,
      affected_asset: 3,
    },
    initial: {
      opened_on: todayIso(),
    },
    // affected_asset ist optional in diesem Flow
    required: { affected_asset: false },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'ticket',
      entity: 'tickets',
      form: ticket,
      primary: true,
      values: { status: 'new' },
    },
  ], { draftKey: DRAFT_KEY });

  const assetEnabled = true; // Schritt ist immer erreichbar, aber optional

  return (
    <IntentWizardShell
      title={tx('Neues Ticket')}
      subtitle={tx('Support-Anfrage erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[ticket]}
      draftKey={DRAFT_KEY}
      intro={{
        description: tx('Ein neues Support-Ticket mit allen Meldeinformationen anlegen.'),
        needs: [
          tx('Name und E-Mail der meldenden Person'),
          tx('Priorität und Fälligkeitsdatum'),
        ],
      }}
    >
      {/* Schritt 1: Meldung */}
      <WizardStep
        label={tx('Meldung')}
        description={tx('Titel und Kontaktdaten der meldenden Person eingeben.')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="title" />
          <Bound form={ticket} name="reporter_name" />
          <Bound form={ticket} name="reporter_email" />
          <Bound form={ticket} name="reporter_phone" />
          <Bound form={ticket} name="description" rows={4} />
          <StepNav
            hideBack
            onNext={() => ticket.validate(['title', 'reporter_name', 'reporter_email'])}
            nextStepLabel={tx('Details')}
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Details */}
      <WizardStep
        label={tx('Details')}
        description={tx('Priorität, Kategorie, Fälligkeit und Aufwand festlegen.')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="priority" />
          <Bound form={ticket} name="category" allowClear />
          <Bound form={ticket} name="due" />
          <Bound form={ticket} name="opened_on" />
          <Bound form={ticket} name="estimated_hours" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => ticket.validate(['priority', 'due', 'opened_on', 'estimated_hours'])}
            nextStepLabel={tx('Asset')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Asset (optional) */}
      <WizardStep
        label={tx('Asset')}
        description={tx('Optional: betroffenes Asset auswählen oder überspringen.')}
        enabledIf={assetEnabled}
      >
        <EntitySelectStep
          {...assets.select}
          selectedId={ticket.get('affected_asset') as string | null}
          onSelect={id => {
            ticket.set('affected_asset', id, assets.labelOf(id));
            setStep(4);
          }}
          avatar="none"
          searchPlaceholder={tx('Asset suchen …')}
          emptyText={tx('Keine Assets gefunden.')}
          create={false}
        />
        <StepNav
          onBack={() => setStep(2)}
          onNext={() => { setStep(4); }}
          nextStepLabel={tx('Prüfen')}
          nextLabel={ticket.get('affected_asset') ? undefined : tx('Überspringen')}
        />
      </WizardStep>

      {/* Schritt 4: Prüfen & Anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.result && (
          <SummaryStep
            forms={[ticket]}
            submit={submit}
            whatHappensNext={tx('Das Ticket wird mit Status „Neu" angelegt und kann sofort zugewiesen werden.')}
            confirmLabel={tx('Ticket anlegen')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[ticket]}
          submit={submit}
          restartLabel={tx('Weiteres Ticket anlegen')}
          whatHappensNext={tx('Das Ticket kann nun zugewiesen oder mit einer Notiz versehen werden.')}
          next={[
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
        />
      )}
    </IntentWizardShell>
  );
}
