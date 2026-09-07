/**
 * Notiz hinzufügen — 2-Schritt-Wizard.
 * Steps: 1) Ticket wählen → 2) Notiz erfassen → 3) Prüfen & anlegen.
 * Reads: tickets (gefiltert: nicht abgeschlossen/gelöst). Writes: notizen (createNotizenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, Field, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function NotizHinzufuegenPage() {
  const [step, setStep] = useState(1);

  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status not in ['closed', 'resolved']",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key !== 'closed' && key !== 'resolved';
    },
    searchFields: ['title', 'reporter_name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title'),
      subtitle: fieldText(t, 'reporter_name'),
      status: fieldLookup(t, 'status') ?? undefined,
    }),
  });

  const notiz = useStepForm('notizen', {
    steps: { ticket: 1, text: 2, author: 2, visible_to_reporter: 2 },
    required: { text: true, author: true },
    initial: { visible_to_reporter: false },
  });

  const submit = useJourneySubmit(servicePort, [
    { key: 'notiz', entity: 'notizen', form: notiz, primary: true },
  ], { draftKey: 'notiz-hinzufuegen' });

  return (
    <IntentWizardShell
      title={tx('Notiz hinzufügen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[notiz]}
      draftKey="notiz-hinzufuegen"
      intro={{
        description: tx('Eine interne oder für die meldende Person sichtbare Notiz zu einem Ticket erfassen.'),
        needs: [tx('Ticket-Titel oder Name der meldenden Person'), tx('Notiztext')],
      }}
    >
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Offenes oder laufendes Ticket auswählen, zu dem die Notiz gehört.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={notiz.get('ticket') as string | undefined}
          onSelect={id => {
            notiz.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          searchPlaceholder={tx('Titel oder meldende Person suchen …')}
          emptyText={tx('Keine offenen Tickets gefunden.')}
          avatar="none"
        />
      </WizardStep>

      <WizardStep
        label={tx('Notiz')}
        description={tx('Notiztext, Verfasser/in und Sichtbarkeit festlegen.')}
      >
        {notiz.get('ticket') ? (
          <div className="space-y-5">
            <Bound form={notiz} name="text" rows={5} placeholder={tx('Notiztext …')} />
            <Bound form={notiz} name="author" placeholder={tx('Dein Name')} />
            <Bound form={notiz} name="visible_to_reporter" />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => notiz.validate(['text', 'author'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            <span className="text-sm text-muted-foreground">
              {tx('Bitte zuerst ein Ticket in Schritt 1 wählen.')}
            </span>
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.result && (
          <SummaryStep
            forms={[notiz]}
            submit={submit}
            whatHappensNext={tx('Die Notiz wird dem Ticket zugeordnet und ist sofort sichtbar.')}
            confirmLabel={tx('Notiz anlegen')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[notiz]}
            submit={submit}
            restartLabel={tx('Weitere Notiz hinzufügen')}
            next={[
              { label: tx('Ticket zuweisen'), href: '#/intents/ticket-zuweisen' },
              { label: tx('Neues Ticket erstellen'), href: '#/intents/neues-ticket' },
              { label: tx('Zum Dashboard'), href: '#/' },
            ]}
            whatHappensNext={tx('Die Notiz erscheint in der Ticket-Detailansicht.')}
          />
        )}
      </WizardStep>
    </IntentWizardShell>
  );
}
