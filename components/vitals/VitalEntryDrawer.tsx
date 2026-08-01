"use client";

import { App, AutoComplete, Button, Drawer, Flex, Form, InputNumber, Popconfirm, TimePicker } from "antd";
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
                  ? { mean: draft.mean, systolic: draft.systolic, diastolic: draft.diastolic }
                  : { mean: draft.mean, systolic: null, diastolic: null }
              }
              editing={draft.mode === "edit-nibp"}
              focusPart={draft.mode === "edit-nibp" ? draft.focusPart : undefined}
              time={draft.time}
              startedAt={startedAt}
              endedAt={endedAt}
              onSubmit={(time, mean, systolic, diastolic) => {
                if (draft.mode === "create-nibp") {
                  addMeasurement({ kind: "nibp", time, systolic: null, mean, diastolic: null });
                } else if (draft.mode === "edit-nibp") {
                  updateNibp(draft.id, time, systolic, mean, diastolic);
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
  const [form] = Form.useForm<{ value: number | string; time: Dayjs }>();

  return (
    <Form
      form={form}
      layout="vertical"
      onKeyDown={(event) => {
        if (draft.kind === "temperature" && event.key === "Enter") event.preventDefault();
      }}
      initialValues={{ value: draft.kind === "temperature" ? String(draft.value) : draft.value, time: dayjs(draft.time) }}
      onFinish={(values) => {
        if (startedAt === null) return;
        onSubmit(clockToTimestamp(startedAt, values.time, draft.time), Number(String(values.value).replace(",", ".")));
      }}
    >
      <TimeField startedAt={startedAt} endedAt={endedAt} originalTime={draft.time} />
      <Form.Item
        label={`${c.label} (${c.unit})`}
        name="value"
        rules={[finiteNumberRule("Bitte einen endlichen Zahlenwert eingeben.")]}
      >
        {draft.kind === "temperature" ? (
          <AutoComplete
            data-testid="entry-value"
            aria-label="Temperatur auswählen"
            options={TEMPERATURE_SUGGESTIONS}
            placeholder="Wert direkt eingeben oder auswählen"
            style={{ width: "100%" }}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        ) : (
          <InputNumber
            data-testid="entry-value"
            step={c.step}
            controls={false}
            suffix={c.unit}
            style={{ width: "100%" }}
            autoFocus
          />
        )}
      </Form.Item>
      <FormActions onCancel={onCancel} />
    </Form>
  );
}

function NibpForm({
  initial,
  editing,
  focusPart,
  time,
  startedAt,
  endedAt,
  onSubmit,
  onCancel,
}: {
  initial: { mean: number | null; systolic: number | null; diastolic: number | null };
  editing: boolean;
  focusPart?: "systolic" | "diastolic";
  time: number;
  startedAt: number | null;
  endedAt: number | null;
  onSubmit: (time: number, mean: number, systolic: number | null, diastolic: number | null) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm<{
    mean: number;
    systolic: number | null;
    diastolic: number | null;
    time: Dayjs;
  }>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ ...initial, time: dayjs(time) }}
      onFinish={(values) => {
        if (startedAt === null) return;
        onSubmit(
          clockToTimestamp(startedAt, values.time, time),
          values.mean,
          values.systolic ?? null,
          values.diastolic ?? null,
        );
      }}
    >
      <TimeField startedAt={startedAt} endedAt={endedAt} originalTime={time} />
      <div className="nibp-form-unit">Einheit: mmHg</div>
      <Form.Item
        label="Mittel"
        name="mean"
        rules={[finiteNumberRule("Bitte einen endlichen Mittelwert eingeben.")]}
      >
        <InputNumber data-testid="entry-mean" controls={false} step={1} style={{ width: "100%" }} autoFocus={!focusPart} />
      </Form.Item>
      {editing ? (
        <div className="nibp-endpoint-fields">
          <Form.Item
            label="Systolisch"
            name="systolic"
            rules={[finiteNumberRule("Bitte einen endlichen Zahlenwert eingeben.", true)]}
          >
            <InputNumber
              data-testid="entry-systolic"
              step={1}
              controls={false}
              suffix="mmHg"
              style={{ width: "100%" }}
              autoFocus={focusPart === "systolic"}
            />
          </Form.Item>
          <Form.Item
            label="Diastolisch"
            name="diastolic"
            rules={[finiteNumberRule("Bitte einen endlichen Zahlenwert eingeben.", true)]}
          >
            <InputNumber
              data-testid="entry-diastolic"
              step={1}
              controls={false}
              suffix="mmHg"
              style={{ width: "100%" }}
              autoFocus={focusPart === "diastolic"}
            />
          </Form.Item>
        </div>
      ) : null}
      <p className="nibp-form-help">
        {editing
          ? "Werte direkt eingeben oder die weißen Griffe anschließend im Diagramm ziehen."
          : "Nach dem Speichern erscheinen oberhalb und unterhalb des Mittelwerts Griffe für Systolisch und Diastolisch."}
      </p>
      <FormActions onCancel={onCancel} />
    </Form>
  );
}

function finiteNumberRule(message: string, optional = false) {
  return {
    validator: (_: unknown, value: unknown) => {
      if (optional && (value === null || value === undefined || value === "")) return Promise.resolve();
      const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.replace(",", ".")) : Number.NaN;
      return Number.isFinite(numeric)
        ? Promise.resolve()
        : Promise.reject(new Error(message));
    },
  };
}

const TEMPERATURE_SUGGESTIONS = Array.from({ length: 71 }, (_, index) => {
  const value = (34 + index / 10).toFixed(1);
  return { value, label: `${value.replace(".", ",")} °C` };
});

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
