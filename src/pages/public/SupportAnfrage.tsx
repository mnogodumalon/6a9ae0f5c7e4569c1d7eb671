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
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { tx } from '@/i18n';

const SLUG = 'support-anfrage';

export default function SupportAnfrage() {
  const STEPS = [
  {
    label: tx('Angaben'),
    key: 'angaben',
    description: tx('Bitte fülle das Formular aus — wir melden uns so schnell wie möglich.'),
  },
  {
    label: tx('Prüfen'),
    key: 'prufen',
  },
];

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
        if (!c?.pages[SLUG]) setUnavailable(true);
      })
      .catch(err => {
        setLoading(false);
        if (err instanceof PageUnavailableError) setUnavailable(true);
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
      category: 1,
      reporter_name: 1,
      reporter_email: 1,
      reporter_phone: 1,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    [{ key: 'ticket', entity: 'tickets', form: f, primary: true }],
    { draftKey: 'support-anfrage' },
  );

  if (loading || (!cfg && !unavailable)) {
    return <PublicShell loading />;
  }
  if (unavailable || !cfg || !page || !port) {
    return <PublicShell unavailable />;
  }

  const handleNext = () => {
    const ok = f.validate(['title', 'reporter_name', 'reporter_email']);
    return ok;
  };

  const handleFormFocus = () => {
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  if (submit.result) {
    return (
      <PublicShell title={tx('Support-Anfrage einreichen')}>
        <SuccessStep
          result={submit.result}
          forms={[f]}
          whatHappensNext={tx('Wir haben deine Anfrage erhalten und melden uns schnellstmöglich bei dir.')}
          referencePrefix="T"
          submit={submit}
          restartLabel={tx('Neue Anfrage einreichen')}
        />
      </PublicShell>
    );
  }

  return (
    <PublicShell title={tx('Support-Anfrage einreichen')} description={tx('Beschreibe dein Problem — das Helpdesk-Team kümmert sich darum.')}>
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey="support-anfrage"
      >
        {step === 1 && (
          <div className="space-y-5" onFocus={handleFormFocus}>
            <Field form={f} name="title" label={tx('Titel')}>
              <input {...f.field('title')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder={tx('Kurze Beschreibung des Problems')} />
            </Field>

            <Field form={f} name="category" label={tx('Kategorie')}>
              <Bound form={f} name="category" allowClear />
            </Field>

            <Field form={f} name="description" label={tx('Beschreibung')}>
              <textarea {...f.field('description')} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder={tx('Was genau passiert? Seit wann? Welche Fehlermeldung siehst du?')} />
            </Field>

            <hr className="border-border" />
            <p className="text-sm font-medium text-foreground">{tx('Deine Kontaktdaten')}</p>

            <Field form={f} name="reporter_name" label={tx('Name')}>
              <input {...f.field('reporter_name')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder={tx('Vor- und Nachname')} />
            </Field>

            <Field form={f} name="reporter_email" label={tx('E-Mail')}>
              <input {...f.field('reporter_email')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder={tx('deine@email.de')} />
            </Field>

            <Field form={f} name="reporter_phone" label={tx('Telefon')} hint={tx('Optional — falls wir dich direkt anrufen sollen')}>
              <input {...f.field('reporter_phone')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="+49 …" />
            </Field>

            <StepNav
              hideBack
              onNext={handleNext}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}

        {step === 2 && !submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Das Helpdesk-Team prüft deine Anfrage und meldet sich bei dir.')}
            confirmLabel={tx('Anfrage absenden')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
