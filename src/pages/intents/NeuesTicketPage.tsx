/**
 * Neues Ticket — 3-Schritt-Wizard.
 * Steps: 1) Meldende Person → 2) Ticket-Details → 3) Betroffenes Asset (optional).
 * Reads: assets. Writes: tickets (createTickets).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup,
 *           Field, DatePicker, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/DatePicker';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { Field } from '@/components/blocks/Field';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function NeuesTicketPage() {
  const [step, setStep] = useState(1);

  // Asset-Suche für Schritt 3 — Hook vor allen Early-Returns
  const assets = useRecordSearch(servicePort, 'assets', {
    searchFields: ['name', 'serial_number'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'name') ?? a.id,
      subtitle: fieldText(a, 'serial_number') ?? undefined,
    }),
  });

  // Ein Formular für alle Ticket-Felder, verteilt auf die drei Schritte
  const f = useStepForm('tickets', {
    steps: {
      reporter_name: 1,
      reporter_email: 1,
      reporter_phone: 1,
      title: 2,
      description: 2,
      priority: 2,
      category: 2,
      due: 2,
      opened_on: 2,
      affected_asset: 3,
    },
    required: {
      reporter_phone: false,
      description: false,
      category: false,
      affected_asset: false,
    },
  });

  // Plan: ein Ticket-Record mit Preset für status und estimated_hours
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'ticket',
      entity: 'tickets',
      form: f,
      primary: true,
      values: {
        status: 'new',
        estimated_hours: 0,
      },
    },
  ], { draftKey: 'neues-ticket' });

  return (
    <IntentWizardShell
      title={tx('Neues Ticket')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="neues-ticket"
      intro={{
        description: tx('Ein neues Support-Ticket in drei Schritten erfassen.'),
        needs: [tx('Name und E-Mail der meldenden Person'), tx('Titel und Priorität des Problems')],
      }}
    >
      {/* Schritt 1: Meldende Person */}
      <WizardStep
        label={tx('Meldende Person')}
        description={tx('Kontaktdaten der Person eingeben, die das Problem meldet.')}
      >
        <div className="space-y-4">
          <Field form={f} name="reporter_name">
            <Input {...f.field('reporter_name')} placeholder={tx('Vor- und Nachname')} />
          </Field>
          <Field form={f} name="reporter_email">
            <Input {...f.field('reporter_email')} type="email" placeholder={tx('email@beispiel.de')} />
          </Field>
          <Field form={f} name="reporter_phone">
            <Input {...f.field('reporter_phone')} type="tel" placeholder={tx('+49 …')} />
          </Field>
          <StepNav
            onNext={() => f.validate(['reporter_name', 'reporter_email'])}
            nextStepLabel={tx('Ticket-Details')}
            hideBack
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Ticket-Details */}
      <WizardStep
        label={tx('Ticket-Details')}
        description={tx('Titel, Priorität, Kategorie und Fälligkeitsdatum des Tickets festlegen.')}
      >
        <div className="space-y-4">
          <Field form={f} name="title">
            <Input {...f.field('title')} placeholder={tx('Kurze Beschreibung des Problems')} />
          </Field>
          <Field form={f} name="description">
            <Textarea {...f.field('description')} rows={3} placeholder={tx('Detaillierte Fehlerbeschreibung …')} />
          </Field>
          <Field form={f} name="priority">
            <ChoiceGroup {...f.choice('priority')} />
          </Field>
          <Field form={f} name="category">
            <ChoiceGroup {...f.choice('category')} allowClear />
          </Field>
          <Field form={f} name="due">
            <DatePicker {...f.date('due')} />
          </Field>
          <Field form={f} name="opened_on">
            <DatePicker {...f.date('opened_on')} />
          </Field>
          <StepNav
            onNext={() => f.validate(['title', 'priority', 'due', 'opened_on'])}
            nextStepLabel={tx('Betroffenes Asset')}
            onBack={() => setStep(1)}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Betroffenes Asset (optional) */}
      <WizardStep
        label={tx('Betroffenes Asset')}
        description={tx('Dieser Schritt ist optional — du kannst das Ticket auch ohne Asset anlegen.')}
        enabledIf={true}
      >
        <div className="space-y-4">
          <Field form={f} name="affected_asset" hint={tx('Optional — nur auswählen wenn bekannt.')}>
            <EntitySelectStep
              {...assets.select}
              {...f.records('affected_asset', assets.labelOf)}
              searchPlaceholder={tx('Asset suchen …')}
              emptyText={tx('Kein Asset gefunden. Das Ticket kann auch ohne Asset angelegt werden.')}
            />
          </Field>
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => f.validate([])}
            nextStepLabel={tx('Prüfen & Anlegen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Zusammenfassung */}
      <WizardStep label={tx('Prüfen & Anlegen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Das Ticket erscheint sofort in der Helpdesk-Übersicht und kann zugewiesen werden.')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          next={[
            {
              label: tx('Weiteres Ticket erfassen'),
              onClick: () => { submit.reset(); f.reset(); setStep(1); },
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
          whatHappensNext={tx('Das Ticket kann nun einem Mitarbeitenden zugewiesen werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
