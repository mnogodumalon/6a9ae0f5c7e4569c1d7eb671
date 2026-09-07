import type { Notizen, Tickets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface NotizenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Notizen;
  /** N:1-Ziel „Tickets": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  ticketsList: Tickets[];
  /** Klick auf die Tickets-Relation → overlay.push auf dessen Detail. */
  onOpenTickets?: (record: Tickets) => void;
}

export function NotizenDetails({
  record,
  ticketsList,
  onOpenTickets,
}: NotizenDetailsProps) {
  const ticketTarget = ticketsList.find(r => r.record_id === extractRecordId(record.fields.ticket));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('notizen', 'text')} value={record.fields.text} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('notizen', 'author')} value={record.fields.author} format="text" />
        <RecordField label={fieldLabel('notizen', 'visible_to_reporter')} value={record.fields.visible_to_reporter} format="bool" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('notizen', 'ticket')}
          name={ticketTarget?.fields.title ?? '—'}
          meta={[ticketTarget?.fields.reporter_email, ticketTarget?.fields.reporter_phone].filter(Boolean).join(' · ') || undefined}
          onClick={ticketTarget && onOpenTickets ? () => onOpenTickets!(ticketTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.NOTIZEN} recordId={record.record_id} />
    </>
  );
}
