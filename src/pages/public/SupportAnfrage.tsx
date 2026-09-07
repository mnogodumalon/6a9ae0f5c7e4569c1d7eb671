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
    label: tx('Anfrage'),
    heading: tx('Titel und Beschreibung'),
    description: tx('Was ist das Problem? Bitte beschreibe es so genau wie möglich.'),
  },
  {
    label: tx('Kontakt'),
    heading: tx('Deine Kontaktdaten'),
    description: tx('Wie können wir dich bei Rückfragen erreichen?'),
  },
  {
    label: tx('Prüfen'),
    heading: tx('Alles richtig?'),
  },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    }).catch(err => {
      if (err instanceof PageUnavailableError) {
        setLoading(false);
      }
    });
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const form = useStepForm('tickets', {
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
      reporter_name: 2,
      reporter_email: 2,
      reporter_phone: 2,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    [{ key: 'ticket', entity: 'tickets', form, primary: true }],
    { draftKey: 'support-anfrage' },
  );

  if (loading || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={!loading && (!cfg || !page)} />;
  }

  const handleFirstInteraction = () => {
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const restart = () => {
    form.reset();
    submit.reset();
    setStep(1);
  };

  return (
    <PublicShell
      title={tx('Support-Anfrage einreichen')}
      description={tx('Mitarbeiterinnen und Mitarbeiter ohne Helpdesk-Zugang können hier ein Ticket eröffnen.')}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[form]}
        draftKey="support-anfrage"
      >
        {/* Schritt 1: Titel, Beschreibung und Kategorie */}
        {step === 1 && !submit.done && (
          <div className="space-y-5" onFocus={handleFirstInteraction}>
            <Field form={form} name="title">
              <input
                {...form.field('title')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={tx('z. B. Drucker im 2. OG reagiert nicht')}
              />
            </Field>

            <Field form={form} name="description">
              <textarea
                {...form.field('description')}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder={tx('Bitte beschreibe das Problem möglichst genau — seit wann tritt es auf, was hast du bereits versucht?')}
              />
            </Field>

            <Bound form={form} name="category" allowClear />

            <StepNav
              onNext={() => form.validate(['title', 'description', 'category'])}
              nextStepLabel={tx('Kontaktdaten')}
              hideBack
            />
          </div>
        )}

        {/* Schritt 2: Kontaktdaten */}
        {step === 2 && !submit.done && (
          <div className="space-y-5">
            <Field form={form} name="reporter_name">
              <input
                {...form.field('reporter_name')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={tx('Vor- und Nachname')}
              />
            </Field>

            <Field form={form} name="reporter_email">
              <input
                {...form.field('reporter_email')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={tx('name@unternehmen.de')}
              />
            </Field>

            <Field form={form} name="reporter_phone" hint={tx('Optional — für dringende Rückfragen')}>
              <input
                {...form.field('reporter_phone')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={tx('+49 ...')}
              />
            </Field>

            <StepNav
              onBack={() => setStep(1)}
              onNext={() => form.validate(['reporter_name', 'reporter_email', 'reporter_phone'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}

        {/* Schritt 3: Zusammenfassung */}
        {step === 3 && !submit.done && (
          <SummaryStep
            forms={[form]}
            submit={submit}
            whatHappensNext={tx('Das Helpdesk-Team wird dein Ticket prüfen und sich so schnell wie möglich bei dir melden.')}
            confirmLabel={tx('Anfrage einreichen')}
          />
        )}

        {/* Erfolg */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[form]}
            submit={submit}
            whatHappensNext={tx('Das Helpdesk-Team wird dein Ticket prüfen und sich so schnell wie möglich bei dir melden.')}
            next={[{ label: tx('Weitere Anfrage einreichen'), onClick: restart }]}
            referencePrefix="T"
            restartLabel={tx('Weitere Anfrage einreichen')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
