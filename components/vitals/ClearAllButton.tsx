"use client";

import { Button, Popconfirm } from "antd";
import type { FormInstance } from "antd";

/**
 * "Alles Löschen" neben dem Speichern-Button: leert ausschließlich die aktuell im
 * Formular eingegebenen Werte. Es wird nie direkt gelöscht – zuerst erscheint eine
 * ausdrückliche Rückfrage, die klar benennt, dass die Eingaben ungespeichert und
 * dauerhaft verworfen werden. Beim Bearbeiten eines bestehenden Eintrags wird
 * zusätzlich klargestellt, dass der gespeicherte Eintrag erhalten bleibt (dafür
 * gibt es den separaten Entfernen-Button).
 */
export function ClearAllButton({
  form,
  fields,
  isEdit = false,
  testId,
}: {
  form: FormInstance;
  fields: string[];
  isEdit?: boolean;
  testId: string;
}) {
  const description = isEdit
    ? "Alle Eingaben in diesem Formular werden geleert und nicht gespeichert. Der bereits gespeicherte Eintrag bleibt erhalten."
    : "Alle hier eingegebenen Angaben werden dauerhaft verworfen. Sie wurden noch nicht gespeichert.";
  return (
    <Popconfirm
      title="Alle Eingaben löschen?"
      description={description}
      okText="Alles löschen"
      cancelText="Abbrechen"
      okButtonProps={{ danger: true, "data-testid": `${testId}-confirm` } as never}
      onConfirm={() => {
        // Nur die Formulareingaben leeren – niemals gespeicherte Daten anfassen.
        form.setFieldsValue(Object.fromEntries(fields.map((field) => [field, undefined])));
        form.setFields(fields.map((name) => ({ name, errors: [] })));
      }}
    >
      <Button data-testid={testId}>Alles Löschen</Button>
    </Popconfirm>
  );
}
