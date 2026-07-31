"use client";

import { useState } from "react";
import { App, Button, Modal, Typography } from "antd";
import { TEXT } from "../lib/constants";
import { clearPatientData } from "../lib/patient-storage";

/**
 * Zurueckhaltende Aktion "Alle Angaben entfernen" mit Bestaetigungsdialog.
 * Die Daten werden ausschliesslich nach ausdruecklicher Bestaetigung geloescht.
 */
export function RemoveAllData({ onRemoved }: { onRemoved: () => void }) {
  const [open, setOpen] = useState(false);
  const { message } = App.useApp();

  const handleConfirm = () => {
    clearPatientData();
    onRemoved();
    setOpen(false);
    message.success(TEXT.removedSuccess);
  };

  return (
    <div className="danger-zone">
      <Button
        type="text"
        className="remove-all-button"
        data-testid="remove-all"
        onClick={() => setOpen(true)}
      >
        {TEXT.removeButton}
      </Button>
      <Modal
        open={open}
        title={TEXT.removeConfirmTitle}
        okText={TEXT.removeConfirmOk}
        cancelText={TEXT.removeConfirmCancel}
        okButtonProps={{ danger: true }}
        onOk={handleConfirm}
        onCancel={() => setOpen(false)}
        centered
        destroyOnHidden
      >
        <Typography.Paragraph>{TEXT.removeConfirmBody}</Typography.Paragraph>
      </Modal>
    </div>
  );
}
