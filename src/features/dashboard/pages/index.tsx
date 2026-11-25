import { AppLayout } from "@/components/layout/app-layout";
import { DashboardPage } from "../components/dashboard-page";
import { EmployeeDashboardPage } from "../components/employee-dashboard-page";
import { useStore } from "@/store";

export default function Index() {
  const { currentUser } = useStore();

  const renderContent = () => {
    if ((currentUser?.role || "").toUpperCase() === "EMPLOYEE") {
      return <EmployeeDashboardPage />;
    } else {
      return <DashboardPage />;
    }
  };

  return <AppLayout>{renderContent()}</AppLayout>;
}