/**
 * Neues Ticket — 3-Schritt-Wizard.
 * Steps: 1) Meldung → Melderdaten + Ticketbeschreibung erfassen →
 *         2) Klassifizierung → Priorität, Kategorie, Fälligkeitsdatum, Stunden →
 *         3) Asset (optional) → betroffenes Asset wählen (überspringbar).
 * Reads: assets. Writes: tickets (create).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, Bound, StepNav,
 *            SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, todayIso } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { useClock } from '@/lib/polish';

export default function NeuesTicketPage() {
  const clock = useClock();
  const [step, setStep] = useState(1);

  const assets = useRecordSearch(servicePort, 'assets', {
    searchFields: ['name', 'serial_number'],
    toItem: a => ({
      id: a.id,
      title: String(a.fields.name ?? ''),
      subtitle: String(a.fields.serial_number ?? ''),
    }),
  });

  // Step 1 + 2 fields live in ONE form on the tickets entity (single create plan step).
  const ticket = useStepForm('tickets', {
    steps: {
      reporter_name: 1,
      reporter_email: 1,
      reporter_phone: 1,
      title: 1,
      description: 1,
      priority: 2,
      category: 2,
      due: 2,
      opened_on: 2,
      estimated_hours: 2,
      // status is not bound (hidden preset via values in the plan)
      // affected_asset bound on step 3 but optional — handled separately
    },
    initial: {
      opened_on: format(clock, 'yyyy-MM-dd'),
      status: 'new',
    },
    required: {
      // Step 3 asset field is not in this form — no required override needed here.
      // status is preset, not asked — hide from required validation
    },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'ticket',
      entity: 'tickets',
      form: ticket,
      primary: true,
      values: (_ctx) => {
        // Merge in the asset if picked, and enforce status = 'new'
        const assetId = assetPickedId;
        const extra: Record<string, unknown> = { status: 'new' };
        if (assetId) extra.affected_asset = assetId;
        return extra;
      },
    },
  ], { draftKey: 'neues-ticket' });

  // Separate lightweight state for the optional asset pick (not a form field —
  // the field is an applookup not bound to ticket form, handled via plan values).
  const [assetPickedId, setAssetPickedId] = useState<string | null>(null);
  const [assetPickedLabel, setAssetPickedLabel] = useState<string | undefined>(undefined);

  return (
    <IntentWizardShell
      title={tx('Neues Ticket')}
      currentStep={step}
      onStepChange={setStep}
      forms={[ticket]}
      draftKey="neues-ticket"
      intro={{
        description: tx('Störung oder Anfrage als Ticket erfassen — in drei Schritten.'),
        needs: [tx('Name und E-Mail der meldenden Person'), tx('Kurze Fehlerbeschreibung')],
      }}
    >
      {/* ── Step 1: Meldung ─────────────────────────────────────────────── */}
      <WizardStep
        label={tx('Meldung')}
        description={tx('Angaben zur meldenden Person und Beschreibung des Problems erfassen.')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="reporter_name" />
          <Bound form={ticket} name="reporter_email" />
          <Bound form={ticket} name="reporter_phone" />
          <Bound form={ticket} name="title" />
          <Bound form={ticket} name="description" rows={4} />
          <StepNav
            hideBack
            onNext={() =>
              ticket.validate(['reporter_name', 'reporter_email', 'title'])
            }
            nextStepLabel={tx('Klassifizierung')}
          />
        </div>
      </WizardStep>

      {/* ── Step 2: Klassifizierung ──────────────────────────────────────── */}
      <WizardStep
        label={tx('Klassifizierung')}
        description={tx('Priorität und Kategorie festlegen, Fälligkeit und Aufwand eintragen.')}
      >
        <div className="space-y-4">
          <Bound form={ticket} name="priority" />
          <Bound form={ticket} name="category" allowClear />
          <Bound form={ticket} name="due" />
          <Bound form={ticket} name="opened_on" />
          <Bound form={ticket} name="estimated_hours" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() =>
              ticket.validate(['priority', 'due', 'opened_on', 'estimated_hours'])
            }
            nextStepLabel={tx('Asset (optional)')}
          />
        </div>
      </WizardStep>

      {/* ── Step 3: Asset (optional) ─────────────────────────────────────── */}
      <WizardStep
        label={tx('Asset (optional)')}
        description={tx('Falls ein bestimmtes Gerät betroffen ist, hier auswählen — sonst überspringen.')}
      >
        <EntitySelectStep
          {...assets.select}
          selectedId={assetPickedId}
          onSelect={id => {
            setAssetPickedId(id);
            setAssetPickedLabel(assets.labelOf(id));
            setStep(4);
          }}
          avatar="none"
          searchPlaceholder={tx('Asset suchen…')}
          emptyText={tx('Kein passendes Asset gefunden.')}
        />
        <StepNav
          onBack={() => setStep(2)}
          nextLabel={tx('Überspringen')}
          onNext={() => { setAssetPickedId(null); setAssetPickedLabel(undefined); }}
        />
      </WizardStep>

      {/* ── Step 4: Prüfen ───────────────────────────────────────────────── */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[ticket]}
            submit={submit}
            items={
              assetPickedLabel
                ? [{ key: 'affected_asset', label: tx('Betroffenes Asset'), value: assetPickedLabel }]
                : []
            }
            whatHappensNext={tx('Das Ticket wird sofort angelegt und kann anschließend einem Mitarbeitenden zugewiesen werden.')}
          />
        )}
      </WizardStep>

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[ticket]}
          submit={submit}
          next={[
            { label: tx('Ticket zuweisen'), href: '#/intents/ticket-zuweisen' },
            { label: tx('Notiz hinzufügen'), href: '#/intents/notiz-hinzufuegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Das Ticket ist jetzt offen. Weise es einem Mitarbeitenden zu oder füge eine interne Notiz hinzu.')}
        />
      )}
    </IntentWizardShell>
  );
}
