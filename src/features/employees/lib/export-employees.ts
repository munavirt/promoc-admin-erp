import type { EmployeeBackend } from "@/api/employees.api";
import { csvCell, downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";

export { csvCell };

/** Columns for the client-side CSV export of GET /api/employees/ (no export endpoint exists). */
const COLUMNS: CsvColumn<EmployeeBackend>[] = [
  { header: "Employee ID", value: (e) => e.employee_id },
  { header: "Name", value: (e) => e.name },
  { header: "Email", value: (e) => e.email },
  { header: "Phone", value: (e) => e.phone },
  { header: "Department", value: (e) => e.department },
  { header: "Designation", value: (e) => e.designation },
  { header: "Employment Type", value: (e) => e.employment_type },
  { header: "Status", value: (e) => e.status },
  { header: "Joining Date", value: (e) => e.joining_date },
  { header: "Salary (Monthly)", value: (e) => e.salary },
  { header: "Emergency Contact Name", value: (e) => e.emergency_contact_name },
  { header: "Emergency Contact Phone", value: (e) => e.emergency_contact_phone },
  { header: "Address", value: (e) => e.address },
  { header: "Created At", value: (e) => e.created_at },
  { header: "Updated At", value: (e) => e.updated_at },
];

export const employeesToCsv = (rows: EmployeeBackend[]): string => toCsv(COLUMNS, rows);
export const downloadEmployeesCsv = (rows: EmployeeBackend[]): void => downloadCsv("employees", employeesToCsv(rows));
