import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Form, Input } from "antd";
import { describe, expect, it } from "vitest";
import { ClearAllButton } from "@/components/vitals/ClearAllButton";

function TestForm({ isEdit = false }: { isEdit?: boolean }) {
  const [form] = Form.useForm<{ name: string; dose: string }>();
  return (
    <Form form={form} initialValues={{ name: "Propofol", dose: "20" }}>
      <Form.Item name="name"><Input data-testid="f-name" /></Form.Item>
      <Form.Item name="dose"><Input data-testid="f-dose" /></Form.Item>
      <ClearAllButton form={form} fields={["name", "dose"]} isEdit={isEdit} testId="clear-all" />
    </Form>
  );
}

const nameInput = () => screen.getByTestId("f-name") as HTMLInputElement;
const doseInput = () => screen.getByTestId("f-dose") as HTMLInputElement;

describe("Alles Löschen", () => {
  it("löscht nicht sofort, sondern fragt zuerst nach", async () => {
    render(<TestForm />);
    expect(nameInput().value).toBe("Propofol");
    fireEvent.click(screen.getByTestId("clear-all"));
    await waitFor(() => expect(screen.getByText("Alle Eingaben löschen?")).toBeInTheDocument());
    // Solange nicht bestätigt wurde, bleibt alles unverändert.
    expect(nameInput().value).toBe("Propofol");
    expect(doseInput().value).toBe("20");
  });

  it("leert die Eingaben erst nach Bestätigung", async () => {
    render(<TestForm />);
    fireEvent.click(screen.getByTestId("clear-all"));
    await waitFor(() => expect(screen.getByText("Alles löschen")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Alles löschen"));
    await waitFor(() => expect(nameInput().value).toBe(""));
    expect(doseInput().value).toBe("");
  });

  it("verwirft nichts, wenn abgebrochen wird", async () => {
    render(<TestForm />);
    fireEvent.click(screen.getByTestId("clear-all"));
    await waitFor(() => expect(screen.getByText("Abbrechen")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Abbrechen"));
    // Nach dem Abbrechen bleiben alle Eingaben unverändert erhalten.
    expect(nameInput().value).toBe("Propofol");
    expect(doseInput().value).toBe("20");
  });

  it("erklärt beim Bearbeiten, dass der gespeicherte Eintrag erhalten bleibt", async () => {
    render(<TestForm isEdit />);
    fireEvent.click(screen.getByTestId("clear-all"));
    await waitFor(() =>
      expect(screen.getByText(/Der bereits gespeicherte Eintrag bleibt erhalten/)).toBeInTheDocument(),
    );
  });

  it("weist bei neuen Eingaben auf den ungespeicherten Verlust hin", async () => {
    render(<TestForm />);
    fireEvent.click(screen.getByTestId("clear-all"));
    await waitFor(() =>
      expect(screen.getByText(/Sie wurden noch nicht gespeichert/)).toBeInTheDocument(),
    );
  });
});
