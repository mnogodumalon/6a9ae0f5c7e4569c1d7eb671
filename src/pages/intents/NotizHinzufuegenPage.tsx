/**
 * Notiz hinzufügen — 3-Schritt-Wizard.
 * Steps: 1) Ticket wählen → 2) Notiz erfassen → 3) Prüfen & anlegen.
 * Reads: tickets (filter: status in [new, in_progress, waiting_for_customer]).
 * Writes: notizen (createNotizenEntry), linked to the selected ticket.
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useRecordSearch, useStepForm, useJourneySubmit, fieldLookup, fieldText } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function NotizHinzufuegenPage() {
  const [step, setStep] = useState(1);

  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status in ['new', 'in_progress', 'waiting_for_customer']",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key === 'new' || key === 'in_progress' || key === 'waiting_for_customer';
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
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'notiz',
      entity: 'notizen',
      form: notiz,
      primary: true,
      link: { ticket: 'ticket' },
    },
  ], { draftKey: 'notiz-hinzufuegen' });

  return (
    <IntentWizardShell
      title={tx('Notiz hinzufügen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[notiz]}
      draftKey="notiz-hinzufuegen"
      intro={{
        description: tx('Eine interne oder kundenseitige Notiz zu einem offenen Ticket hinzufügen.'),
        needs: [tx('Ticketnummer oder Titel'), tx('Text der Notiz')],
      }}
    >
      <WizardStep
        label={tx('Ticket')}
        description={tx('Ein offenes Ticket auswählen, zu dem die Notiz gehört.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={notiz.get('ticket') as string}
          onSelect={id => {
            notiz.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Kein Ticket mit Status „Neu", „In Bearbeitung" oder „Wartet auf Kunden" gefunden.')}
          searchPlaceholder={tx('Titel oder Name der meldenden Person')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Notiz')}
        description={tx('Text der Notiz und Sichtbarkeit festlegen.')}
      >
        <div className="space-y-4">
          <Bound form={notiz} name="text" rows={5} />
          <Bound form={notiz} name="author" />
          <Bound form={notiz} name="visible_to_reporter" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => notiz.validate(['text'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[notiz]}
            submit={submit}
            whatHappensNext={tx('Die Notiz wird sofort beim Ticket gespeichert.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[notiz]}
          submit={submit}
          restartLabel={tx('Weitere Notiz')}
          next={[
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Die Notiz ist jetzt im Ticket sichtbar. Bei Bedarf ein weiteres Ticket zuweisen.')}
        />
      )}
    </IntentWizardShell>
  );
}
