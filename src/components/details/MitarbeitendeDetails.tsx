import type { Mitarbeitende, Teams, Tickets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface MitarbeitendeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Mitarbeitende;
  /** N:1-Ziel „Teams": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  teamsList: Teams[];
  /** Klick auf die Teams-Relation → overlay.push auf dessen Detail. */
  onOpenTeams?: (record: Teams) => void;
  /** 1:N „Teams" (lead): VOLLE Liste — der Block filtert auf diesen Record. */
  teamsLeadList: Teams[];
  /** Zeilen-Klick → overlay.push auf das Teams-Detail (nie der Edit-Dialog). */
  onOpenTeamsLead: (record: Teams) => void;
  /** Kontextuelles „+": öffnet den Teams-Dialog mit diesem Record vorgesetzt. */
  onAddTeamsLead?: () => void;
  /** 1:N „Tickets" (assigned_agent): VOLLE Liste — der Block filtert auf diesen Record. */
  ticketsList: Tickets[];
  /** Zeilen-Klick → overlay.push auf das Tickets-Detail (nie der Edit-Dialog). */
  onOpenTickets: (record: Tickets) => void;
  /** Kontextuelles „+": öffnet den Tickets-Dialog mit diesem Record vorgesetzt. */
  onAddTickets?: () => void;
}

export function MitarbeitendeDetails({
  record,
  teamsList,
  onOpenTeams,
  teamsLeadList,
  onOpenTeamsLead,
  onAddTeamsLead,
  ticketsList,
  onOpenTickets,
  onAddTickets,
}: MitarbeitendeDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
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
        title={`${appLabel('teams')} · ${fieldLabel('teams', 'lead')}`}
        items={teamsLeadList.filter(r => extractRecordId(r.fields.lead) === record.record_id)}
        map={r => ({ name: r.fields.name ?? appLabel('teams'), meta: undefined })}
        onOpen={onOpenTeamsLead}
        onAdd={onAddTeamsLead}
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

      <RecordAttachments appId={APP_IDS.MITARBEITENDE} recordId={record.record_id} readOnly={!perms.canWrite('mitarbeitende')} />
    </>
  );
}
