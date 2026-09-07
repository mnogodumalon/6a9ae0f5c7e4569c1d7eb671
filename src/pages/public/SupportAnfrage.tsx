import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { useStepForm } from '@/lib/journey/useStepForm';
import { useJourneySubmit } from '@/lib/journey/useJourneySubmit';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const SLUG = 'support-anfrage';

// Inner component — only mounted after cfg+page are loaded so all hooks run unconditionally.
function SupportAnfrageForm({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [step, setStep] = useState(1);

  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  const f = useStepForm('tickets', {
    fields: ['reporter_name', 'reporter_email', 'reporter_phone', 'title', 'description', 'category'],
    required: { reporter_name: true, reporter_email: true, title: true },
    steps: {
      reporter_name: 1,
      reporter_email: 1,
      reporter_phone: 1,
      title: 2,
      description: 2,
      category: 2,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port,
    [{ key: 'ticket', entity: 'tickets', form: f, primary: true }],
    { draftKey: 'support-anfrage' },
  );

  const ep = page.endpoints?.find(e => e.op === 'create');
  const appId = ep?.app_id ?? '';

  function handleFirstInteraction() {
    if (appId) prepareChallenge(cfg, page, 'POST', `/apps/${appId}/records`);
  }

  return (
    <PublicShell
      title={tx('Support-Anfrage einreichen')}
      description={tx('Beschreibe dein technisches Problem — das Helpdesk-Team meldet sich so schnell wie möglich.')}
    >
      <IntentWizardShell
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey="support-anfrage"
        surface="plain"
      >
        <WizardStep
          label={tx('Kontaktdaten')}
          description={tx('Damit wir dich für Rückfragen erreichen können.')}
        >
          <div className="space-y-4" onFocus={handleFirstInteraction}>
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
            nextStepLabel={tx('Anfrage')}
          />
        </WizardStep>

        <WizardStep
          label={tx('Anfrage beschreiben')}
          description={tx('Schildere das Problem so genau wie möglich.')}
        >
          <div className="space-y-4">
            <Field form={f} name="title">
              <Input {...f.field('title')} />
            </Field>
            <Field form={f} name="description">
              <Textarea {...f.field('description')} rows={4} />
            </Field>
            <Field form={f} name="category">
              <ChoiceGroup {...f.choice('category')} />
            </Field>
          </div>
          <StepNav
            onNext={() => f.validate(['title'])}
            nextStepLabel={tx('Prüfen')}
          />
        </WizardStep>

        <WizardStep label={tx('Absenden')}>
          {!submit.result && (
            <SummaryStep
              forms={[f]}
              submit={submit}
              whatHappensNext={tx('Das Helpdesk-Team nimmt deine Anfrage an und meldet sich per E-Mail.')}
              confirmLabel={tx('Anfrage absenden')}
            />
          )}
        </WizardStep>

        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            submit={submit}
            restartLabel={tx('Neue Anfrage')}
            whatHappensNext={tx('Das Helpdesk-Team meldet sich so schnell wie möglich per E-Mail bei dir.')}
            referencePrefix="T"
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}

export default function SupportAnfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
      if (!c?.pages[SLUG]) setUnavailable(true);
    }).catch(err => {
      if (err instanceof PageUnavailableError) setUnavailable(true);
      setLoading(false);
    });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={unavailable && !loading} />;
  }

  return <SupportAnfrageForm cfg={cfg} page={page} />;
}
