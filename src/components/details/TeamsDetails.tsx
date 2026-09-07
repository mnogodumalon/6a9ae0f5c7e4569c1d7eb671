import type { Teams, Mitarbeitende, Tickets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface TeamsDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Teams;
  /** N:1-Ziel „Mitarbeitende" + 1:N-Satellite (team): volle Liste. */
  mitarbeitendeList: Mitarbeitende[];
  /** Klick auf Mitarbeitende-Relation/Zeile → overlay.push auf dessen Detail. */
  onOpenMitarbeitende?: (record: Mitarbeitende) => void;
  /** Kontextuelles „+": öffnet den Mitarbeitende-Dialog mit diesem Record vorgesetzt. */
  onAddMitarbeitende: () => void;
  /** 1:N „Tickets" (team): VOLLE Liste — der Block filtert auf diesen Record. */
  ticketsList: Tickets[];
  /** Zeilen-Klick → overlay.push auf das Tickets-Detail (nie der Edit-Dialog). */
  onOpenTickets: (record: Tickets) => void;
  /** Kontextuelles „+": öffnet den Tickets-Dialog mit diesem Record vorgesetzt. */
  onAddTickets: () => void;
}

export function TeamsDetails({
  record,
  mitarbeitendeList,
  onOpenMitarbeitende,
  onAddMitarbeitende,
  ticketsList,
  onOpenTickets,
  onAddTickets,
}: TeamsDetailsProps) {
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
          name={leadTarget ? [leadTarget.fields.first_name, leadTarget.fields.last_name].filter(Boolean).join(' ') : '—'}
          meta={[leadTarget?.fields.email, leadTarget?.fields.phone].filter(Boolean).join(' · ') || undefined}
          onClick={leadTarget && onOpenMitarbeitende ? () => onOpenMitarbeitende!(leadTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('mitarbeitende')}
        items={mitarbeitendeList.filter(r => extractRecordId(r.fields.team) === record.record_id)}
        map={r => ({ name: [r.fields.first_name, r.fields.last_name].filter(Boolean).join(' ') || appLabel('mitarbeitende'), meta: undefined })}
        onOpen={onOpenMitarbeitende ?? (() => {})}
        onAdd={onAddMitarbeitende}
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

      <RecordAttachments appId={APP_IDS.TEAMS} recordId={record.record_id} />
    </>
  );
}
