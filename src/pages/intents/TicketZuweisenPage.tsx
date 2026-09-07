/**
 * Ticket zuweisen — 3-Schritt-Wizard.
 * Steps: 1) Ticket wählen → 2) Zuweisung (Mitarbeitende/r + Team) → 3) Zusammenfassung & aktualisieren.
 * Reads: tickets (filter: new|in_progress), mitarbeitende (filter: active), teams.
 * Writes: tickets (update: assigned_agent, team, status → 'in_progress' when was 'new').
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldLookup,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function TicketZuweisenPage() {
  const [step, setStep] = useState(1);
  // Ticket-ID außerhalb des Formulars, da 'tickets' keine Selbstreferenz als Input hat
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Step 1: Tickets — nur 'new' und 'in_progress'
  const tickets = useRecordSearch(servicePort, 'tickets', {
    filter: "r.v_status in ['new', 'in_progress']",
    where: r => {
      const s = fieldLookup(r, 'status')?.key;
      return s === 'new' || s === 'in_progress';
    },
    searchFields: ['title', 'reporter_name'],
    toItem: r => ({
      id: r.id,
      title: fieldText(r, 'title'),
      subtitle: fieldText(r, 'reporter_name'),
      status: fieldLookup(r, 'status') ?? undefined,
    }),
  });

  // Step 2a: Mitarbeitende — nur aktive
  const mitarbeitende = useRecordSearch(servicePort, 'mitarbeitende', {
    filter: 'r.v_active == True',
    where: r => r.fields['active'] === true,
    searchFields: ['first_name', 'last_name', 'email'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'first_name')} ${fieldText(m, 'last_name')}`.trim(),
      subtitle: fieldText(m, 'email'),
    }),
  });

  // Step 2b: Teams — alle
  const teams = useRecordSearch(servicePort, 'teams', {
    searchFields: ['name'],
    toItem: t => ({
      id: t.id,
      title: fieldText(t, 'name'),
    }),
  });

  // Formular: nur die Felder, die dieser Flow setzt
  const f = useStepForm('tickets', {
    fields: ['assigned_agent', 'team'],
    steps: { assigned_agent: 2, team: 2 },
    required: { team: false },
  });

  // Der gewählte Ticket-Record (für die Status-Logik)
  const selectedTicketRecord = selectedTicketId ? tickets.recordOf(selectedTicketId) : undefined;
  const wasNew = fieldLookup(selectedTicketRecord ?? { id: '', fields: {}, createdAt: null }, 'status')?.key === 'new';

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'ticket',
        entity: 'tickets',
        form: f,
        updates: selectedTicketId ?? '',
        primary: true,
        verb: 'update',
        values: wasNew ? { status: 'in_progress' } : {},
      },
    ],
    { draftKey: 'ticket-zuweisen' },
  );

  const ticketTitle = selectedTicketRecord ? fieldText(selectedTicketRecord, 'title') : '';

  return (
    <IntentWizardShell
      title={tx('Ticket zuweisen')}
      subtitle={tx('Mitarbeitende/r und Team für ein Ticket festlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="ticket-zuweisen"
      intro={{
        description: tx('Ein Ticket einem aktiven Mitarbeitenden und optional einem Team zuweisen.'),
        needs: [tx('Das zu bearbeitende Ticket'), tx('Name des zuständigen Mitarbeitenden')],
      }}
    >
      {/* Schritt 1: Ticket wählen */}
      <WizardStep
        label={tx('Ticket wählen')}
        description={tx('Nur Tickets mit Status „Neu" oder „In Bearbeitung" werden angezeigt.')}
      >
        <EntitySelectStep
          {...tickets.select}
          selectedId={selectedTicketId}
          emptyText={tx('Kein offenes Ticket gefunden. Nur Tickets mit Status „Neu" oder „In Bearbeitung" können zugewiesen werden.')}
          create={false}
          onSelect={id => {
            setSelectedTicketId(id);
            setStep(2);
          }}
        />
      </WizardStep>

      {/* Schritt 2: Zuweisung */}
      <WizardStep
        label={tx('Zuweisung')}
        description={tx('Zuständige/n Mitarbeitende/n und optional ein Team auswählen.')}
      >
        {selectedTicketId ? (
          <div className="space-y-6">
            {/* Mitarbeitende/r */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                {tx('Zugewiesene/r Mitarbeitende/r')}
                <span className="text-destructive ml-1" aria-hidden>*</span>
              </p>
              <EntitySelectStep
                {...mitarbeitende.select}
                selectedId={f.get('assigned_agent') as string | null}
                emptyText={tx('Keine aktiven Mitarbeitenden gefunden.')}
                create={false}
                onSelect={id => {
                  f.set('assigned_agent', id, mitarbeitende.labelOf(id));
                }}
              />
            </div>

            {/* Team */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                {tx('Team')}
                <span className="text-xs text-muted-foreground ml-2">{tx('(optional)')}</span>
              </p>
              <EntitySelectStep
                {...teams.select}
                selectedId={f.get('team') as string | null}
                create={false}
                onSelect={id => {
                  f.set('team', id, teams.labelOf(id));
                }}
              />
            </div>

            <StepNav
              onBack={() => setStep(1)}
              onNext={() => f.validate(['assigned_agent'])}
              nextStepLabel={tx('Zusammenfassung')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst ein Ticket auswählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 3: Zusammenfassung */}
      <WizardStep label={tx('Zusammenfassung')}>
        {!submit.done ? (
          <SummaryStep
            forms={[f]}
            submit={submit}
            items={[
              {
                key: '_ticket',
                label: tx('Ticket'),
                value: ticketTitle || (selectedTicketId ?? '—'),
                step: 1,
              },
              ...(wasNew
                ? [
                    {
                      key: '_status',
                      label: tx('Neuer Status'),
                      value: tx('In Bearbeitung'),
                    },
                  ]
                : []),
            ]}
            whatHappensNext={tx(
              'Das Ticket wird sofort der ausgewählten Person zugewiesen. Bei Tickets mit Status „Neu" wird der Status automatisch auf „In Bearbeitung" gesetzt.',
            )}
            confirmLabel={tx('Zuweisung speichern')}
          />
        ) : null}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          facts={[
            { label: tx('Ticket'), value: ticketTitle },
          ]}
          verb="updated"
          title={tx('Zuweisung gespeichert')}
          whatHappensNext={tx('Die zugewiesene Person kann das Ticket nun bearbeiten.')}
          next={[
            {
              label: tx('Weiteres Ticket zuweisen'),
              onClick: () => {
                submit.reset();
                f.reset();
                setStep(1);
              },
            },
            {
              label: tx('Notiz hinzufügen'),
              href: '#/intents/notiz-hinzufuegen',
            },
            {
              label: tx('Neues Ticket'),
              href: '#/intents/neues-ticket',
            },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
