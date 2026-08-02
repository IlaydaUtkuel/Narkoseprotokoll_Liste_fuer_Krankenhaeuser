"use client";

import {
  App,
  Button,
  DatePicker,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Select,
  TimePicker,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { eventDefinition, TIMELINE_EVENT_DEFINITIONS } from "../../lib/timeline/events";
import {
  endFromDuration,
  durationMinutesBetween,
  formatLocalDateTime,
  isNextLocalDay,
  resolveEndFromClock,
} from "../../lib/timeline/therapyTime";
import {
  CONCENTRATION_UNITS,
  CUSTOM_UNIT_VALUE,
  createTherapyUnit,
  therapyUnitOptions,
} from "../../lib/timeline/therapyUnits";
import {
  TIME_ERROR_MESSAGES,
  validateTimelineTime,
} from "../../lib/timeline/timeValidation";
import { useCaseStore, type NewInfusion, type NewMedication } from "../../store/anesthesiaCaseStore";
import type {
  MedicationAdministrationType,
  TherapyConcentration,
  TherapyEndMode,
  TimelineEventType,
} from "../../types/vitals";
import type { TherapyDraft } from "./timelineTypes";

interface Props {
  draft: TherapyDraft | null;
  onClose: () => void;
}

interface CommonTherapyValues {
  time: Dayjs;
  endMode: TherapyEndMode;
  durationMinutes?: number;
  endDate?: Dayjs;
  endClock?: Dayjs;
  unitCode: string;
  customUnit?: string;
  concentrationValue?: number;
  concentrationUnitCode?: string;
}

type MedicationValues = CommonTherapyValues & {
  administrationType: MedicationAdministrationType;
  name: string;
  dose: number;
};

type InfusionValues = CommonTherapyValues & {
  name: string;
  amount: number;
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

  return (
    <Drawer
      title={draftTitle(draft)}
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
              key={draft.mode === "edit-medication" ? draft.entry.id : draft.startedAt}
              caseStartedAt={startedAt}
              caseEndedAt={endedAt}
              draft={draft}
              onCancel={onClose}
              onDelete={draft.mode === "edit-medication" ? () => {
                removeMedication(draft.entry.id);
                closeWithSuccess("Medikament entfernt.");
              } : undefined}
              onSubmit={(entry) => {
                if (draft.mode === "edit-medication") updateMedication(draft.entry.id, entry);
                else addMedication(entry);
                closeWithSuccess("Medikament gespeichert.");
              }}
            />
          ) : null}
          {draft.mode === "create-infusion" || draft.mode === "edit-infusion" ? (
            <InfusionForm
              key={draft.mode === "edit-infusion" ? draft.entry.id : draft.startedAt}
              caseStartedAt={startedAt}
              caseEndedAt={endedAt}
              draft={draft}
              onCancel={onClose}
              onDelete={draft.mode === "edit-infusion" ? () => {
                removeInfusion(draft.entry.id);
                closeWithSuccess("Infusion entfernt.");
              } : undefined}
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
              caseStartedAt={startedAt}
              caseEndedAt={endedAt}
              draft={draft}
              onCancel={onClose}
              onDelete={draft.mode === "edit-event"
                ? () => {
                    removeEvent(draft.entry.id);
                    closeWithSuccess("Ereignis entfernt.");
                  }
                : draft.eventType === "extra" ? onClose : undefined}
              onSubmit={(eventType, time, comment) => {
                if (draft.mode === "edit-event") updateEvent(draft.entry.id, eventType, time, comment);
                else upsertEvent(eventType, time, comment);
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
  caseStartedAt,
  caseEndedAt,
  onSubmit,
  onCancel,
  onDelete,
}: {
  draft: Extract<TherapyDraft, { mode: "create-medication" | "edit-medication" }>;
  caseStartedAt: number;
  caseEndedAt: number | null;
  onSubmit: (entry: NewMedication) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const existing = draft.mode === "edit-medication" ? draft.entry : null;
  const initialTime = existing?.startedAt ?? (draft as Extract<TherapyDraft, { mode: "create-medication" }>).startedAt;
  const [form] = Form.useForm<MedicationValues>();
  const administrationType = Form.useWatch("administrationType", form) ?? existing?.administrationType ?? "bolus";
  const unitCode = Form.useWatch("unitCode", form);
  const options = therapyUnitOptions("medication", administrationType);
  return (
    <Form<MedicationValues>
      form={form}
      layout="vertical"
      initialValues={{
        administrationType: existing?.administrationType ?? "bolus",
        name: existing?.name ?? "",
        time: dayjs(initialTime),
        dose: existing?.dose,
        unitCode: existing?.unit.isCustom ? CUSTOM_UNIT_VALUE : existing?.unit.code,
        customUnit: existing?.unit.isCustom ? existing.unit.label : undefined,
        concentrationValue: existing?.concentration?.value,
        concentrationUnitCode: existing?.concentration?.unit.code,
        endMode: existing?.ongoing ? "ongoing" : existing?.endedAt ? "end" : "duration",
        durationMinutes: existing?.endedAt ? durationMinutesBetween(existing.startedAt, existing.endedAt) : 1,
        endDate: existing?.endedAt ? dayjs(existing.endedAt) : undefined,
        endClock: existing?.endedAt ? dayjs(existing.endedAt) : undefined,
      }}
      onFinish={(values) => {
        const startedAt = clockToTimestamp(initialTime, values.time);
        const unit = createTherapyUnit(values.unitCode, values.customUnit);
        const concentration = buildConcentration(values.concentrationValue, values.concentrationUnitCode);
        const endedAt = endForValues(startedAt, values);
        if (!unit || (values.endMode !== "ongoing" && (endedAt === null || endedAt <= startedAt))) return;
        onSubmit({
          administrationType: values.administrationType,
          name: values.name.trim(),
          startedAt,
          dose: values.dose,
          unit,
          concentration,
          endedAt,
          ongoing: values.endMode === "ongoing",
        });
      }}
    >
      <Form.Item label="Art der Gabe" name="administrationType" rules={[{ required: true }]}>
        <Radio.Group
          options={[{ label: "Bolus", value: "bolus" }, { label: "Kontinuierliche Gabe", value: "continuous" }]}
          optionType="button"
          data-testid="medication-administration-type"
        />
      </Form.Item>
      <Form.Item label="Medikament" name="name" rules={[{ required: true, whitespace: true, message: "Bitte ein Medikament eingeben." }]}>
        <Input autoFocus data-testid="medication-name" />
      </Form.Item>
      <TimelineTimeField caseStartedAt={caseStartedAt} caseEndedAt={caseEndedAt} originalTime={initialTime} />
      <Flex gap={12} wrap>
        <Form.Item label="Dosis / Rate" name="dose" rules={[{ required: true, message: "Bitte Dosis oder Rate eingeben." }]}>
          <InputNumber min={0} data-testid="medication-dose" />
        </Form.Item>
        <UnitField kind="medication" options={options} selectedCode={unitCode} />
      </Flex>
      <ConcentrationFields />
      <TherapyEndFields initialTime={initialTime} showStopAction={existing?.ongoing === true} />
      <FormActions onCancel={onCancel} onDelete={onDelete} deleteLabel="Medikament entfernen" />
    </Form>
  );
}

function InfusionForm({
  draft,
  caseStartedAt,
  caseEndedAt,
  onSubmit,
  onCancel,
  onDelete,
}: {
  draft: Extract<TherapyDraft, { mode: "create-infusion" | "edit-infusion" }>;
  caseStartedAt: number;
  caseEndedAt: number | null;
  onSubmit: (entry: NewInfusion) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const existing = draft.mode === "edit-infusion" ? draft.entry : null;
  const initialTime = existing?.startedAt ?? (draft as Extract<TherapyDraft, { mode: "create-infusion" }>).startedAt;
  const [form] = Form.useForm<InfusionValues>();
  const unitCode = Form.useWatch("unitCode", form);
  return (
    <Form<InfusionValues>
      form={form}
      layout="vertical"
      initialValues={{
        name: existing?.name ?? "",
        time: dayjs(initialTime),
        amount: existing?.amount,
        unitCode: existing?.unit.isCustom ? CUSTOM_UNIT_VALUE : existing?.unit.code,
        customUnit: existing?.unit.isCustom ? existing.unit.label : undefined,
        concentrationValue: existing?.concentration?.value,
        concentrationUnitCode: existing?.concentration?.unit.code,
        endMode: existing?.ongoing ? "ongoing" : existing?.endedAt ? "end" : "duration",
        durationMinutes: existing?.endedAt ? durationMinutesBetween(existing.startedAt, existing.endedAt) : 1,
        endDate: existing?.endedAt ? dayjs(existing.endedAt) : undefined,
        endClock: existing?.endedAt ? dayjs(existing.endedAt) : undefined,
      }}
      onFinish={(values) => {
        const startedAt = clockToTimestamp(initialTime, values.time);
        const unit = createTherapyUnit(values.unitCode, values.customUnit);
        const concentration = buildConcentration(values.concentrationValue, values.concentrationUnitCode);
        const endedAt = endForValues(startedAt, values);
        if (!unit || (values.endMode !== "ongoing" && (endedAt === null || endedAt <= startedAt))) return;
        onSubmit({
          name: values.name.trim(),
          startedAt,
          amount: values.amount,
          unit,
          concentration,
          endedAt,
          ongoing: values.endMode === "ongoing",
        });
      }}
    >
      <Form.Item label="Flüssigkeit / Infusion" name="name" rules={[{ required: true, whitespace: true, message: "Bitte eine Infusion eingeben." }]}>
        <Input autoFocus data-testid="infusion-name" />
      </Form.Item>
      <TimelineTimeField caseStartedAt={caseStartedAt} caseEndedAt={caseEndedAt} originalTime={initialTime} />
      <Flex gap={12} wrap>
        <Form.Item label="Menge oder Rate" name="amount" rules={[{ required: true, message: "Bitte Menge oder Rate eingeben." }]}>
          <InputNumber min={0} data-testid="infusion-amount" />
        </Form.Item>
        <UnitField kind="infusion" options={therapyUnitOptions("infusion")} selectedCode={unitCode} />
      </Flex>
      <ConcentrationFields />
      <TherapyEndFields initialTime={initialTime} showStopAction={existing?.ongoing === true} />
      <FormActions onCancel={onCancel} onDelete={onDelete} deleteLabel="Infusion entfernen" />
    </Form>
  );
}

function UnitField({
  kind,
  options,
  selectedCode,
}: {
  kind: "medication" | "infusion";
  options: ReturnType<typeof therapyUnitOptions>;
  selectedCode?: string;
}) {
  const grouped = [
    { label: "Menge", options: options.filter((option) => option.category === "amount" || option.category === "weight") },
    { label: "Rate", options: options.filter((option) => option.category === "rate") },
    { label: "Anzahl", options: options.filter((option) => option.category === "count") },
    { label: "Weitere", options: options.filter((option) => option.category === "custom") },
  ].filter((group) => group.options.length > 0).map((group) => ({
    label: group.label,
    options: group.options.map((option) => ({ value: option.code, label: option.displayLabel })),
  }));
  return (
    <>
      <Form.Item label="Einheit" name="unitCode" rules={[{ required: true, message: "Bitte eine Einheit auswählen." }]}>
        <Select
          showSearch
          optionFilterProp="label"
          options={grouped}
          data-testid={`${kind}-unit`}
          style={{ minWidth: 210 }}
          placeholder="Einheit auswählen"
        />
      </Form.Item>
      {selectedCode === CUSTOM_UNIT_VALUE ? (
        <Form.Item label="Andere Einheit" name="customUnit" rules={[{ required: true, whitespace: true, message: "Bitte die andere Einheit eingeben." }]}>
          <Input data-testid={`${kind}-custom-unit`} />
        </Form.Item>
      ) : null}
    </>
  );
}

function ConcentrationFields() {
  return (
    <Flex gap={12} wrap>
      <Form.Item label="Konzentration (optional)" name="concentrationValue">
        <InputNumber min={0} data-testid="therapy-concentration-value" />
      </Form.Item>
      <Form.Item
        label="Konzentrationseinheit"
        name="concentrationUnitCode"
        dependencies={["concentrationValue"]}
        rules={[({ getFieldValue }) => ({
          validator: (_, value) => getFieldValue("concentrationValue") !== undefined && !value
            ? Promise.reject(new Error("Bitte eine Konzentrationseinheit auswählen."))
            : Promise.resolve(),
        })]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          allowClear
          data-testid="therapy-concentration-unit"
          options={CONCENTRATION_UNITS.map((option) => ({ value: option.code, label: option.displayLabel }))}
          style={{ minWidth: 170 }}
        />
      </Form.Item>
    </Flex>
  );
}

function TherapyEndFields({ initialTime, showStopAction }: { initialTime: number; showStopAction: boolean }) {
  const form = Form.useFormInstance<CommonTherapyValues>();
  const mode = Form.useWatch("endMode", form) ?? "duration";
  const time = Form.useWatch("time", form) ?? dayjs(initialTime);
  const duration = Form.useWatch("durationMinutes", form);
  const endDate = Form.useWatch("endDate", form);
  const endClock = Form.useWatch("endClock", form);
  const startedAt = clockToTimestamp(initialTime, time);
  const preview = mode === "duration" && typeof duration === "number" && duration > 0
    ? endFromDuration(startedAt, duration)
    : mode === "end" && endClock
      ? resolveEndFromClock(startedAt, clockParts(endClock), endDate ? dateParts(endDate) : null)
      : null;
  const previewDuration = preview === null ? null : durationMinutesBetween(startedAt, preview);

  return (
    <section className="therapy-end-section" aria-label="Art des Therapieendes">
      <Form.Item label="Ende festlegen" name="endMode" rules={[{ required: true }]}>
        <Radio.Group optionType="button" buttonStyle="solid" data-testid="therapy-end-mode">
          <Radio.Button value="duration">Dauer</Radio.Button>
          <Radio.Button value="end">Ende</Radio.Button>
          <Radio.Button value="ongoing">Läuft weiter</Radio.Button>
        </Radio.Group>
      </Form.Item>
      {showStopAction && mode === "ongoing" ? (
        <Button
          data-testid="therapy-stop-ongoing"
          onClick={() => {
            const now = dayjs();
            form.setFieldsValue({ endMode: "end", endDate: now, endClock: now });
          }}
        >
          Anwendung beenden
        </Button>
      ) : null}
      {mode === "duration" ? (
        <Form.Item label="Dauer (Minuten)" name="durationMinutes" rules={[{ required: true, type: "number", min: 0.01, message: "Die Dauer muss größer als 0 sein." }]}>
          <InputNumber min={0.01} data-testid="therapy-duration" />
        </Form.Item>
      ) : null}
      {mode === "end" ? (
        <Flex gap={10} wrap>
          <Form.Item label="Enddatum (optional)" name="endDate">
            <DatePicker format="DD.MM.YYYY" data-testid="therapy-end-date" />
          </Form.Item>
          <Form.Item label="Endzeit" name="endClock" rules={[{ required: true, message: "Bitte eine Endzeit wählen." }]}>
            <TimePicker format="HH:mm:ss" needConfirm={false} data-testid="therapy-end-time" />
          </Form.Item>
          <Flex gap={6} align="center">
            <Button size="small" onClick={() => form.setFieldValue("endDate", dayjs(startedAt))}>Heute</Button>
            <Button size="small" onClick={() => form.setFieldValue("endDate", dayjs(startedAt).add(1, "day"))}>Morgen</Button>
          </Flex>
        </Flex>
      ) : null}
      <div className="therapy-end-preview" data-testid="therapy-end-preview" aria-live="polite">
        {mode === "ongoing" ? "Kein festes Ende · läuft weiter" : preview !== null ? (
          <>
            Ende: {formatLocalDateTime(preview)}{isNextLocalDay(startedAt, preview) ? " (morgen)" : ""}
            {previewDuration !== null ? ` · Dauer: ${formatDuration(previewDuration)}` : ""}
            {preview <= startedAt ? <span className="therapy-end-error"> · Das Ende muss nach dem Beginn liegen.</span> : null}
          </>
        ) : "Bitte Ende oder Dauer angeben."}
      </div>
    </section>
  );
}

function EventForm({
  draft,
  caseStartedAt,
  caseEndedAt,
  onSubmit,
  onCancel,
  onDelete,
}: {
  draft: Extract<TherapyDraft, { mode: "create-event" | "edit-event" }>;
  caseStartedAt: number;
  caseEndedAt: number | null;
  onSubmit: (eventType: TimelineEventType, time: number, comment: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const eventType = draft.mode === "edit-event" ? draft.entry.eventType : draft.eventType;
  const time = draft.mode === "edit-event" ? draft.entry.time : draft.time;
  const comment = draft.mode === "edit-event" ? draft.entry.comment : "";
  const [form] = Form.useForm<{ eventType: TimelineEventType; time: Dayjs; comment: string }>();
  const selectedType = Form.useWatch("eventType", form) ?? eventType;
  return (
    <Form<{ eventType: TimelineEventType; time: Dayjs; comment: string }>
      form={form}
      layout="vertical"
      initialValues={{ eventType, time: dayjs(time), comment }}
      onFinish={({ eventType: submittedType, time: value, comment: submittedComment }) => onSubmit(submittedType, clockToTimestamp(time, value), submittedType === "extra" ? submittedComment.trim() : "")}
    >
      <Form.Item label="Ereignis" name="eventType" rules={[{ required: true }]}>
        <Select data-testid="event-type" options={TIMELINE_EVENT_DEFINITIONS.map((definition) => ({ value: definition.type, label: `${definition.symbol} ${definition.label}` }))} />
      </Form.Item>
      <TimelineTimeField caseStartedAt={caseStartedAt} caseEndedAt={caseEndedAt} originalTime={time} />
      {selectedType === "extra" ? (
        <Form.Item
          label="Kommentar"
          name="comment"
          rules={[
            { required: true, whitespace: true, message: "Bitte einen Kommentar eingeben." },
            { max: 500, message: "Der Kommentar darf höchstens 500 Zeichen enthalten." },
          ]}
        >
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            placeholder="Unerwartete Situation kurz dokumentieren"
            data-testid="event-comment"
          />
        </Form.Item>
      ) : null}
      <FormActions
        onCancel={onCancel}
        onDelete={onDelete}
        deleteLabel={eventType === "extra" ? "Extra löschen" : "Ereignis entfernen"}
        deleteButtonLabel={eventType === "extra" ? "Löschen" : "Entfernen"}
        confirmDelete={draft.mode === "edit-event"}
      />
    </Form>
  );
}

function TimelineTimeField({ caseStartedAt, caseEndedAt, originalTime }: { caseStartedAt: number; caseEndedAt: number | null; originalTime: number }) {
  return (
    <Form.Item
      label="Zeit"
      name="time"
      rules={[
        { required: true, message: "Bitte eine Zeit wählen." },
        { validator: (_, value: Dayjs | undefined) => {
          if (!value) return Promise.resolve();
          const error = validateTimelineTime(clockToTimestamp(originalTime, value), caseStartedAt, Date.now(), caseEndedAt);
          return error ? Promise.reject(new Error(TIME_ERROR_MESSAGES[error])) : Promise.resolve();
        } },
      ]}
    >
      <TimePicker format="HH:mm:ss" needConfirm={false} data-testid="therapy-time" />
    </Form.Item>
  );
}

function endForValues(startedAt: number, values: CommonTherapyValues): number | null {
  if (values.endMode === "ongoing") return null;
  if (values.endMode === "duration") {
    return typeof values.durationMinutes === "number" && values.durationMinutes > 0
      ? endFromDuration(startedAt, values.durationMinutes)
      : null;
  }
  return values.endClock
    ? resolveEndFromClock(startedAt, clockParts(values.endClock), values.endDate ? dateParts(values.endDate) : null)
    : null;
}

function buildConcentration(value?: number, code?: string): TherapyConcentration | null {
  if (value === undefined || code === undefined) return null;
  const unit = createTherapyUnit(code);
  return unit ? { value, unit } : null;
}

function clockToTimestamp(baseTime: number, value: Dayjs): number {
  const base = new Date(baseTime);
  if (value.hour() === base.getHours() && value.minute() === base.getMinutes() && value.second() === base.getSeconds()) return baseTime;
  base.setHours(value.hour(), value.minute(), value.second(), 0);
  return base.getTime();
}

function clockParts(value: Dayjs) {
  return { hour: value.hour(), minute: value.minute(), second: value.second() };
}

function dateParts(value: Dayjs) {
  return { year: value.year(), month: value.month(), day: value.date() };
}

function formatDuration(minutes: number): string {
  return Number.isInteger(minutes) ? `${minutes} Minuten` : `${minutes.toFixed(2).replace(".", ",")} Minuten`;
}

function FormActions({
  onCancel,
  onDelete,
  deleteLabel,
  deleteButtonLabel = "Entfernen",
  confirmDelete = true,
}: {
  onCancel: () => void;
  onDelete?: () => void;
  deleteLabel: string;
  deleteButtonLabel?: string;
  confirmDelete?: boolean;
}) {
  return (
    <Flex justify="space-between" gap={12} wrap>
      <Flex gap={8}>
        <Button type="primary" htmlType="submit" data-testid="therapy-save">Speichern</Button>
        <Button onClick={onCancel} data-testid="therapy-cancel">Abbrechen</Button>
      </Flex>
      {onDelete && confirmDelete ? (
        <Popconfirm title={`${deleteLabel}?`} okText={deleteButtonLabel} cancelText="Abbrechen" onConfirm={onDelete}>
          <Button danger data-testid="therapy-delete">{deleteButtonLabel}</Button>
        </Popconfirm>
      ) : onDelete ? (
        <Button danger data-testid="therapy-delete" onClick={onDelete}>{deleteButtonLabel}</Button>
      ) : null}
    </Flex>
  );
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
