import type { ReactNode } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";

export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppLayout>
      <PageHeader title={title} description={description}>
        {actions}
      </PageHeader>
      {children}
    </AppLayout>
  );
}