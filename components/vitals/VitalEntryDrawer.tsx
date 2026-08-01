"use client";

import { App, Button, Drawer, Flex, Form, InputNumber, Popconfirm, Space, TimePicker } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { VITAL_CONFIG } from "../../lib/timeline/config";
import {
  TIME_ERROR_MESSAGES,
  timestampFromClockParts,
  validateTimelineTime,
} from "../../lib/timeline/timeValidation";
import { useCaseStore } from "../../store/anesthesiaCaseStore";
import type { EntryDraft } from "./timelineTypes";
import type { ScalarKind } from "../../types/vitals";

interface Props {
  draft: EntryDraft | null;
  onClose: () => void;
}

function scalarTitle(mode: string, kind: ScalarKind): string {
  const label = VITAL_CONFIG[kind].label;
  return mode === "create-scalar" ? `${label} dokumentieren` : `${label} bearbeiten`;
}

export function VitalEntryDrawer({ draft, onClose }: Props) {
  const { message } = App.useApp();
  const addMeasurement = useCaseStore((s) => s.addMeasurement);
  const updateScalar = useCaseStore((s) => s.updateScalar);
  const updateNibp = useCaseStore((s) => s.updateNibp);
  const removeMeasurement = useCaseStore((s) => s.removeMeasurement);
  const startedAt = useCaseStore((s) => s.startedAt);
  const endedAt = useCaseStore((s) => s.endedAt);

  const open = draft !== null;
  const isNibp = draft?.mode === "create-nibp" || draft?.mode === "edit-nibp";
  const isEdit = draft?.mode === "edit-scalar" || draft?.mode === "edit-nibp";
  const draftKey = draft
    ? `${draft.mode}-${"id" in draft ? draft.id : draft.time}`
    : "none";

  const handleDelete = () => {
    if (draft && "id" in draft) {
      removeMeasurement(draft.id);
      message.success("Wert gelöscht.");
      onClose();
    }
  };

  const title = draft
    ? isNibp
      ? draft.mode === "create-nibp"
        ? "Blutdruck dokumentieren"
        : "Blutdruck bearbeiten"
      : scalarTitle(draft.mode, (draft as { kind: ScalarKind }).kind)
    : "";

  return (
    <Drawer
      title={title}
      placement="bottom"
      size="large"
      open={open}
      onClose={onClose}
      destroyOnHidden
      rootClassName="vital-entry-drawer"
    >
      {draft ? (
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          {!isNibp ? (
            <ScalarForm
              key={draftKey}
              draft={draft as Extract<EntryDraft, { kind: ScalarKind }>}
              onCancel={onClose}
              startedAt={startedAt}
              endedAt={endedAt}
              onSubmit={(time, value) => {
                if (draft.mode === "create-scalar") {
                  addMeasurement({ kind: draft.kind, time, value });
                } else if (draft.mode === "edit-scalar") {
                  updateScalar(draft.id, time, value);
                }
                onClose();
              }}
            />
          ) : (
            <NibpForm
              key={draftKey}
              onCancel={onClose}
              initial={
                draft.mode === "edit-nibp"
                  ? { systolic: draft.systolic, mean: draft.mean, diastolic: draft.diastolic }
                  : { systolic: null, mean: draft.mean, diastolic: null }
              }
              time={draft.time}
              startedAt={startedAt}
              endedAt={endedAt}
              onSubmit={(time, v) => {
                if (draft.mode === "create-nibp") {
                  addMeasurement({ kind: "nibp", time, ...v });
                } else if (draft.mode === "edit-nibp") {
                  updateNibp(draft.id, time, v.systolic, v.mean, v.diastolic);
                }
                onClose();
              }}
            />
          )}

          {isEdit ? (
            <Flex justify="flex-start" style={{ marginTop: 4 }}>
              <Popconfirm
                title="Wert löschen?"
                description="Dieser Eintrag wird dauerhaft entfernt."
                okText="Löschen"
                cancelText="Abbrechen"
                okButtonProps={{ danger: true }}
                onConfirm={handleDelete}
              >
                <Button type="text" danger data-testid="entry-delete">
                  Wert löschen
                </Button>
              </Popconfirm>
            </Flex>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

function ScalarForm({
  draft,
  onSubmit,
  onCancel,
  startedAt,
  endedAt,
}: {
  draft: Extract<EntryDraft, { kind: ScalarKind }>;
  onSubmit: (time: number, value: number) => void;
  onCancel: () => void;
  startedAt: number | null;
  endedAt: number | null;
}) {
  const c = VITAL_CONFIG[draft.kind];
  const [form] = Form.useForm<{ value: number; time: Dayjs }>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ value: draft.value, time: dayjs(draft.time) }}
      onFinish={(values) => {
        if (startedAt === null) return;
        onSubmit(clockToTimestamp(startedAt, values.time, draft.time), values.value);
      }}
    >
      <TimeField startedAt={startedAt} endedAt={endedAt} originalTime={draft.time} />
      <Form.Item
        label={`${c.label} (${c.unit})`}
        name="value"
        rules={[{ required: true, message: "Bitte einen Wert eingeben." }]}
      >
        <InputNumber
          data-testid="entry-value"
          min={c.min}
          max={c.max}
          step={c.step}
          precision={c.precision}
          decimalSeparator={c.precision > 0 ? "," : undefined}
          suffix={c.unit}
          style={{ width: "100%" }}
          autoFocus
        />
      </Form.Item>
      <FormActions onCancel={onCancel} />
    </Form>
  );
}

function NibpForm({
  initial,
  time,
  startedAt,
  endedAt,
  onSubmit,
  onCancel,
}: {
  initial: { systolic: number | null; mean: number | null; diastolic: number | null };
  time: number;
  startedAt: number | null;
  endedAt: number | null;
  onSubmit: (time: number, v: { systolic: number; mean: number; diastolic: number }) => void;
  onCancel: () => void;
}) {
  const c = VITAL_CONFIG.nibp;
  const [form] = Form.useForm<{ systolic: number; mean: number; diastolic: number; time: Dayjs }>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ ...initial, time: dayjs(time) }}
      onFinish={(values) => {
        if (startedAt === null) return;
        onSubmit(clockToTimestamp(startedAt, values.time, time), values);
      }}
    >
      <TimeField startedAt={startedAt} endedAt={endedAt} originalTime={time} />
      <Space orientation="horizontal" size={12} style={{ display: "flex" }} wrap>
        <Form.Item
          label="Systolisch"
          name="systolic"
          rules={[{ required: true, message: "Pflichtfeld" }]}
        >
          <InputNumber data-testid="entry-systolic" min={c.min} max={c.max} step={1} suffix={c.unit} />
        </Form.Item>
        <Form.Item label="Mittel" name="mean" rules={[{ required: true, message: "Pflichtfeld" }]}>
          <InputNumber data-testid="entry-mean" min={c.min} max={c.max} step={1} suffix={c.unit} />
        </Form.Item>
        <Form.Item
          label="Diastolisch"
          name="diastolic"
          rules={[{ required: true, message: "Pflichtfeld" }]}
        >
          <InputNumber data-testid="entry-diastolic" min={c.min} max={c.max} step={1} suffix={c.unit} />
        </Form.Item>
      </Space>
      <FormActions onCancel={onCancel} />
    </Form>
  );
}

function clockToTimestamp(startedAt: number, value: Dayjs, originalTime: number): number {
  const original = new Date(originalTime);
  if (
    value.hour() === original.getHours() &&
    value.minute() === original.getMinutes() &&
    value.second() === original.getSeconds()
  ) return originalTime;
  return timestampFromClockParts(startedAt, value.hour(), value.minute(), value.second());
}

function TimeField({
  startedAt,
  endedAt,
  originalTime,
}: {
  startedAt: number | null;
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
            if (!value || startedAt === null) return Promise.resolve();
            const timestamp = clockToTimestamp(startedAt, value, originalTime);
            const error = validateTimelineTime(timestamp, startedAt, Date.now(), endedAt);
            return error
              ? Promise.reject(new Error(TIME_ERROR_MESSAGES[error]))
              : Promise.resolve();
          },
        },
      ]}
    >
      <TimePicker
        format="HH:mm:ss"
        needConfirm={false}
        data-testid="entry-time"
        style={{ width: "100%" }}
      />
    </Form.Item>
  );
}

function FormActions({ onCancel }: { onCancel: () => void }) {
  return (
    <Flex gap={12} style={{ marginTop: 4 }}>
      <Button type="primary" htmlType="submit" data-testid="entry-save">
        Speichern
      </Button>
      <Button onClick={onCancel} data-testid="entry-cancel">
        Abbrechen
      </Button>
    </Flex>
  );
}
