/**
 * Neues Ticket — 3-Schritt-Wizard.
 * Steps: 1) Meldung (Titel, Beschreibung, Kontaktdaten) → 2) Klassifizierung (Priorität, Kategorie, Asset, Datum, Stunden) → 3) Zusammenfassung & Anlegen.
 * Reads: assets. Writes: tickets (create).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, Bound, Field, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function NeuesTicketPage() {
  const [step, setStep] = useState(1);

  const assets = useRecordSearch(servicePort, 'assets', {
    searchFields: ['name', 'serial_number'],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'name'),
      subtitle: fieldText(a, 'serial_number'),
    }),
  });

  const f = useStepForm('tickets', {
    steps: {
      title: 1,
      description: 1,
      reporter_name: 1,
      reporter_email: 1,
      reporter_phone: 1,
      priority: 2,
      category: 2,
      affected_asset: 2,
      opened_on: 2,
      due: 2,
      estimated_hours: 2,
    },
    initial: {
      opened_on: todayIso(),
    },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'ticket',
      entity: 'tickets',
      form: f,
      primary: true,
      values: { status: 'new' },
    },
  ], { draftKey: 'neues-ticket' });

  return (
    <IntentWizardShell
      title={tx('Neues Ticket')}
      subtitle={tx('Support-Anfrage erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="neues-ticket"
      intro={{
        description: tx('Einen neuen Support-Ticket in drei Schritten anlegen.'),
        needs: [tx('Name und Kontakt der meldenden Person'), tx('Priorität und Kategorie')],
      }}
    >
      {/* Schritt 1: Meldung */}
      <WizardStep
        label={tx('Meldung')}
        description={tx('Titel, Beschreibung und Kontaktdaten der meldenden Person eingeben.')}
      >
        <div className="space-y-4">
          <Bound form={f} name="title" />
          <Bound form={f} name="description" rows={4} />
          <Bound form={f} name="reporter_name" />
          <Bound form={f} name="reporter_email" />
          <Bound form={f} name="reporter_phone" />
          <StepNav
            hideBack
            onNext={() => f.validate(['title', 'reporter_name', 'reporter_email'])}
            nextStepLabel={tx('Klassifizierung')}
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Klassifizierung */}
      <WizardStep
        label={tx('Klassifizierung')}
        description={tx('Priorität, Kategorie, betroffenes Asset und Fristen festlegen.')}
      >
        <div className="space-y-4">
          <Bound form={f} name="priority" />
          <Bound form={f} name="category" allowClear />

          {/* Asset-Auswahl als EntitySelectStep */}
          {(f.get('affected_asset') as string | null | undefined) ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">{tx('Betroffenes Asset')}</p>
              <div className="flex items-center gap-2 rounded-lg border bg-secondary/50 px-3 py-2">
                <span className="flex-1 text-sm">
                  {assets.labelOf(f.get('affected_asset') as string) ?? tx('Asset ausgewählt')}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => { f.set('affected_asset', null as unknown as string, undefined); }}
                >
                  {tx('Ändern')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium">{tx('Betroffenes Asset')}</p>
              <p className="text-xs text-muted-foreground mb-2">{tx('Optional — das betroffene Gerät oder System auswählen.')}</p>
              <EntitySelectStep
                {...assets.select}
                selectedId={null}
                onSelect={id => {
                  f.set('affected_asset', id, assets.labelOf(id));
                }}
                avatar="none"
                searchPlaceholder={tx('Asset suchen …')}
                emptyText={tx('Keine Assets gefunden.')}
              />
            </div>
          )}

          <Bound form={f} name="opened_on" />
          <Bound form={f} name="due" />
          <Bound form={f} name="estimated_hours" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['priority', 'opened_on', 'due', 'estimated_hours'])}
            nextStepLabel={tx('Zusammenfassung')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Zusammenfassung */}
      <WizardStep label={tx('Zusammenfassung')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Das Ticket wird mit dem Status „Neu" angelegt und erscheint sofort in der Ticket-Übersicht.')}
            confirmLabel={tx('Ticket anlegen')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            submit={submit}
            restartLabel={tx('Weiteres Ticket erfassen')}
            whatHappensNext={tx('Das Ticket kann nun einem Mitarbeitenden zugewiesen oder mit Notizen ergänzt werden.')}
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
      </WizardStep>
    </IntentWizardShell>
  );
}
