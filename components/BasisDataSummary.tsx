import { Descriptions, Typography } from "antd";
import type { PatientBaseData } from "../types/patient";

export function BasisDataSummary({ data, title = "Bisher mit der Dokumentation verknüpfte Basisdaten" }: { data: PatientBaseData; title?: string }) {
  const present = (value: unknown) => value === null || value === undefined || value === "" ? "Nicht angegeben" : String(value);
  return (
    <div className="basis-summary" data-testid="basis-existing-summary">
      <Typography.Title level={5}>{title}</Typography.Title>
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Patient/-in">{present(data.patientName)}</Descriptions.Item>
        <Descriptions.Item label="Geburtsdatum">{present(data.birthDate)}</Descriptions.Item>
        <Descriptions.Item label="OP-Datum">{present(data.operationDate)}</Descriptions.Item>
        <Descriptions.Item label="Eingriff">{present(data.procedure)}</Descriptions.Item>
        <Descriptions.Item label="Körpergewicht">{data.bodyWeightKg === null ? "Nicht angegeben" : `${data.bodyWeightKg} ${data.weightUnit}`}</Descriptions.Item>
        <Descriptions.Item label="ASA-Klasse">{present(data.asaClass)}</Descriptions.Item>
        <Descriptions.Item label="Mallampati-Klasse">{present(data.mallampatiClass)}</Descriptions.Item>
        <Descriptions.Item label="Allergien">{data.noKnownAllergies ? "Keine bekannt" : present(data.allergies)}</Descriptions.Item>
      </Descriptions>
    </div>
  );
}
