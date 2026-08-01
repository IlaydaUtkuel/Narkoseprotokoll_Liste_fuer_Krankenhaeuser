"use client";

import { useState } from "react";
import { Button, Flex, Form, Modal, Popconfirm, TimePicker, Typography } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { formatClock } from "../../lib/timeline/format";
import { timestampFromClockParts } from "../../lib/timeline/timeValidation";
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
