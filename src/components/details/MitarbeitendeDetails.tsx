import type { Mitarbeitende, Teams, Tickets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface MitarbeitendeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Mitarbeitende;
  /** Liste der Teams — wird für N:1 und 1:N genutzt. */
  teamsList: Teams[];
  /** Klick auf ein Teams-Record → overlay.push auf dessen Detail. */
  onOpenTeams?: (record: Teams) => void;
  /** Kontextuelles „+": öffnet den Teams-Dialog mit diesem Record vorgesetzt. */
  onAddTeams: () => void;
  /** 1:N „Tickets" (assigned_agent): VOLLE Liste — der Block filtert auf diesen Record. */
  ticketsList: Tickets[];
  /** Zeilen-Klick → overlay.push auf das Tickets-Detail (nie der Edit-Dialog). */
  onOpenTickets: (record: Tickets) => void;
  /** Kontextuelles „+": öffnet den Tickets-Dialog mit diesem Record vorgesetzt. */
  onAddTickets: () => void;
}

export function MitarbeitendeDetails({
  record,
  teamsList,
  onOpenTeams,
  onAddTeams,
  ticketsList,
  onOpenTickets,
  onAddTickets,
}: MitarbeitendeDetailsProps) {
  const teamTarget = teamsList.find(r => r.record_id === extractRecordId(record.fields.team));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('mitarbeitende', 'first_name')} value={record.fields.first_name} format="text" />
        <RecordField label={fieldLabel('mitarbeitende', 'last_name')} value={record.fields.last_name} format="text" />
        <RecordField label={fieldLabel('mitarbeitende', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('mitarbeitende', 'phone')} value={record.fields.phone} format="text" />
        <RecordField label={fieldLabel('mitarbeitende', 'active')} value={record.fields.active} format="bool" />
        <RecordField label={fieldLabel('mitarbeitende', 'working_hours_per_week')} value={record.fields.working_hours_per_week} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('mitarbeitende', 'team')}
          name={teamTarget?.fields.name ?? '—'}
          meta={[teamTarget?.fields.cost_center].filter(Boolean).join(' · ') || undefined}
          onClick={teamTarget && onOpenTeams ? () => onOpenTeams!(teamTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('teams')}
        items={teamsList.filter(r => extractRecordId(r.fields.lead) === record.record_id)}
        map={r => ({ name: r.fields.name ?? appLabel('teams'), meta: undefined })}
        onOpen={onOpenTeams ?? (() => {})}
        onAdd={onAddTeams}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('tickets')}
        items={ticketsList.filter(r => extractRecordId(r.fields.assigned_agent) === record.record_id)}
        map={r => ({ name: r.fields.title ?? appLabel('tickets'), meta: r.fields.due })}
        onOpen={onOpenTickets}
        onAdd={onAddTickets}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.MITARBEITENDE} recordId={record.record_id} />
    </>
  );
}
