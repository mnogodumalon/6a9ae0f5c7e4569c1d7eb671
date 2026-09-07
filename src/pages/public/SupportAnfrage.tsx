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

const SLUG = 'support-anfrage';


export default function SupportAnfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    }).catch(err => {
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

  const ticket = useStepForm('tickets', {
    fields: ['title', 'description', 'category', 'reporter_name', 'reporter_email', 'reporter_phone'],
    required: {
      title: true,
      description: false,
      category: false,
      reporter_name: true,
      reporter_email: true,
      reporter_phone: false,
    },
    autoComplete: true,
    steps: {
      title: 1,
      description: 1,
      category: 2,
      reporter_name: 3,
      reporter_email: 3,
      reporter_phone: 3,
    },
  });

  const submit = useJourneySubmit(
    port!,
    [{ key: 'ticket', entity: 'tickets', form: ticket, primary: true }],
    { draftKey: 'support-anfrage' },
  );

  const restart = () => {
    ticket.reset();
    submit.reset?.();
    setStep(1);
  };

  if (loading || unavailable || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={unavailable || (!loading && (!cfg || !page))} />;
  }

  const ep = page.endpoints?.find(e => e.op === 'create' && e.entity === 'tickets');
  if (ep) {
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  }

  return (
    <PublicShell
      title={tx('Support-Anfrage einreichen')}
      description={tx('Schildere dein IT-Problem — das Helpdesk-Team kümmert sich darum.')}
    >
      <IntentWizardShell
        currentStep={step}
        onStepChange={setStep}
        forms={[ticket]}
        draftKey="support-anfrage"
        back={false}
      >
        {/* Step 1: Betreff und Beschreibung */}
        <WizardStep
          label={tx('Betreff & Beschreibung')}
          heading={tx('Was ist das Problem?')}
          description={tx('Beschreibe kurz, was nicht funktioniert.')}
        >
          <div className="space-y-5">
            <Field form={ticket} name="title">
              <Input
                {...ticket.field('title')}
                placeholder={tx('z. B. Drucker im 2. OG druckt nicht')}
              />
            </Field>
            <Field form={ticket} name="description">
              <Textarea
                {...ticket.field('description')}
                rows={4}
                placeholder={tx('Fehlermeldung, betroffenes Gerät, seit wann …')}
              />
            </Field>
            <StepNav
              onNext={() => ticket.validate(['title'])}
              nextStepLabel={tx('Kategorie')}
            />
          </div>
        </WizardStep>

        {/* Step 2: Kategorie wählen */}
        <WizardStep
          label={tx('Kategorie')}
          heading={tx('Welche Kategorie trifft am besten zu?')}
          description={tx('Die Kategorie hilft dem Support-Team, das Ticket schneller zuzuweisen.')}
        >
          <div className="space-y-5">
            <Field form={ticket} name="category">
              <ChoiceGroup {...ticket.choice('category')} allowClear />
            </Field>
            <StepNav
              nextStepLabel={tx('Kontaktdaten')}
            />
          </div>
        </WizardStep>

        {/* Step 3: Kontaktdaten eingeben */}
        <WizardStep
          label={tx('Kontaktdaten')}
          heading={tx('Wie können wir dich erreichen?')}
          description={tx('Damit das Team Rückfragen stellen und den Status mitteilen kann.')}
        >
          <div className="space-y-5">
            <Field form={ticket} name="reporter_name">
              <Input
                {...ticket.field('reporter_name')}
                placeholder={tx('Vor- und Nachname')}
              />
            </Field>
            <Field form={ticket} name="reporter_email">
              <Input
                {...ticket.field('reporter_email')}
                placeholder={tx('deine@firma.de')}
              />
            </Field>
            <Field form={ticket} name="reporter_phone">
              <Input
                {...ticket.field('reporter_phone')}
                placeholder={tx('Durchwahl oder Mobilnummer')}
              />
            </Field>
            <StepNav
              onNext={() => ticket.validate(['reporter_name', 'reporter_email'])}
              nextStepLabel={tx('Prüfen & Absenden')}
            />
          </div>
        </WizardStep>

        {/* Step 4: Zusammenfassung und Erfolg */}
        <WizardStep label={tx('Prüfen & Absenden')}>
          {!submit.result && (
            <SummaryStep
              forms={[ticket]}
              submit={submit}
              whatHappensNext={tx('Das Helpdesk-Team nimmt dein Ticket an und meldet sich sobald wie möglich bei dir.')}
              confirmLabel={tx('Anfrage einreichen')}
            />
          )}
          {submit.result && (
            <SuccessStep
              result={submit.result}
              forms={[ticket]}
              title={tx('Anfrage eingereicht')}
              whatHappensNext={tx('Das Helpdesk-Team hat dein Ticket erhalten und kümmert sich darum.')}
              referencePrefix="T"
              next={[
                { label: tx('Neue Anfrage stellen'), onClick: restart },
              ]}
            />
          )}
        </WizardStep>
      </IntentWizardShell>
    </PublicShell>
  );
}
