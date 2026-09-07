/**
 * Notiz hinzufügen — 2-Schritt-Wizard.
 * Steps: 1) Ticket wählen (nur offene: new, in_progress, waiting_for_customer) → 2) Notiz verfassen.
 * Reads: tickets. Writes: notizen (createNotizenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { Bound } from '@/components/blocks/Bound';

export default function NotizHinzufuegenPage() {
  const [step, setStep] = useState(1);

  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status == 'new' or r.v_status == 'in_progress' or r.v_status == 'waiting_for_customer'",
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

  const notizForm = useStepForm('notizen', {
    steps: { text: 2, author: 2, visible_to_reporter: 2 },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'notiz',
      entity: 'notizen',
      form: notizForm,
      primary: true,
      values: { ticket: notizForm.get('_ticketId') as string },
    },
  ], { draftKey: 'notiz-hinzufuegen' });

  const selectedTicketId = notizForm.get('_ticketId') as string | undefined;
  const selectedTicketTitle = notizForm.get('_ticketTitle') as string | undefined;

  return (
    <IntentWizardShell
      title={tx('Notiz hinzufügen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[notizForm]}
      draftKey="notiz-hinzufuegen"
      intro={{
        description: tx('Eine interne Notiz zu einem offenen Ticket erfassen.'),
        needs: [tx('Offenes Ticket'), tx('Notiztext')],
      }}
    >
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Nur offene Tickets werden angezeigt.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={selectedTicketId}
          onSelect={id => {
            notizForm.set('_ticketId', id, tickets.labelOf(id));
            notizForm.set('_ticketTitle', tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen Tickets gefunden. Alle Tickets sind bereits abgeschlossen.')}
          searchPlaceholder={tx('Ticket suchen …')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Notiz verfassen')}
        description={tx('Text eingeben und Sichtbarkeit festlegen.')}
        needs={['_ticketId']}
      >
        <div className="space-y-4">
          <Bound form={notizForm} name="text" rows={5} />
          <Bound form={notizForm} name="author" />
          <Bound form={notizForm} name="visible_to_reporter" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => notizForm.validate(['text'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[notizForm]}
            submit={submit}
            items={[
              {
                key: '_ticketTitle',
                label: tx('Ticket'),
                value: selectedTicketTitle ?? '—',
                step: 1,
                keys: ['_ticketId', '_ticketTitle'],
                fieldId: '_ticketTitle',
              },
            ]}
            whatHappensNext={tx('Die Notiz wird sofort im Ticket gespeichert und ist für das Support-Team sichtbar.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[notizForm]}
          next={[
            {
              label: tx('Weitere Notiz hinzufügen'),
              href: '#/intents/notiz-hinzufuegen',
            },
            {
              label: tx('Ticket zuweisen'),
              href: '#/intents/ticket-zuweisen',
            },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Das Support-Team kann die Notiz im Ticket einsehen und darauf reagieren.')}
        />
      )}
    </IntentWizardShell>
  );
}
