import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { EmployeeDashboardPage } from "@/components/dashboard/employee-dashboard-page";
import { useStore } from "@/store";

export default function Index() {
  const { currentUser } = useStore();
  return (
    <DashboardShell>
      {currentUser?.role === "Employee" ? <EmployeeDashboardPage /> : <DashboardPage />}
    </DashboardShell>
  );
}