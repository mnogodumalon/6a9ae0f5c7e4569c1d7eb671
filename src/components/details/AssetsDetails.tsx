import type { Assets, Tickets } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MapRouteLinks } from '@/components/widgets/MapWidget';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface AssetsDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Assets;
  /** 1:N „Tickets" (affected_asset): VOLLE Liste — der Block filtert auf diesen Record. */
  ticketsList: Tickets[];
  /** Zeilen-Klick → overlay.push auf das Tickets-Detail (nie der Edit-Dialog). */
  onOpenTickets: (record: Tickets) => void;
  /** Kontextuelles „+": öffnet den Tickets-Dialog mit diesem Record vorgesetzt. */
  onAddTickets: () => void;
}

export function AssetsDetails({
  record,
  ticketsList,
  onOpenTickets,
  onAddTickets,
}: AssetsDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('assets', 'name')} value={record.fields.name} format="text" />
        <RecordField label={fieldLabel('assets', 'serial_number')} value={record.fields.serial_number} format="text" />
        <RecordField label={fieldLabel('assets', 'location')}>
          {record.fields.location ? (
            <div className="space-y-1">
              <div>{record.fields.location.info ?? `${record.fields.location.lat}, ${record.fields.location.long}`}</div>
              {/* Directions links — the map popup is hover-fleeting; the overlay
                  is the only mobile-reachable place for navigation. */}
              <MapRouteLinks lat={record.fields.location.lat} long={record.fields.location.long} />
            </div>
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('assets', 'purchased_on')} value={record.fields.purchased_on} format="date" />
        <RecordField label={fieldLabel('assets', 'warranty_until')} value={record.fields.warranty_until} format="date" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('tickets')}
        items={ticketsList.filter(r => extractRecordId(r.fields.affected_asset) === record.record_id)}
        map={r => ({ name: r.fields.title ?? appLabel('tickets'), meta: r.fields.due })}
        onOpen={onOpenTickets}
        onAdd={onAddTickets}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.ASSETS} recordId={record.record_id} />
    </>
  );
}
