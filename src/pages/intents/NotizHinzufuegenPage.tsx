/**
 * Notiz hinzufügen — 3-Schritt-Wizard.
 * Steps: 1) Ticket wählen → 2) Notiz erfassen → 3) Prüfen & anlegen.
 * Reads: tickets. Writes: notizen (createNotizenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS } from '@/types/app';
import { tx } from '@/i18n';
import { Field } from '@/components/blocks/Field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function NotizHinzufuegenPage() {
  const data = useDashboardData({ omit: ['tickets'] });
  const tickets = useRecordSearch(servicePort, 'tickets', {
    searchFields: ['title', 'reporter_name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'title') ?? t.id,
      subtitle: fieldText(t, 'reporter_name') ?? undefined,
      status: t.fields.status as { key: string; label: string } | undefined,
    }),
  });

  const [step, setStep] = useState(1);

  const notiz = useStepForm('notizen', {
    steps: { ticket: 1, text: 2, author: 2, visible_to_reporter: 2 },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'notiz',
      entity: 'notizen',
      form: notiz,
      primary: true,
      values: {
        ticket: notiz.get('ticket')
          ? `${APP_IDS.TICKETS}/${notiz.get('ticket') as string}`
          : undefined,
      },
    },
  ], { draftKey: 'notiz-hinzufuegen' });

  const restart = () => { submit.reset(); notiz.reset(); setStep(1); };

  const selectedTicketId = notiz.get('ticket') as string | undefined;
  const visibleToReporter = notiz.get('visible_to_reporter') as boolean | undefined;

  return (
    <IntentWizardShell
      title={tx('Notiz hinzufügen')}
      currentStep={step}
      onStepChange={setStep}
      loading={data.loading}
      error={data.error}
      onRetry={data.fetchAll}
      forms={[notiz]}
      draftKey="notiz-hinzufuegen"
      intro={{
        description: tx('Eine interne oder für den Melder sichtbare Notiz zu einem Ticket erfassen.'),
        needs: [tx('Ticket'), tx('Notiztext'), tx('Name der verfassenden Person')],
      }}
    >
      <WizardStep
        label={tx('Ticket')}
        description={tx('Ticket auswählen, zu dem die Notiz gehört.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={selectedTicketId}
          onSelect={id => {
            notiz.set('ticket', id, tickets.labelOf(id));
            setStep(2);
          }}
          searchPlaceholder={tx('Ticket suchen …')}
          emptyText={tx('Kein Ticket gefunden.')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Notiz')}
        description={tx('Notiztext, Verfasser/in und Sichtbarkeit eintragen.')}
      >
        {step === 2 && (
          selectedTicketId ? (
            <div className="space-y-4">
              <Field form={notiz} name="text" label={tx('Text')}>
                <Textarea {...notiz.field('text')} rows={5} placeholder={tx('Notiztext …')} />
              </Field>
              <Field form={notiz} name="author" label={tx('Verfasser/in')}>
                <Input {...notiz.field('author')} placeholder={tx('Name der bearbeitenden Person')} />
              </Field>
              <Field form={notiz} name="visible_to_reporter" hideLabel>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Checkbox
                    checked={!!visibleToReporter}
                    onCheckedChange={checked =>
                      notiz.set('visible_to_reporter', checked === true)
                    }
                    id="visible_to_reporter"
                  />
                  <span className="text-sm">{tx('Für meldende Person sichtbar')}</span>
                </label>
              </Field>
              <StepNav
                onNext={() => notiz.validate(['text', 'author'])}
                nextStepLabel={tx('Prüfen')}
              />
            </div>
          ) : (
            <StepNav onBack={() => setStep(1)} nextDisabled>
              {tx('Bitte zuerst ein Ticket auswählen.')}
            </StepNav>
          )
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[notiz]}
            submit={submit}
            whatHappensNext={tx('Die Notiz wird sofort dem gewählten Ticket zugeordnet.')}
            items={[
              {
                key: 'sichtbarkeit',
                label: tx('Sichtbarkeit'),
                value: visibleToReporter
                  ? tx('Für Reporter sichtbar')
                  : tx('Intern'),
                step: 2,
                keys: ['visible_to_reporter'],
                fieldId: 'visible_to_reporter',
              },
            ]}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[notiz]}
          next={[
            { label: tx('Weitere Notiz'), onClick: restart },
            { label: tx('Weitere Notiz zu diesem Ticket'), onClick: () => { submit.reset(); notiz.reset({ ticket: selectedTicketId ?? '' }); setStep(2); } },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Die Notiz ist im Ticket dokumentiert und kann bei Bedarf eingesehen werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
