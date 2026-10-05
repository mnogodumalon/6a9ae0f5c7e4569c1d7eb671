import type { Teams, Mitarbeitende, Tickets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface TeamsDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Teams;
  /** N:1-Ziel „Mitarbeitende": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitarbeitendeList: Mitarbeitende[];
  /** Klick auf die Mitarbeitende-Relation → overlay.push auf dessen Detail. */
  onOpenMitarbeitende?: (record: Mitarbeitende) => void;
  /** 1:N „Mitarbeitende" (team): VOLLE Liste — der Block filtert auf diesen Record. */
  mitarbeitendeTeamList: Mitarbeitende[];
  /** Zeilen-Klick → overlay.push auf das Mitarbeitende-Detail (nie der Edit-Dialog). */
  onOpenMitarbeitendeTeam: (record: Mitarbeitende) => void;
  /** Kontextuelles „+": öffnet den Mitarbeitende-Dialog mit diesem Record vorgesetzt. */
  onAddMitarbeitendeTeam?: () => void;
  /** 1:N „Tickets" (team): VOLLE Liste — der Block filtert auf diesen Record. */
  ticketsList: Tickets[];
  /** Zeilen-Klick → overlay.push auf das Tickets-Detail (nie der Edit-Dialog). */
  onOpenTickets: (record: Tickets) => void;
  /** Kontextuelles „+": öffnet den Tickets-Dialog mit diesem Record vorgesetzt. */
  onAddTickets?: () => void;
}

export function TeamsDetails({
  record,
  mitarbeitendeList,
  onOpenMitarbeitende,
  mitarbeitendeTeamList,
  onOpenMitarbeitendeTeam,
  onAddMitarbeitendeTeam,
  ticketsList,
  onOpenTickets,
  onAddTickets,
}: TeamsDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  const leadTarget = mitarbeitendeList.find(r => r.record_id === extractRecordId(record.fields.lead));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('teams', 'name')} value={record.fields.name} format="text" />
        <RecordField label={fieldLabel('teams', 'cost_center')} value={record.fields.cost_center} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('teams', 'lead')}
          name={leadTarget?.fields.first_name ?? '—'}
          meta={[leadTarget?.fields.email, leadTarget?.fields.phone].filter(Boolean).join(' · ') || undefined}
          onClick={leadTarget && onOpenMitarbeitende ? () => onOpenMitarbeitende!(leadTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={`${appLabel('mitarbeitende')} · ${fieldLabel('mitarbeitende', 'team')}`}
        items={mitarbeitendeTeamList.filter(r => extractRecordId(r.fields.team) === record.record_id)}
        map={r => ({ name: r.fields.first_name ?? appLabel('mitarbeitende'), meta: undefined })}
        onOpen={onOpenMitarbeitendeTeam}
        onAdd={onAddMitarbeitendeTeam}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('tickets')}
        items={ticketsList.filter(r => extractRecordId(r.fields.team) === record.record_id)}
        map={r => ({ name: r.fields.title ?? appLabel('tickets'), meta: r.fields.due })}
        onOpen={onOpenTickets}
        onAdd={onAddTickets}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TEAMS} recordId={record.record_id} readOnly={!perms.canWrite('teams')} />
    </>
  );
}
