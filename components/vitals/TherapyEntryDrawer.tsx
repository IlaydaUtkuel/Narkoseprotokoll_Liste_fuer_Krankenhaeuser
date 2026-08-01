"use client";

import { App, Button, Drawer, Flex, Form, Input, InputNumber, Popconfirm, Radio, Select, Switch, TimePicker } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { eventDefinition, TIMELINE_EVENT_DEFINITIONS } from "../../lib/timeline/events";
import {
  TIME_ERROR_MESSAGES,
  timestampFromClockParts,
  validateTimelineTime,
} from "../../lib/timeline/timeValidation";
import { useCaseStore, type NewInfusion, type NewMedication } from "../../store/anesthesiaCaseStore";
import type { MedicationAdministrationType, TimelineEventType } from "../../types/vitals";
import type { TherapyDraft } from "./timelineTypes";

interface Props {
  draft: TherapyDraft | null;
  onClose: () => void;
}

type MedicationValues = {
  administrationType: MedicationAdministrationType;
  name: string;
  time: Dayjs;
  dose: number;
  unit: string;
  durationMinutes?: number;
  endTime?: Dayjs;
  ongoing: boolean;
};

type InfusionValues = {
  name: string;
  time: Dayjs;
  amount: number;
  unit: string;
  durationMinutes?: number;
  endTime?: Dayjs;
  ongoing: boolean;
};

export function TherapyEntryDrawer({ draft, onClose }: Props) {
  const { message } = App.useApp();
  const startedAt = useCaseStore((state) => state.startedAt);
  const endedAt = useCaseStore((state) => state.endedAt);
  const addMedication = useCaseStore((state) => state.addMedication);
  const updateMedication = useCaseStore((state) => state.updateMedication);
  const removeMedication = useCaseStore((state) => state.removeMedication);
  const addInfusion = useCaseStore((state) => state.addInfusion);
  const updateInfusion = useCaseStore((state) => state.updateInfusion);
  const removeInfusion = useCaseStore((state) => state.removeInfusion);
  const upsertEvent = useCaseStore((state) => state.upsertEvent);
  const updateEvent = useCaseStore((state) => state.updateEvent);
  const removeEvent = useCaseStore((state) => state.removeEvent);

  const closeWithSuccess = (text: string) => {
    message.success(text);
    onClose();
  };

  const title = draftTitle(draft);

  return (
    <Drawer
      title={title}
      placement="bottom"
      size="large"
      open={draft !== null}
      destroyOnHidden
      onClose={onClose}
      rootClassName="therapy-entry-drawer"
    >
      {draft && startedAt !== null ? (
        <div className="therapy-form-shell">
          {draft.mode === "create-medication" || draft.mode === "edit-medication" ? (
            <MedicationForm
              key={draft.mode === "edit-medication" ? draft.entry.id : draft.startTime}
              startedAt={startedAt}
              endedAt={endedAt}
              draft={draft}
              onCancel={onClose}
              onDelete={
                draft.mode === "edit-medication"
                  ? () => {
                      removeMedication(draft.entry.id);
                      closeWithSuccess("Medikament entfernt.");
                    }
                  : undefined
              }
              onSubmit={(entry) => {
                if (draft.mode === "edit-medication") updateMedication(draft.entry.id, entry);
                else addMedication(entry);
                closeWithSuccess("Medikament gespeichert.");
              }}
            />
          ) : null}
          {draft.mode === "create-infusion" || draft.mode === "edit-infusion" ? (
            <InfusionForm
              key={draft.mode === "edit-infusion" ? draft.entry.id : draft.startTime}
              startedAt={startedAt}
              endedAt={endedAt}
              draft={draft}
              onCancel={onClose}
              onDelete={
                draft.mode === "edit-infusion"
                  ? () => {
                      removeInfusion(draft.entry.id);
                      closeWithSuccess("Infusion entfernt.");
                    }
                  : undefined
              }
              onSubmit={(entry) => {
                if (draft.mode === "edit-infusion") updateInfusion(draft.entry.id, entry);
                else addInfusion(entry);
                closeWithSuccess("Infusion gespeichert.");
              }}
            />
          ) : null}
          {draft.mode === "create-event" || draft.mode === "edit-event" ? (
            <EventForm
              key={draft.mode === "edit-event" ? draft.entry.id : draft.eventType}
              startedAt={startedAt}
              endedAt={endedAt}
              draft={draft}
              onCancel={onClose}
              onDelete={
                draft.mode === "edit-event"
                  ? () => {
                      removeEvent(draft.entry.id);
                      closeWithSuccess("Ereignis entfernt.");
                    }
                  : undefined
              }
              onSubmit={(eventType, time) => {
                if (draft.mode === "edit-event") updateEvent(draft.entry.id, eventType, time);
                else upsertEvent(eventType, time);
                closeWithSuccess("Ereignis gespeichert.");
              }}
            />
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

function MedicationForm({
  draft,
  startedAt,
  endedAt,
  onSubmit,
  onCancel,
  onDelete,
}: {
  draft: Extract<TherapyDraft, { mode: "create-medication" | "edit-medication" }>;
  startedAt: number;
  endedAt: number | null;
  onSubmit: (entry: NewMedication) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const existing = draft.mode === "edit-medication" ? draft.entry : null;
  const initialTime = existing?.startTime ?? (draft as Extract<TherapyDraft, { mode: "create-medication" }>).startTime;
  const [form] = Form.useForm<MedicationValues>();
  return (
    <Form<MedicationValues>
      form={form}
      layout="vertical"
      initialValues={{
        administrationType: existing?.administrationType ?? "bolus",
        name: existing?.name ?? "",
        time: dayjs(initialTime),
        dose: existing?.dose,
        unit: existing?.unit ?? "",
        durationMinutes: existing?.durationMinutes ?? undefined,
        endTime: existing?.endTime ? dayjs(existing.endTime) : undefined,
        ongoing: existing?.ongoing ?? false,
      }}
      onFinish={(values) => {
        const startTime = clockToTimestamp(startedAt, values.time, initialTime);
        const endTime = values.endTime ? clockToTimestamp(startedAt, values.endTime) : null;
        if (endTime !== null && endTime <= startTime) return;
        onSubmit({
          administrationType: values.administrationType,
          name: values.name.trim(),
          startTime,
          dose: values.dose,
          unit: values.unit.trim(),
          durationMinutes: values.durationMinutes ?? null,
          endTime,
          ongoing: values.administrationType === "continuous" && values.ongoing,
        });
      }}
    >
      <Form.Item label="Art der Gabe" name="administrationType" rules={[{ required: true }]}>
        <Radio.Group
          options={[
            { label: "Bolus", value: "bolus" },
            { label: "Kontinuierliche Gabe", value: "continuous" },
          ]}
          optionType="button"
        />
      </Form.Item>
      <Form.Item label="Medikament" name="name" rules={[{ required: true, whitespace: true, message: "Bitte ein Medikament eingeben." }]}>
        <Input autoFocus data-testid="medication-name" />
      </Form.Item>
      <TimelineTimeField startedAt={startedAt} endedAt={endedAt} originalTime={initialTime} />
      <Flex gap={12} wrap>
        <Form.Item label="Dosis / Rate" name="dose" rules={[{ required: true, message: "Bitte Dosis oder Rate eingeben." }]}>
          <InputNumber min={0} data-testid="medication-dose" />
        </Form.Item>
        <Form.Item label="Einheit" name="unit" rules={[{ required: true, whitespace: true, message: "Bitte eine Einheit eingeben." }]}>
          <Input data-testid="medication-unit" />
        </Form.Item>
        <Form.Item label="Dauer (Minuten)" name="durationMinutes" rules={[{ type: "number", min: 0.01, message: "Die Dauer muss größer als 0 sein." }]}>
          <InputNumber min={0.01} data-testid="medication-duration" />
        </Form.Item>
        <Form.Item label="Ende" name="endTime" dependencies={["time"]} rules={[endAfterEntryStartRule(startedAt, initialTime, () => form.getFieldValue("time"))]}>
          <TimePicker format="HH:mm:ss" needConfirm={false} data-testid="medication-end-time" />
        </Form.Item>
      </Flex>
      <Form.Item
        label="Läuft weiter"
        name="ongoing"
        valuePropName="checked"
        dependencies={["administrationType", "durationMinutes", "endTime"]}
        rules={[{
          validator: (_, ongoing: boolean) => {
            if (
              form.getFieldValue("administrationType") === "continuous" &&
              !ongoing &&
              !form.getFieldValue("durationMinutes") &&
              !form.getFieldValue("endTime")
            ) return Promise.reject(new Error("Für eine kontinuierliche Gabe Dauer, Ende oder laufenden Status angeben."));
            return Promise.resolve();
          },
        }]}
      >
        <Switch data-testid="medication-ongoing" />
      </Form.Item>
      <FormActions onCancel={onCancel} onDelete={onDelete} deleteLabel="Medikament entfernen" />
    </Form>
  );
}

function InfusionForm({
  draft,
  startedAt,
  endedAt,
  onSubmit,
  onCancel,
  onDelete,
}: {
  draft: Extract<TherapyDraft, { mode: "create-infusion" | "edit-infusion" }>;
  startedAt: number;
  endedAt: number | null;
  onSubmit: (entry: NewInfusion) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const existing = draft.mode === "edit-infusion" ? draft.entry : null;
  const initialTime = existing?.startTime ?? (draft as Extract<TherapyDraft, { mode: "create-infusion" }>).startTime;
  const [form] = Form.useForm<InfusionValues>();
  return (
    <Form<InfusionValues>
      form={form}
      layout="vertical"
      initialValues={{
        name: existing?.name ?? "",
        time: dayjs(initialTime),
        amount: existing?.amount,
        unit: existing?.unit ?? "",
        durationMinutes: existing?.durationMinutes ?? undefined,
        endTime: existing?.endTime ? dayjs(existing.endTime) : undefined,
        ongoing: existing?.ongoing ?? false,
      }}
      onFinish={(values) => {
        const startTime = clockToTimestamp(startedAt, values.time, initialTime);
        const endTime = values.endTime ? clockToTimestamp(startedAt, values.endTime) : null;
        if (endTime !== null && endTime <= startTime) return;
        onSubmit({
          name: values.name.trim(),
          startTime,
          amount: values.amount,
          unit: values.unit.trim(),
          durationMinutes: values.durationMinutes ?? null,
          endTime,
          ongoing: values.ongoing,
        });
      }}
    >
      <Form.Item label="Flüssigkeit / Infusion" name="name" rules={[{ required: true, whitespace: true, message: "Bitte eine Infusion eingeben." }]}>
        <Input autoFocus data-testid="infusion-name" />
      </Form.Item>
      <TimelineTimeField startedAt={startedAt} endedAt={endedAt} originalTime={initialTime} />
      <Flex gap={12} wrap>
        <Form.Item label="Menge oder Dosis" name="amount" rules={[{ required: true, message: "Bitte Menge oder Dosis eingeben." }]}>
          <InputNumber min={0} data-testid="infusion-amount" />
        </Form.Item>
        <Form.Item label="Einheit" name="unit" rules={[{ required: true, whitespace: true, message: "Bitte eine Einheit eingeben." }]}>
          <Input data-testid="infusion-unit" />
        </Form.Item>
        <Form.Item label="Dauer (Minuten)" name="durationMinutes" rules={[{ type: "number", min: 0.01, message: "Die Dauer muss größer als 0 sein." }]}>
          <InputNumber min={0.01} data-testid="infusion-duration" />
        </Form.Item>
        <Form.Item label="Ende" name="endTime" dependencies={["time"]} rules={[endAfterEntryStartRule(startedAt, initialTime, () => form.getFieldValue("time"))]}>
          <TimePicker format="HH:mm:ss" needConfirm={false} data-testid="infusion-end-time" />
        </Form.Item>
      </Flex>
      <Form.Item label="Läuft weiter" name="ongoing" valuePropName="checked">
        <Switch data-testid="infusion-ongoing" />
      </Form.Item>
      <FormActions onCancel={onCancel} onDelete={onDelete} deleteLabel="Infusion entfernen" />
    </Form>
  );
}

function EventForm({
  draft,
  startedAt,
  endedAt,
  onSubmit,
  onCancel,
  onDelete,
}: {
  draft: Extract<TherapyDraft, { mode: "create-event" | "edit-event" }>;
  startedAt: number;
  endedAt: number | null;
  onSubmit: (eventType: TimelineEventType, time: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const eventType = draft.mode === "edit-event" ? draft.entry.eventType : draft.eventType;
  const time = draft.mode === "edit-event" ? draft.entry.time : draft.time;
  return (
    <Form<{ eventType: TimelineEventType; time: Dayjs }>
      layout="vertical"
      initialValues={{ eventType, time: dayjs(time) }}
      onFinish={({ eventType: selectedType, time: value }) => onSubmit(selectedType, clockToTimestamp(startedAt, value, time))}
    >
      <Form.Item label="Ereignis" name="eventType" rules={[{ required: true }]}>
        <Select
          data-testid="event-type"
          options={TIMELINE_EVENT_DEFINITIONS.map((definition) => ({
            value: definition.type,
            label: `${definition.symbol} ${definition.label}`,
          }))}
        />
      </Form.Item>
      <TimelineTimeField startedAt={startedAt} endedAt={endedAt} originalTime={time} />
      <FormActions onCancel={onCancel} onDelete={onDelete} deleteLabel="Ereignis entfernen" />
    </Form>
  );
}

function TimelineTimeField({
  startedAt,
  endedAt,
  originalTime,
}: {
  startedAt: number;
  endedAt: number | null;
  originalTime: number;
}) {
  return (
    <Form.Item
      label="Zeit"
      name="time"
      rules={[
        { required: true, message: "Bitte eine Zeit wählen." },
        {
          validator: (_, value: Dayjs | undefined) => {
            if (!value) return Promise.resolve();
            const error = validateTimelineTime(
              clockToTimestamp(startedAt, value, originalTime),
              startedAt,
              Date.now(),
              endedAt,
            );
            return error ? Promise.reject(new Error(TIME_ERROR_MESSAGES[error])) : Promise.resolve();
          },
        },
      ]}
    >
      <TimePicker format="HH:mm:ss" needConfirm={false} data-testid="therapy-time" />
    </Form.Item>
  );
}

function endAfterEntryStartRule(startedAt: number, originalTime: number, getStart: () => Dayjs | undefined) {
  return {
    validator: (_: unknown, value: Dayjs | undefined) => {
      if (!value) return Promise.resolve();
      const startValue = getStart();
      const start = startValue ? clockToTimestamp(startedAt, startValue, originalTime) : startedAt;
      const end = clockToTimestamp(startedAt, value);
      return end <= start
        ? Promise.reject(new Error("Das Ende muss nach dem Beginn liegen."))
        : Promise.resolve();
    },
  };
}

function FormActions({ onCancel, onDelete, deleteLabel }: { onCancel: () => void; onDelete?: () => void; deleteLabel: string }) {
  return (
    <Flex justify="space-between" gap={12} wrap>
      <Flex gap={8}>
        <Button type="primary" htmlType="submit" data-testid="therapy-save">Speichern</Button>
        <Button onClick={onCancel}>Abbrechen</Button>
      </Flex>
      {onDelete ? (
        <Popconfirm title={`${deleteLabel}?`} okText="Entfernen" cancelText="Abbrechen" onConfirm={onDelete}>
          <Button danger data-testid="therapy-delete">Entfernen</Button>
        </Popconfirm>
      ) : null}
    </Flex>
  );
}

function clockToTimestamp(startedAt: number, value: Dayjs, originalTime?: number): number {
  if (originalTime !== undefined) {
    const original = new Date(originalTime);
    if (
      value.hour() === original.getHours() &&
      value.minute() === original.getMinutes() &&
      value.second() === original.getSeconds()
    ) return originalTime;
  }
  return timestampFromClockParts(startedAt, value.hour(), value.minute(), value.second());
}

function draftTitle(draft: TherapyDraft | null): string {
  if (!draft) return "";
  switch (draft.mode) {
    case "create-medication": return "Medikament hinzufügen";
    case "edit-medication": return "Medikament bearbeiten";
    case "create-infusion": return "Infusion hinzufügen";
    case "edit-infusion": return "Infusion bearbeiten";
    case "create-event": return `${eventDefinition(draft.eventType).label} dokumentieren`;
    case "edit-event": return `${eventDefinition(draft.entry.eventType).label} bearbeiten`;
  }
}
