import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import { useStepForm, useJourneySubmit } from '@/lib/journey';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { tx } from '@/i18n';

const SLUG = 'support-anfrage';

export default function SupportAnfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const f = useStepForm('tickets', {
    fields: ['title', 'description', 'category', 'reporter_name', 'reporter_email', 'reporter_phone'],
    required: {
      title: true,
      description: false,
      category: false,
      reporter_name: true,
      reporter_email: true,
      reporter_phone: false,
    },
    steps: {
      title: 1,
      description: 1,
      category: 2,
      reporter_name: 3,
      reporter_email: 3,
      reporter_phone: 3,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port!,
    [{ key: 'ticket', entity: 'tickets', form: f, primary: true }],
    { draftKey: 'support-anfrage' },
  );

  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  const restart = () => {
    f.reset();
    setStep(1);
  };

  if (loading || unavailable || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={unavailable || (!loading && (!cfg || !page))} />;
  }

  return (
    <PublicShell
      title={tx('Support-Anfrage einreichen')}
      description={tx('Beschreibe dein Problem — das Helpdesk-Team meldet sich so schnell wie möglich.')}
    >
      <IntentWizardShell
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey="support-anfrage"
      >
        <WizardStep
          label={tx('Problem')}
          heading={tx('Was ist passiert?')}
          description={tx('Beschreibe das Problem möglichst konkret.')}
        >
          <div className="space-y-5" onFocus={handleFirstInteraction}>
            <Field form={f} name="title">
              <Input {...f.field('title')} placeholder={tx('z. B. Drucker reagiert nicht')} />
            </Field>
            <Field form={f} name="description">
              <Textarea {...f.field('description')} rows={4} placeholder={tx('Was hast du versucht? Seit wann besteht das Problem?')} />
            </Field>
          </div>
          <StepNav
            onNext={() => f.validate(['title'])}
            nextStepLabel={tx('Kategorie')}
          />
        </WizardStep>

        <WizardStep
          label={tx('Kategorie')}
          heading={tx('Um was für ein Problem handelt es sich?')}
          description={tx('Wähle die passende Kategorie aus.')}
        >
          <Field form={f} name="category">
            <ChoiceGroup {...f.choice('category')} />
          </Field>
          <StepNav
            onNext={() => f.validate(['category'])}
            nextStepLabel={tx('Kontakt')}
          />
        </WizardStep>

        <WizardStep
          label={tx('Kontakt')}
          heading={tx('Wie können wir dich erreichen?')}
          description={tx('Das Helpdesk-Team kontaktiert dich über die angegebene E-Mail-Adresse.')}
        >
          <div className="space-y-5">
            <Field form={f} name="reporter_name">
              <Input {...f.field('reporter_name')} />
            </Field>
            <Field form={f} name="reporter_email">
              <Input {...f.field('reporter_email')} />
            </Field>
            <Field form={f} name="reporter_phone">
              <Input {...f.field('reporter_phone')} />
            </Field>
          </div>
          <StepNav
            onNext={() => f.validate(['reporter_name', 'reporter_email'])}
            nextStepLabel={tx('Prüfen')}
          />
        </WizardStep>

        <WizardStep label={tx('Prüfen')}>
          {!submit.done && (
            <SummaryStep
              forms={[f]}
              submit={submit}
              whatHappensNext={tx('Das Helpdesk-Team nimmt dein Ticket an und meldet sich per E-Mail bei dir.')}
            />
          )}
        </WizardStep>

        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            next={[{ label: tx('Weitere Anfrage einreichen'), onClick: restart }]}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
