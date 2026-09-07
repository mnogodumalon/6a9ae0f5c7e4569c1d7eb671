import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
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
    loadPublicPagesConfig(SLUG).then(c => {
      if (!c) { setUnavailable(true); setLoading(false); return; }
      setCfg(c);
      setPage(c.pages[SLUG] ?? null);
      setLoading(false);
    }).catch(err => {
      if (err instanceof PageUnavailableError) setUnavailable(true);
      setLoading(false);
    });
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  // ONE form covering all visitor-submitted fields across both steps.
  // Steps map drives "Ändern" back links in the summary.
  const f = useStepForm('tickets', {
    fields: ['reporter_name', 'reporter_email', 'reporter_phone', 'title', 'description', 'category'],
    required: { reporter_name: true, reporter_email: true, reporter_phone: false, title: true, description: false, category: false },
    steps: {
      reporter_name: 1, reporter_email: 1, reporter_phone: 1,
      title: 2, description: 2, category: 2,
    },
    autoComplete: true,
  });

  const journeySubmit = useJourneySubmit(
    // port is always non-null when submit.done can fire (cfg/page loaded);
    // port! is safe here because submit actions only execute after loading.
    port!,
    [{ key: 'ticket', entity: 'tickets', form: f, primary: true }],
    { draftKey: 'support-anfrage' },
  );

  const restart = () => {
    f.reset();
    setStep(1);
  };

  const onFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  return (
    <PublicShell
      title={tx('Support-Anfrage einreichen')}
      description={tx('Beschreibe dein Problem — das Helpdesk-Team meldet sich bei dir.')}
    >
      <div onFocus={onFirstInteraction} onPointerDown={onFirstInteraction}>
        <IntentWizardShell
          currentStep={step}
          onStepChange={setStep}
          back={false}
          forms={[f]}
          draftKey="support-anfrage"
        >
          <WizardStep
            label={tx('Kontaktdaten')}
            description={tx('Damit das Team weiß, wen es kontaktieren soll.')}
          >
            <div className="space-y-5">
              <Field form={f} name="reporter_name">
                <Input {...f.field('reporter_name')} placeholder={tx('Vor- und Nachname')} />
              </Field>
              <Field form={f} name="reporter_email">
                <Input {...f.field('reporter_email')} placeholder={tx('deine@email.de')} />
              </Field>
              <Field form={f} name="reporter_phone">
                <Input {...f.field('reporter_phone')} placeholder={tx('Optional — z. B. +49 30 123456')} />
              </Field>
              <StepNav
                onNext={() => f.validate(['reporter_name', 'reporter_email'])}
                nextStepLabel={tx('Ticket-Details')}
              />
            </div>
          </WizardStep>

          <WizardStep
            label={tx('Ticket-Details')}
            description={tx('Was ist das Problem? Je mehr Details, desto schneller können wir helfen.')}
          >
            <div className="space-y-5">
              <Field form={f} name="title" label={tx('Titel')}>
                <Input {...f.field('title')} placeholder={tx('Kurze Beschreibung des Problems')} />
              </Field>
              <Field form={f} name="description" label={tx('Beschreibung')}>
                <Textarea {...f.field('description')} placeholder={tx('Was ist passiert? Wann tritt das Problem auf? Welche Fehlermeldung erscheint?')} rows={5} />
              </Field>
              <Field form={f} name="category" label={tx('Kategorie')}>
                <ChoiceGroup {...f.choice('category')} />
              </Field>
              <StepNav
                onNext={() => f.validate(['title'])}
                nextStepLabel={tx('Prüfen & Absenden')}
              />
            </div>
          </WizardStep>

          <WizardStep label={tx('Prüfen & Absenden')}>
            {!journeySubmit.done && (
              <SummaryStep
                forms={[f]}
                submit={journeySubmit}
                whatHappensNext={tx('Das Helpdesk-Team nimmt deine Anfrage auf und meldet sich per E-Mail.')}
                confirmLabel={tx('Anfrage absenden')}
              />
            )}
          </WizardStep>

          {journeySubmit.result && (
            <SuccessStep
              result={journeySubmit.result}
              forms={[f]}
              next={[{ label: tx('Neue Anfrage stellen'), onClick: restart }]}
              whatHappensNext={tx('Du erhältst eine Rückmeldung an die angegebene E-Mail-Adresse.')}
            />
          )}
        </IntentWizardShell>
      </div>
    </PublicShell>
  );
}
