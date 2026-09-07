/**
 * Notiz hinzufügen — 3-Schritt-Wizard.
 * Steps: 1) Ticket wählen (nur nicht-geschlossene) → 2) Notiz verfassen → 3) Prüfen & anlegen.
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
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function NotizHinzufuegenPage() {
  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status != 'closed'",
    where: r => fieldLookup(r, 'status')?.key !== 'closed',
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
    required: { text: true },
  });

  const selectedTicketId = notiz.get('ticket') as string | undefined;
  const selectedTicketTitle = selectedTicketId ? tickets.labelOf(selectedTicketId) : undefined;
  const ticketRecord = selectedTicketId ? tickets.recordOf(selectedTicketId) : undefined;

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'notiz',
      entity: 'notizen',
      form: notiz,
      primary: true,
      values: selectedTicketId ? { ticket: selectedTicketId } : {},
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
        description: tx('Eine interne oder für die meldende Person sichtbare Notiz zu einem Ticket erfassen.'),
        needs: [tx('Ticket auswählen'), tx('Notiztext')],
      }}
    >
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Nur offene Tickets können kommentiert werden.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={notiz.get('ticket') as string | undefined}
          onSelect={id => {
            notiz.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Alle Tickets sind bereits geschlossen.')}
          searchPlaceholder={tx('Ticket oder Melder suchen …')}
          create={false}
        />
      </WizardStep>

      <WizardStep
        label={tx('Notiz verfassen')}
        description={tx('Text eingeben und Sichtbarkeit festlegen.')}
        needs={['ticket']}
      >
        <div className="space-y-4">
          {ticketRecord && (
            <div className="rounded-lg bg-secondary px-4 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {selectedTicketTitle ?? fieldText(ticketRecord, 'title') ?? tx('Ticket')}
              </span>
              {fieldText(ticketRecord, 'reporter_name') && (
                <span> · {fieldText(ticketRecord, 'reporter_name')}</span>
              )}
            </div>
          )}
          <Bound form={notiz} name="text" rows={5} />
          <Bound form={notiz} name="author" />
          <Bound form={notiz} name="visible_to_reporter" />
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
            whatHappensNext={tx('Die Notiz wird sofort im Ticket gespeichert und — falls markiert — für die meldende Person sichtbar.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[notiz]}
          next={[
            { label: tx('Weitere Notiz hinzufügen'), onClick: () => { submit.reset(); notiz.reset(); setStep(1); } },
            { label: tx('Ticket zuweisen'), href: '#/intents/ticket-zuweisen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Alle Notizen zu diesem Ticket sind im Ticket-Detail einsehbar.')}
        />
      )}
    </IntentWizardShell>
  );
}
