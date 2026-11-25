import type { QueryClient } from "@tanstack/react-query";
import type { EmployeeBackend } from "@/api/employees.api";

/** Employee id → "Name (Designation)" from the already-loaded active-employee picker data. */
export function getEmployeeLabelMap(queryClient: QueryClient): Map<string, string> {
  const employees = queryClient.getQueryData<EmployeeBackend[]>(["employees", "active"]) ?? [];
  return new Map(employees.map((e) => [String(e.id), e.name]));
}
