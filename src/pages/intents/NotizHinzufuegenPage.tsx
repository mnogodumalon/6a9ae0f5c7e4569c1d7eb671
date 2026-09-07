/**
 * Notiz hinzufügen — 2-Schritt-Wizard.
 * Steps: 1) Ticket wählen (nur Status new/in_progress/waiting_for_customer) →
 *        2) Notiz verfassen (text, author, visible_to_reporter) → Prüfen & anlegen.
 * Reads: tickets. Writes: notizen (createNotizenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldLookup,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function NotizHinzufuegenPage() {
  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status != 'closed'",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key === 'new' || key === 'in_progress' || key === 'waiting_for_customer';
    },
    searchFields: ['title', 'reporter_name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title') ?? tx('Ohne Titel'),
      subtitle: fieldText(t, 'reporter_name') ?? undefined,
      status: fieldLookup(t, 'status') ?? undefined,
    }),
  });

  const [step, setStep] = useState(1);

  const notiz = useStepForm('notizen', {
    steps: { ticket: 1, text: 2, author: 2, visible_to_reporter: 2 },
    fields: ['ticket', 'text', 'author', 'visible_to_reporter'],
    required: { text: true },
  });

  const submit = useJourneySubmit(
    servicePort,
    [{ key: 'notiz', entity: 'notizen', form: notiz, primary: true }],
    { draftKey: 'notiz-hinzufuegen' },
  );

  return (
    <IntentWizardShell
      title={tx('Notiz hinzufügen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[notiz]}
      draftKey="notiz-hinzufuegen"
      intro={{
        description: tx('Interne oder für den Melder sichtbare Notiz zu einem offenen Ticket erfassen.'),
        needs: [tx('Betroffenes Ticket'), tx('Notiztext')],
      }}
    >
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Wähle das Ticket, zu dem die Notiz gehört.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={notiz.get('ticket') as string}
          onSelect={id => {
            notiz.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen Tickets gefunden. Nur Tickets mit Status „Neu", „In Bearbeitung" oder „Wartet auf Kunde" sind wählbar.')}
          searchPlaceholder={tx('Ticket suchen …')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Notiz verfassen')}
        description={tx('Inhalt der Notiz eingeben und Sichtbarkeit festlegen.')}
        needs={['ticket']}
      >
        <div className="space-y-4">
          <Bound form={notiz} name="text" rows={5} />
          <Bound form={notiz} name="author" />
          <Field form={notiz} name="visible_to_reporter">
            <ChoiceGroup
              {...notiz.choice('visible_to_reporter')}
              options={[
                { key: 'true', label: tx('Für Melder sichtbar') },
                { key: 'false', label: tx('Nur intern') },
              ]}
            />
          </Field>
          <StepNav
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
            whatHappensNext={tx('Die Notiz wird sofort am Ticket gespeichert und ist für das Team sichtbar.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[notiz]}
          next={[
            { label: tx('Weitere Notiz'), onClick: () => { submit.reset(); notiz.reset(); setStep(1); } },
            { label: tx('Ticket zuweisen'), href: '#/intents/ticket-zuweisen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Die Notiz ist jetzt am Ticket gespeichert.')}
        />
      )}
    </IntentWizardShell>
  );
}
