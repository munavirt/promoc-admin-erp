import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useStore } from './store'
import { useEffect } from 'react'

// Pages
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import ClientsPage from './pages/Clients'
import ClientDetailPage from './pages/ClientDetail'
import ProjectsPage from './pages/Projects'
import ProjectDetailPage from './pages/ProjectDetail'
import TasksPage from './pages/Tasks'
import TaskDetailPage from './pages/TaskDetail'
import EmployeesPage from './pages/Employees'
import EmployeeDetailPage from './pages/EmployeeDetail'
import MeetingsPage from './pages/Meetings'
import FilesPage from './pages/Files'
import ReportsPage from './pages/Reports'
import SettingsPage from './pages/Settings'

function ProtectedRoute({ children }) {
  const { isAuthenticated, currentUser } = useStore()
  const location = useLocation()

  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login') {
      window.location.href = '/login'
    }
    if (isAuthenticated && location.pathname === '/login') {
      window.location.href = '/'
    }
  }, [isAuthenticated, location.pathname])

  if (!isAuthenticated && location.pathname !== '/login') {
    return null
  }

  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:clientId" element={<ClientDetailPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/:employeeId" element={<EmployeeDetailPage />} />
                <Route path="/meetings" element={<MeetingsPage />} />
                <Route path="/files" element={<FilesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
