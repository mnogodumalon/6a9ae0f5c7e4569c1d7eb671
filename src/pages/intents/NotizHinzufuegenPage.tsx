/**
 * Notiz hinzufügen — 3-Schritt-Wizard.
 * Steps: 1) Ticket wählen → 2) Notiz erfassen → 3) Prüfen & anlegen.
 * Reads: tickets (gefiltert: status != closed). Writes: notizen (createNotizenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { Field } from '@/components/blocks/Field';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
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
      title: fieldText(t, 'title'),
      subtitle: fieldText(t, 'reporter_name'),
      status: fieldLookup(t, 'status') ?? undefined,
    }),
  });

  const [step, setStep] = useState(1);

  const notiz = useStepForm('notizen', {
    steps: { ticket: 1, text: 2, author: 2, visible_to_reporter: 2 },
    required: { author: false },
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
        description: tx('Eine interne oder für den Melder sichtbare Notiz zu einem offenen Ticket hinzufügen.'),
        needs: [tx('Ticketnummer oder Titel'), tx('Text der Notiz')],
      }}
    >
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Nur offene Tickets werden angezeigt — bereits geschlossene sind ausgeblendet.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={notiz.get('ticket') as string}
          onSelect={id => {
            notiz.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine offenen Tickets gefunden. Alle Tickets sind bereits geschlossen.')}
          searchPlaceholder={tx('Titel oder Meldername suchen …')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Notiz')}
        description={tx('Text verfassen und festlegen, ob die Notiz für den Melder sichtbar sein soll.')}
        needs={['ticket']}
      >
        <div className="space-y-5">
          <Field form={notiz} name="text">
            <Textarea
              {...notiz.field('text')}
              rows={5}
              placeholder={tx('Notiztext …')}
            />
          </Field>

          <Field form={notiz} name="author">
            <input
              {...notiz.field('author')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={tx('Dein Name (optional)')}
            />
          </Field>

          <Field form={notiz} name="visible_to_reporter" hideLabel>
            <div className="flex items-center gap-3">
              <Switch
                id="visible_to_reporter"
                checked={(notiz.get('visible_to_reporter') as boolean) ?? false}
                onCheckedChange={val => notiz.set('visible_to_reporter', val)}
              />
              <Label htmlFor="visible_to_reporter" className="cursor-pointer select-none">
                {tx('Für den Melder sichtbar')}
              </Label>
            </div>
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
            whatHappensNext={tx('Die Notiz wird sofort am Ticket gespeichert und ist im Ticket-Detail sichtbar.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[notiz]}
          next={[
            { label: tx('Weitere Notiz hinzufügen'), onClick: () => { submit.reset(); notiz.reset(); setStep(1); } },
            { label: tx('Neues Ticket erstellen'), href: '#/intents/neues-ticket' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Das Ticket-Team sieht die Notiz im Verlauf des Tickets.')}
        />
      )}
    </IntentWizardShell>
  );
}
