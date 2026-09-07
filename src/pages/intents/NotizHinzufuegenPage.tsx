/**
 * Notiz hinzufügen — 2-Schritt-Wizard.
 * Steps: 1) Ticket wählen (nur nicht-geschlossene) → 2) Notiz verfassen → 3) Prüfen & anlegen.
 * Reads: tickets. Writes: notizen (createNotizenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
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
  const [step, setStep] = useState(1);

  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status != 'closed'",
    where: r => fieldLookup(r, 'status')?.key !== 'closed',
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
    required: { text: true },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'notiz',
      entity: 'notizen',
      form: notiz,
      primary: true,
    },
  ], { draftKey: 'notiz-hinzufuegen' });

  return (
    <IntentWizardShell
      title={tx('Notiz hinzufügen')}
      subtitle={tx('Interne oder für den Melder sichtbare Notiz an ein Ticket hängen.')}
      currentStep={step}
      onStepChange={setStep}
      forms={[notiz]}
      draftKey="notiz-hinzufuegen"
      intro={{
        description: tx('Eine Notiz an ein offenes Ticket hängen — intern oder für den Melder sichtbar.'),
        needs: [tx('Titel oder Meldername des Tickets'), tx('Notiztext')],
      }}
    >
      <WizardStep
        label={tx('Ticket')}
        description={tx('Offenes Ticket auswählen — geschlossene Tickets werden nicht angezeigt.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={notiz.get('ticket') as string | null}
          onSelect={id => {
            notiz.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          searchPlaceholder={tx('Ticket suchen …')}
          emptyText={tx('Keine offenen Tickets gefunden.')}
          avatar="none"
        />
      </WizardStep>

      <WizardStep
        label={tx('Notiz')}
        description={tx('Text und Sichtbarkeit der Notiz festlegen.')}
        needs={['ticket']}
      >
        <div className="space-y-4">
          <Bound form={notiz} name="text" rows={5} placeholder={tx('Notiztext …')} />
          <Bound form={notiz} name="author" placeholder={tx('Name des Agenten')} />
          <Bound form={notiz} name="visible_to_reporter" />
          <StepNav
            onNext={() => notiz.validate(['text', 'author'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[notiz]}
            submit={submit}
            whatHappensNext={tx('Die Notiz wird sofort am Ticket gespeichert. Wenn „Für meldende Person sichtbar" aktiviert ist, erscheint sie auf der öffentlichen Ticketseite.')}
            confirmLabel={tx('Notiz anlegen')}
            items={[
              ...(notiz.get('ticket')
                ? [{
                    key: '_ticket_label',
                    label: tx('Ticket'),
                    value: tickets.labelOf(notiz.get('ticket') as string) ?? (notiz.get('ticket') as string),
                    step: 1,
                    keys: ['ticket'],
                  }]
                : []),
            ]}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[notiz]}
          submit={submit}
          whatHappensNext={tx('Die Notiz ist am Ticket hinterlegt. Du kannst jetzt eine weitere Notiz anlegen oder ein neues Ticket eröffnen.')}
          next={[
            {
              label: tx('Neues Ticket eröffnen'),
              href: '#/intents/neues-ticket',
            },
            {
              label: tx('Ticket zuweisen'),
              href: '#/intents/ticket-zuweisen',
            },
            {
              label: tx('Zum Dashboard'),
              href: '#/',
            },
          ]}
          restartLabel={tx('Weitere Notiz')}
        />
      )}
    </IntentWizardShell>
  );
}
