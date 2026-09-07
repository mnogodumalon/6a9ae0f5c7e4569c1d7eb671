import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
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
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'support-anfrage';

export default function SupportAnfrage() {
  const STEPS = [
  {
    label: tx('Anfrage'),
    heading: tx('Was ist das Problem?'),
    description: tx('Beschreibe kurz, worum es geht – Titel und Details helfen uns, schnell zu helfen.'),
    needs: ['title'],
  },
  {
    label: tx('Kontakt'),
    heading: tx('Kategorie & Kontakt'),
    description: tx('Wähle die Kategorie und hinterlasse deine Kontaktdaten, damit wir uns melden können.'),
    needs: ['reporter_name', 'reporter_email'],
  },
  {
    label: tx('Prüfen'),
    heading: tx('Alles richtig?'),
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
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
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
      reporter_name: true,
      reporter_email: true,
    },
    steps: {
      title: 1,
      description: 1,
      category: 2,
      reporter_name: 2,
      reporter_email: 2,
      reporter_phone: 2,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    [
      {
        key: 'ticket',
        entity: 'tickets',
        form: f,
        primary: true,
      },
    ],
    { draftKey: SLUG },
  );

  if (loading || (!cfg && !unavailable)) {
    return <PublicShell loading />;
  }
  if (unavailable || !page || !port) {
    return <PublicShell unavailable />;
  }

  return (
    <PublicShell
      title={tx('Support-Anfrage einreichen')}
      description={tx('Kein Helpdesk-Konto nötig — einfach das Formular ausfüllen und absenden.')}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey={SLUG}
        intro={{
          description: tx('In wenigen Schritten erreichst du unser Support-Team — ganz ohne Login.'),
          needs: [tx('Einen kurzen Titel für das Problem'), tx('Deine E-Mail-Adresse')],
          estimatedMinutes: 2,
          startLabel: tx('Anfrage starten'),
        }}
      >
        {/* Schritt 1: Titel & Beschreibung */}
        {step === 1 && !submit.done && (
          <div className="space-y-5">
            <Field form={f} name="title" label={tx('Titel')}>
              <input
                {...f.field('title')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={tx('z. B. Drucker im 2. OG druckt nicht')}
              />
            </Field>
            <Field form={f} name="description" hint={tx('Je mehr Details, desto schneller können wir helfen.')}>
              <textarea
                {...f.field('description')}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                placeholder={tx('Was passiert genau? Seit wann? Welche Fehlermeldung siehst du?')}
              />
            </Field>
            <StepNav
              onNext={() => f.validate(['title'])}
              nextStepLabel={tx('Kategorie & Kontakt')}
              hideBack
            />
          </div>
        )}

        {/* Schritt 2: Kategorie & Kontaktdaten */}
        {step === 2 && !submit.done && (
          <div className="space-y-5">
            <Bound form={f} name="category" allowClear />
            <div className="border-t pt-5">
              <p className="text-sm font-medium text-foreground mb-4">{tx('Deine Kontaktdaten')}</p>
              <div className="space-y-4">
                <Field form={f} name="reporter_name" label={tx('Name')}>
                  <input
                    {...f.field('reporter_name')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={tx('Vor- und Nachname')}
                  />
                </Field>
                <Field form={f} name="reporter_email" label={tx('E-Mail')}>
                  <input
                    {...f.field('reporter_email')}
                    type="email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={tx('deine@email.de')}
                  />
                </Field>
                <Field form={f} name="reporter_phone" label={tx('Telefon (optional)')}>
                  <input
                    {...f.field('reporter_phone')}
                    type="tel"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={tx('z. B. +49 89 12345678')}
                  />
                </Field>
              </div>
            </div>
            <StepNav
              onNext={() => f.validate(['reporter_name', 'reporter_email'])}
              nextStepLabel={tx('Prüfen & Absenden')}
            />
          </div>
        )}

        {/* Schritt 3: Zusammenfassung & Absenden */}
        {step === 3 && !submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Deine Anfrage landet direkt bei unserem Support-Team. Wir melden uns so schnell wie möglich per E-Mail.')}
            confirmLabel={tx('Anfrage absenden')}
          />
        )}

        {/* Erfolg */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            title={tx('Anfrage eingegangen!')}
            whatHappensNext={tx('Unser Team hat deine Anfrage erhalten und wird sich bald bei dir melden. Schau auch in deinen Spam-Ordner, falls du nichts hörst.')}
            referencePrefix="T"
            submit={submit}
            restartLabel={tx('Weitere Anfrage stellen')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
