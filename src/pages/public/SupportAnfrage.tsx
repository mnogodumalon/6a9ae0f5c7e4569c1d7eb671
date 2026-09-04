/**
 * SupportAnfrage — öffentliches Formular für Mitarbeitende ohne Helpdesk-Zugang.
 * Schritt 1: Angaben zur meldenden Person (reporter_name, reporter_email, reporter_phone)
 * Schritt 2: Details zur Anfrage (title, description)
 * Schritt 3: Zusammenfassung + Absenden
 *
 * Spiegelt den internen Flow "Neues Ticket öffnen".
 * Preset serverseitig: status='new', priority='medium', opened_on=heute
 */
import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { useStepForm } from '@/lib/journey/useStepForm';
import { useJourneySubmit } from '@/lib/journey/useJourneySubmit';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
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

  const anfrage = useStepForm('tickets', {
    fields: ['reporter_name', 'reporter_email', 'reporter_phone', 'title', 'description'],
    required: { reporter_name: true, reporter_email: true, reporter_phone: false, title: true, description: false },
    steps: { reporter_name: 1, reporter_email: 1, reporter_phone: 1, title: 2, description: 2 },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    [{ key: 'ticket', entity: 'tickets', form: anfrage, primary: true }],
    { draftKey: SLUG },
  );

  const restart = () => {
    anfrage.reset?.();
    setStep(1);
  };

  // Rules of Hooks: ALL hooks before early returns
  if (loading || unavailable || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={unavailable || (!loading && (!cfg || !page))} />;
  }

  const handleFirstInteraction = () => {
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  return (
    <PublicShell
      title={tx('Support-Anfrage einreichen')}
      description={tx('Beschreibe dein Anliegen — das Helpdesk-Team meldet sich so schnell wie möglich.')}
    >
      <IntentWizardShell
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[anfrage]}
        draftKey={SLUG}
      >
        <WizardStep
          label={tx('Deine Angaben')}
          description={tx('Damit das Team Rückfragen an dich richten kann.')}
        >
          <div className="space-y-5" onFocus={handleFirstInteraction}>
            <Field form={anfrage} name="reporter_name">
              <Input {...anfrage.field('reporter_name')} placeholder={tx('Vor- und Nachname')} />
            </Field>
            <Field form={anfrage} name="reporter_email">
              <Input {...anfrage.field('reporter_email')} placeholder={tx('deine@email.de')} />
            </Field>
            <Field form={anfrage} name="reporter_phone">
              <Input {...anfrage.field('reporter_phone')} placeholder={tx('z. B. +49 89 123456')} />
            </Field>
          </div>
          <StepNav
            onNext={() => anfrage.validate(['reporter_name', 'reporter_email'])}
            nextStepLabel={tx('Details zur Anfrage')}
          />
        </WizardStep>

        <WizardStep
          label={tx('Dein Anliegen')}
          description={tx('Beschreibe das Problem oder die Anfrage so genau wie möglich.')}
        >
          <div className="space-y-5">
            <Field form={anfrage} name="title">
              <Input {...anfrage.field('title')} placeholder={tx('Kurze Zusammenfassung des Problems')} />
            </Field>
            <Field form={anfrage} name="description">
              <Textarea
                {...anfrage.field('description')}
                placeholder={tx('Was ist passiert? Seit wann? Welche Geräte oder Systeme sind betroffen?')}
                rows={5}
              />
            </Field>
          </div>
          <StepNav
            onNext={() => anfrage.validate(['title'])}
            nextStepLabel={tx('Prüfen & Absenden')}
          />
        </WizardStep>

        <WizardStep label={tx('Prüfen & Absenden')}>
          {!submit.result && (
            <SummaryStep
              forms={[anfrage]}
              submit={submit}
              whatHappensNext={tx('Das Helpdesk-Team nimmt dein Ticket auf und meldet sich per E-Mail bei dir.')}
              confirmLabel={tx('Anfrage absenden')}
            />
          )}
          {submit.result && (
            <SuccessStep
              result={submit.result}
              forms={[anfrage]}
              referencePrefix="T"
              whatHappensNext={tx('Das Helpdesk-Team nimmt dein Ticket auf und meldet sich per E-Mail bei dir.')}
              next={[{ label: tx('Neue Anfrage einreichen'), onClick: restart }]}
            />
          )}
        </WizardStep>
      </IntentWizardShell>
    </PublicShell>
  );
}
