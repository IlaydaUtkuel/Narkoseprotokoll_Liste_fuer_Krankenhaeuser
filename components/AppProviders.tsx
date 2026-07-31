"use client";

import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";
import deDE from "antd/locale/de_DE";
import dayjs from "dayjs";
import "dayjs/locale/de";

// Deutsche Datums-/Zeitangaben.
dayjs.locale("de");

// Ruhiges, medizinisches Erscheinungsbild: heller Hintergrund, gruener
// Erfolgsstatus, grosse fingerfreundliche Bedienelemente (~44px).
const themeConfig = {
  token: {
    colorPrimary: "#1f7a63",
    colorInfo: "#1f7a63",
    colorSuccess: "#237804",
    borderRadius: 8,
    fontSize: 16,
    controlHeight: 44,
    controlHeightLG: 52,
    colorBgLayout: "#f4f7f6",
  },
};

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider locale={deDE} theme={themeConfig} wave={{ disabled: true }}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
