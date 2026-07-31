"use client";

import { App, Button, Drawer, Flex, Form, InputNumber, Popconfirm, Space, Typography } from "antd";
import { VITAL_CONFIG } from "../../lib/timeline/config";
import { formatClock } from "../../lib/timeline/format";
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
      height="auto"
      open={open}
      onClose={onClose}
      destroyOnHidden
      rootClassName="vital-entry-drawer"
    >
      {draft ? (
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Zeit: <span data-testid="entry-time">{formatClock(draft.time)}</span>
          </Typography.Paragraph>

          {!isNibp ? (
            <ScalarForm
              key={draftKey}
              draft={draft as Extract<EntryDraft, { kind: ScalarKind }>}
              onCancel={onClose}
              onSubmit={(value) => {
                if (draft.mode === "create-scalar") {
                  addMeasurement({ kind: draft.kind, time: draft.time, value });
                } else if (draft.mode === "edit-scalar") {
                  updateScalar(draft.id, draft.time, value);
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
                  : { systolic: null, mean: null, diastolic: null }
              }
              onSubmit={(v) => {
                if (draft.mode === "create-nibp") {
                  addMeasurement({ kind: "nibp", time: draft.time, ...v });
                } else if (draft.mode === "edit-nibp") {
                  updateNibp(draft.id, draft.time, v.systolic, v.mean, v.diastolic);
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
}: {
  draft: Extract<EntryDraft, { kind: ScalarKind }>;
  onSubmit: (value: number) => void;
  onCancel: () => void;
}) {
  const c = VITAL_CONFIG[draft.kind];
  const [form] = Form.useForm<{ value: number }>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ value: draft.value }}
      onFinish={(values) => onSubmit(values.value)}
    >
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
          addonAfter={c.unit}
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
  onSubmit,
  onCancel,
}: {
  initial: { systolic: number | null; mean: number | null; diastolic: number | null };
  onSubmit: (v: { systolic: number; mean: number; diastolic: number }) => void;
  onCancel: () => void;
}) {
  const c = VITAL_CONFIG.nibp;
  const [form] = Form.useForm<{ systolic: number; mean: number; diastolic: number }>();

  return (
    <Form form={form} layout="vertical" initialValues={initial} onFinish={(v) => onSubmit(v)}>
      <Space direction="horizontal" size={12} style={{ display: "flex" }} wrap>
        <Form.Item
          label="Systolisch"
          name="systolic"
          rules={[{ required: true, message: "Pflichtfeld" }]}
        >
          <InputNumber data-testid="entry-systolic" min={c.min} max={c.max} step={1} addonAfter={c.unit} />
        </Form.Item>
        <Form.Item label="Mittel" name="mean" rules={[{ required: true, message: "Pflichtfeld" }]}>
          <InputNumber data-testid="entry-mean" min={c.min} max={c.max} step={1} addonAfter={c.unit} />
        </Form.Item>
        <Form.Item
          label="Diastolisch"
          name="diastolic"
          rules={[{ required: true, message: "Pflichtfeld" }]}
        >
          <InputNumber data-testid="entry-diastolic" min={c.min} max={c.max} step={1} addonAfter={c.unit} />
        </Form.Item>
      </Space>
      <FormActions onCancel={onCancel} />
    </Form>
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
