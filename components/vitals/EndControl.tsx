"use client";

import { useState } from "react";
import { Button, Flex, Form, Modal, Popconfirm, TimePicker, Typography } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { formatClock } from "../../lib/timeline/format";
import { timestampFromClockParts } from "../../lib/timeline/timeValidation";
import { loadPatientData } from "../../lib/patient-storage";
import { useCaseStore } from "../../store/anesthesiaCaseStore";

export function EndControl() {
  const startedAt = useCaseStore((state) => state.startedAt);
  const endedAt = useCaseStore((state) => state.endedAt);
  const endCase = useCaseStore((state) => state.endCase);
  const updateEndedAt = useCaseStore((state) => state.updateEndedAt);
  const [editing, setEditing] = useState(false);

  if (endedAt !== null) {
    return (
      <>
        <Flex align="center" gap={6} className="case-ended" data-testid="case-ended">
          <span>Beendet um {formatClock(endedAt)}</span>
          <Button
            type="text"
            size="small"
            aria-label="Endzeit bearbeiten"
            data-testid="edit-end-time"
            onClick={() => setEditing(true)}
          >
            Bearbeiten
          </Button>
        </Flex>
        <Button
          type="primary"
          href="/abschluss"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="save-close-case"
        >
          Speichern und Schließen
        </Button>
        <DiscardCaseButton />
        <Modal
          title="Endzeit bearbeiten"
          open={editing}
          footer={null}
          destroyOnHidden
          onCancel={() => setEditing(false)}
        >
          <Form<{ time: Dayjs }>
            key={endedAt}
            layout="vertical"
            initialValues={{ time: dayValue(endedAt) }}
            onFinish={({ time }) => {
              if (startedAt === null) return;
              const timestamp = endTimestamp(startedAt, endedAt, time);
              if (timestamp <= startedAt) return;
              if (timestamp > Date.now()) return;
              updateEndedAt(timestamp);
              setEditing(false);
            }}
          >
            <Form.Item
              name="time"
              label="Endzeit"
              rules={[
                { required: true, message: "Bitte eine Endzeit wählen." },
                {
                  validator: (_, value: Dayjs | undefined) => {
                    if (!value || startedAt === null) return Promise.resolve();
                    const timestamp = endTimestamp(startedAt, endedAt, value);
                    if (timestamp <= startedAt) {
                      return Promise.reject(new Error("Die Endzeit muss nach der Startzeit liegen."));
                    }
                    if (timestamp > Date.now()) {
                      return Promise.reject(new Error("Die Endzeit darf nicht in der Zukunft liegen."));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <TimePicker format="HH:mm:ss" needConfirm={false} data-testid="end-time-input" />
            </Form.Item>
            <Typography.Paragraph type="secondary">
              Die Zeit muss nach dem Start und darf nicht in der Zukunft liegen.
            </Typography.Paragraph>
            <Flex gap={8}>
              <Button type="primary" htmlType="submit" data-testid="save-end-time">
                Speichern
              </Button>
              <Button onClick={() => setEditing(false)}>Abbrechen</Button>
            </Flex>
          </Form>
        </Modal>
      </>
    );
  }

  return (
    <Popconfirm
      title="Eingriff beenden?"
      description="Möchten Sie den Eingriff wirklich beenden?"
      okText="Eingriff beenden"
      cancelText="Abbrechen"
      onConfirm={endCase}
      disabled={startedAt === null}
    >
      <Button danger disabled={startedAt === null} data-testid="end-case-button">
        Eingriff beenden
      </Button>
    </Popconfirm>
  );
}

/**
 * Verwirft die gesamte OP-Dokumentation des aktuellen Falls, ohne sie zu speichern.
 * Es wird niemals sofort geloescht: zuerst erscheint eine ausdrueckliche Rueckfrage
 * mit dem Patientennamen. Abbrechen oder das X schliessen den Dialog, ohne etwas zu
 * loeschen. Die Basisdaten des Patienten bleiben erhalten.
 */
function DiscardCaseButton() {
  const resetCase = useCaseStore((state) => state.resetCase);
  const [open, setOpen] = useState(false);
  const patientName = loadPatientData()?.patientName?.trim();
  const who = patientName ? `von ${patientName}` : "dieses Falls";
  return (
    <>
      <Button className="discard-case-button" data-testid="discard-case" onClick={() => setOpen(true)}>
        Alles löschen
      </Button>
      <Modal
        title="OP-Daten wirklich löschen?"
        open={open}
        okText="Ja, endgültig löschen"
        cancelText="Abbrechen"
        okButtonProps={{ danger: true, "data-testid": "discard-case-confirm" } as never}
        cancelButtonProps={{ "data-testid": "discard-case-cancel" } as never}
        onCancel={() => setOpen(false)}
        onOk={() => {
          resetCase();
          setOpen(false);
        }}
        destroyOnHidden
      >
        <Typography.Paragraph data-testid="discard-case-text">
          Sind Sie sicher, dass Sie die OP-Daten {who} ohne Speichern endgültig löschen möchten?
          Alle dokumentierten Vitalwerte, Medikamente, Infusionen sowie Phasen und Ereignisse
          gehen dabei unwiderruflich verloren.
        </Typography.Paragraph>
      </Modal>
    </>
  );
}

function dayValue(timestamp: number): Dayjs {
  return dayjs(timestamp);
}

function endTimestamp(startedAt: number, original: number, value: Dayjs): number {
  const date = new Date(original);
  if (
    value.hour() === date.getHours() &&
    value.minute() === date.getMinutes() &&
    value.second() === date.getSeconds()
  ) return original;
  return timestampFromClockParts(startedAt, value.hour(), value.minute(), value.second());
}
