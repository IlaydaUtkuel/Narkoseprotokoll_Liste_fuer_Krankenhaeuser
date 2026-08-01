"use client";

import { useState } from "react";
import { Alert, Button, Form, Input, Modal, Result, Typography } from "antd";
import { useRouter } from "next/navigation";
import { archiveAndCloseCompletedCase } from "../../lib/timeline/caseArchive";

export function CloseCasePage() {
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (savedPath) {
    return (
      <main className="close-case-page" data-testid="case-close-complete">
        <Result
          status="success"
          title="Der Eingriff wurde gespeichert und geschlossen."
          subTitle={`Archivpfad: ${savedPath}`}
          extra={(
            <Button type="primary" size="large" onClick={() => router.replace("/")} data-testid="new-case-start">
              Neuen Fall starten
            </Button>
          )}
        />
      </main>
    );
  }

  return (
    <main className="close-case-page" data-testid="case-close-page">
      <section className="close-case-card">
        <Typography.Title level={1}>Speichern und Schließen</Typography.Title>
        <Alert
          type="warning"
          showIcon
          message="Sind Sie sicher, dass Sie den beendeten Eingriff abschließen möchten?"
          description="Nach dem Speichern wird der aktive Fall geleert. Die neue Patientenerfassung beginnt anschließend mit leeren Basisdaten."
        />
        <Typography.Paragraph type="secondary" className="close-case-note">
          Der Ordnerpfad wird in dieser Browser-Demo als Ablagepfad des lokalen Archivs gespeichert.
        </Typography.Paragraph>
        {error ? <Alert type="error" showIcon message={error} className="close-case-error" /> : null}
        <Form<{ folderPath: string }>
          layout="vertical"
          onFinish={({ folderPath }) => {
            setError(null);
            setPendingPath(folderPath.trim());
          }}
        >
          <Form.Item
            name="folderPath"
            label="Ordnerpfad"
            rules={[{ required: true, whitespace: true, message: "Bitte einen Ordnerpfad eingeben." }]}
          >
            <Input
              autoFocus
              placeholder="z. B. C:\\Narkoseprotokolle"
              data-testid="archive-folder-path"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" data-testid="archive-ok">
            OK
          </Button>
        </Form>
      </section>
      <Modal
        open={pendingPath !== null}
        title="Eingriff wirklich speichern und schließen?"
        okText="Speichern und Schließen"
        cancelText="Abbrechen"
        onCancel={() => setPendingPath(null)}
        onOk={() => {
          if (!pendingPath) return;
          try {
            const archived = archiveAndCloseCompletedCase(pendingPath);
            setSavedPath(archived.folderPath);
            setPendingPath(null);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Der Eingriff konnte nicht archiviert werden.");
            setPendingPath(null);
          }
        }}
      >
        <Typography.Paragraph>
          Der abgeschlossene Fall wird unter <strong>{pendingPath}</strong> archiviert. Danach werden die aktiven Patient- und Eingriffsdaten geleert.
        </Typography.Paragraph>
      </Modal>
    </main>
  );
}
