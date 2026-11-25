import { Routes, Route, Navigate } from 'react-router-dom'
import { EmployeeLayout } from '../../../components/layout/employee-layout'
import { EmployeeDashboard } from '../../employee-portal/pages/dashboard'
import { EmployeeTasksPage } from '../../employee-portal/pages/my-tasks'
import { EmployeeProjectsPage } from '../../employee-portal/pages/my-projects'
import { EmployeeProjectDetailPage } from '../../employee-portal/pages/project-detail'
import { EmployeeNotificationsPage } from '../../employee-portal/pages/notifications'
import { EmployeeProfilePage } from '../../employee-portal/pages/profile'
import { EmployeeSettingsPage } from '../../employee-portal/pages/settings'

export function EmployeeRoutes() {
  return (
    <EmployeeLayout>
      <Routes>
        <Route path="/" element={<EmployeeDashboard />} />
        <Route path="/tasks" element={<EmployeeTasksPage />} />
        <Route path="/projects" element={<EmployeeProjectsPage />} />
        <Route path="/projects/:id" element={<EmployeeProjectDetailPage />} />
        <Route path="/notifications" element={<EmployeeNotificationsPage />} />
        <Route path="/profile" element={<EmployeeProfilePage />} />
        <Route path="/settings" element={<EmployeeSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </EmployeeLayout>
  )
}
