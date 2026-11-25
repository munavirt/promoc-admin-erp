import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage from '../pages/index'
import { ClientsPage } from '../../clients/pages/clients-page'
import { AddClientPage } from '../../clients/pages/add-client-page'
import { EditClientPage } from '../../clients/pages/edit-client-page'
import ClientDetailPage from '../../../pages/ClientDetail'
import { ProjectsPage } from '../../projects/pages/projects-page'
import { CreateProjectPage } from '../../projects/pages/create-project-page'
import { EditProjectPage } from '../../projects/pages/edit-project-page'
import ProjectDetailPage from '../../../pages/ProjectDetail'
import { TasksPage } from '../../tasks/pages/tasks-page'
import { CreateTaskPage } from '../../tasks/pages/create-task-page'
import { EditTaskPage } from '../../tasks/pages/edit-task-page'
import TaskDetailPage from '../../../pages/TaskDetail'
import { EmployeesPage } from '../../employees/pages/employees-page'
import { AddEmployeePage } from '../../employees/pages/add-employee-page'
import { EditEmployeePage } from '../../employees/pages/edit-employee-page'
import EmployeeDetailPage from '../../../pages/EmployeeDetail'
import MeetingsPage from '../../../pages/Meetings'
import SettingsPage from '../../../pages/Settings'
import { NotificationsPage } from '../../notifications/pages/notifications-page'
import { FinanceOverviewPage } from '../../../modules/finance/pages/finance-overview-page'
import { IncomePage } from '../../../modules/finance/pages/income-page'
import { IncomeFormPage } from '../../../modules/finance/pages/income-form-page'
import { IncomeDetailPage } from '../../../modules/finance/pages/income-detail-page'
import { ExpensesPage } from '../../../modules/finance/pages/expenses-page'
import { ExpenseFormPage } from '../../../modules/finance/pages/expense-form-page'
import { ExpenseDetailPage } from '../../../modules/finance/pages/expense-detail-page'
import { InvoicesPage } from '../../../modules/finance/pages/invoices-page'
import { InvoiceFormPage } from '../../../modules/finance/pages/invoice-form-page'
import { InvoiceDetailPage } from '../../../modules/finance/pages/invoice-detail-page'
import { PaymentsPage } from '../../../modules/finance/pages/payments-page'
import { RecordPaymentFormPage } from '../../../modules/finance/pages/record-payment-form-page'
import { PaymentDetailPage } from '../../../modules/finance/pages/payment-detail-page'
import { FinancialReportsPage } from '../../../modules/finance/pages/financial-reports-page'

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/clients/new" element={<AddClientPage />} />
      <Route path="/clients/:clientId" element={<ClientDetailPage />} />
      <Route path="/clients/:clientId/edit" element={<EditClientPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<CreateProjectPage />} />
      <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      <Route path="/projects/:projectId/edit" element={<EditProjectPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/tasks/new" element={<CreateTaskPage />} />
      <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
      <Route path="/tasks/:taskId/edit" element={<EditTaskPage />} />
      <Route path="/employees" element={<EmployeesPage />} />
      <Route path="/employees/new" element={<AddEmployeePage />} />
      <Route path="/employees/:employeeId" element={<EmployeeDetailPage />} />
      <Route path="/employees/:employeeId/edit" element={<EditEmployeePage />} />
      <Route path="/meetings" element={<MeetingsPage />} />
      <Route path="/reports" element={<Navigate to="/finance/reports" replace />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/finance" element={<FinanceOverviewPage />} />
      <Route path="/finance/income" element={<IncomePage />} />
      <Route path="/finance/income/new" element={<IncomeFormPage />} />
      <Route path="/finance/income/:id" element={<IncomeDetailPage />} />
      <Route path="/finance/income/:id/edit" element={<IncomeFormPage />} />
      <Route path="/finance/expenses" element={<ExpensesPage />} />
      <Route path="/finance/expenses/new" element={<ExpenseFormPage />} />
      <Route path="/finance/expenses/:id" element={<ExpenseDetailPage />} />
      <Route path="/finance/expenses/:id/edit" element={<ExpenseFormPage />} />
      <Route path="/finance/invoices" element={<InvoicesPage />} />
      <Route path="/finance/invoices/new" element={<InvoiceFormPage />} />
      <Route path="/finance/invoices/project/new" element={<Navigate to="/finance/invoices/new" replace />} />
      <Route path="/finance/invoices/:id" element={<InvoiceDetailPage />} />
      <Route path="/finance/invoices/:id/edit" element={<InvoiceFormPage />} />
      <Route path="/finance/payments" element={<PaymentsPage />} />
      <Route path="/finance/payments/new" element={<RecordPaymentFormPage />} />
      <Route path="/finance/payments/:id" element={<PaymentDetailPage />} />
      <Route path="/finance/reports" element={<FinancialReportsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
