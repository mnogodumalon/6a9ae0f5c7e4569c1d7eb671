import type { Tickets, Mitarbeitende, Teams, Assets, Notizen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface TicketsDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Tickets;
  /** N:1-Ziel „Mitarbeitende": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitarbeitendeList: Mitarbeitende[];
  /** Klick auf die Mitarbeitende-Relation → overlay.push auf dessen Detail. */
  onOpenMitarbeitende?: (record: Mitarbeitende) => void;
  /** N:1-Ziel „Teams": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  teamsList: Teams[];
  /** Klick auf die Teams-Relation → overlay.push auf dessen Detail. */
  onOpenTeams?: (record: Teams) => void;
  /** N:1-Ziel „Tickets": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  ticketsList: Tickets[];
  /** Klick auf die Tickets-Relation → overlay.push auf dessen Detail. */
  onOpenTickets?: (record: Tickets) => void;
  /** N:1-Ziel „Assets": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  assetsList: Assets[];
  /** Klick auf die Assets-Relation → overlay.push auf dessen Detail. */
  onOpenAssets?: (record: Assets) => void;
  /** 1:N „Notizen" (ticket): VOLLE Liste — der Block filtert auf diesen Record. */
  notizenList: Notizen[];
  /** Zeilen-Klick → overlay.push auf das Notizen-Detail (nie der Edit-Dialog). */
  onOpenNotizen: (record: Notizen) => void;
  /** Kontextuelles „+": öffnet den Notizen-Dialog mit diesem Record vorgesetzt. */
  onAddNotizen: () => void;
}

export function TicketsDetails({
  record,
  mitarbeitendeList,
  onOpenMitarbeitende,
  teamsList,
  onOpenTeams,
  ticketsList,
  onOpenTickets,
  assetsList,
  onOpenAssets,
  notizenList,
  onOpenNotizen,
  onAddNotizen,
}: TicketsDetailsProps) {
  const assigned_agentTarget = mitarbeitendeList.find(r => r.record_id === extractRecordId(record.fields.assigned_agent));
  const teamTarget = teamsList.find(r => r.record_id === extractRecordId(record.fields.team));
  const parent_ticketTarget = ticketsList.find(r => r.record_id === extractRecordId(record.fields.parent_ticket));
  const affected_assetTarget = assetsList.find(r => r.record_id === extractRecordId(record.fields.affected_asset));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('tickets', 'title')} value={record.fields.title} format="text" />
        <RecordField label={fieldLabel('tickets', 'description')} value={record.fields.description} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('tickets', 'priority')} value={record.fields.priority} format="pill" />
        <RecordField label={fieldLabel('tickets', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('tickets', 'category')} value={record.fields.category} format="pill" />
        <RecordField label={fieldLabel('tickets', 'reporter_name')} value={record.fields.reporter_name} format="text" />
        <RecordField label={fieldLabel('tickets', 'reporter_email')} value={record.fields.reporter_email} format="email" />
        <RecordField label={fieldLabel('tickets', 'reporter_phone')} value={record.fields.reporter_phone} format="text" />
        <RecordField label={fieldLabel('tickets', 'due')} value={record.fields.due} format="datetime" />
        <RecordField label={fieldLabel('tickets', 'opened_on')} value={record.fields.opened_on} format="date" />
        <RecordField label={fieldLabel('tickets', 'tags')} value={Array.isArray(record.fields.tags) ? record.fields.tags.map((v: unknown) => (v && typeof v === 'object' && 'label' in v) ? (v as {label: unknown}).label : v).join(', ') : null} format="text" />
        <RecordField label={fieldLabel('tickets', 'vendor_link')} value={record.fields.vendor_link} format="url" />
        <RecordField label={fieldLabel('tickets', 'estimated_hours')} value={record.fields.estimated_hours} format="text" />
        <RecordField label={fieldLabel('tickets', 'billable')} value={record.fields.billable} format="bool" />
        <RecordField label={fieldLabel('tickets', 'resolution')} value={record.fields.resolution} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('tickets', 'sla_breached')} value={record.fields.sla_breached} format="bool" />
        <RecordField label={fieldLabel('tickets', 'customer_satisfaction')} value={record.fields.customer_satisfaction} format="pill" />
        <RecordField label={fieldLabel('tickets', 'attachment')} className="md:col-span-2">
          {record.fields.attachment ? (
            <MediaThumbnail src={record.fields.attachment as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('tickets', 'internal_note')} value={record.fields.internal_note} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('tickets', 'assigned_agent')}
          name={assigned_agentTarget?.fields.first_name ?? '—'}
          meta={[assigned_agentTarget?.fields.email, assigned_agentTarget?.fields.phone].filter(Boolean).join(' · ') || undefined}
          onClick={assigned_agentTarget && onOpenMitarbeitende ? () => onOpenMitarbeitende!(assigned_agentTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('tickets', 'team')}
          name={teamTarget?.fields.name ?? '—'}
          meta={[teamTarget?.fields.cost_center].filter(Boolean).join(' · ') || undefined}
          onClick={teamTarget && onOpenTeams ? () => onOpenTeams!(teamTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('tickets', 'parent_ticket')}
          name={parent_ticketTarget?.fields.title ?? '—'}
          meta={[parent_ticketTarget?.fields.reporter_email, parent_ticketTarget?.fields.reporter_phone].filter(Boolean).join(' · ') || undefined}
          onClick={parent_ticketTarget && onOpenTickets ? () => onOpenTickets!(parent_ticketTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('tickets', 'affected_asset')}
          name={affected_assetTarget?.fields.name ?? '—'}
          meta={[affected_assetTarget?.fields.serial_number].filter(Boolean).join(' · ') || undefined}
          onClick={affected_assetTarget && onOpenAssets ? () => onOpenAssets!(affected_assetTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('notizen')}
        items={notizenList.filter(r => extractRecordId(r.fields.ticket) === record.record_id)}
        map={r => ({ name: r.fields.author ?? appLabel('notizen'), meta: undefined })}
        onOpen={onOpenNotizen}
        onAdd={onAddNotizen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TICKETS} recordId={record.record_id} />
    </>
  );
}
