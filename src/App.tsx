import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import LoginPage from './pages/Login';
import { Button } from './components/ui/button';
import { onSessionExpired } from './infrastructure/apiClient';
import { Toaster } from './components/ui/sonner';
import { AdminRoutes } from './features/dashboard/components/admin-routes';
import { removeLegacyFinanceStorage } from './modules/finance/utils/legacy-storage';

// Phase 4: finance is served by Django only; drop the old browser demo ledger once per page load.
removeLegacyFinanceStorage();
import { EmployeeRoutes } from './features/dashboard/components/employee-routes';

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-primary text-primary-foreground font-bold shadow-sm">
        P
      </div>
      {children}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, currentUser, isHydrating, authError, initAuth, logout } = useStore();
  const location = useLocation();

  if (isHydrating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-primary text-primary-foreground font-bold shadow-sm animate-pulse">
          P
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Restoring session...</span>
        </div>
      </div>
    );
  }

  // Stored session exists but the server could not be reached — do not drop to demo data or log out.
  if (!isAuthenticated && authError) {
    return (
      <FullScreenMessage>
        <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <AlertCircle className="h-4 w-4 text-red-600" />
          Unable to restore your session
        </div>
        <p className="max-w-sm text-[13px]">{authError}</p>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => void initAuth()}>Retry</Button>
          <Button size="sm" variant="outline" onClick={() => void logout()}>Sign in again</Button>
        </div>
      </FullScreenMessage>
    );
  }

  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated && !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-[13px]">Loading user profile...</span>
      </div>
    );
  }

  return <>{children}</>;
}

/** Routes by the backend role (accounts.UserRole: ADMIN | EMPLOYEE | CLIENT). */
function RoleRoutes() {
  const { currentUser, logout } = useStore();
  const role = String(currentUser?.role || '').toUpperCase();

  if (role === 'ADMIN') return <AdminRoutes />;
  if (role === 'EMPLOYEE') return <EmployeeRoutes />;

  // CLIENT (or any unrecognised role) has no portal in this app — never fall back to the admin UI.
  return (
    <FullScreenMessage>
      <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        No workspace access
      </div>
      <p className="max-w-sm text-[13px]">
        Your account ({currentUser?.email}) does not have access to the PromoCraft admin workspace.
      </p>
      <Button size="sm" variant="outline" onClick={() => void logout()}>Sign out</Button>
    </FullScreenMessage>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initAuth } = useStore();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      void initAuth();
    }
  }, [initAuth]);

  // Any transition to signed-out (logout button or session expiry) drops cached server data,
  // so the next user in this tab never sees the previous user's employees/profile.
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      if (prev.isAuthenticated && !state.isAuthenticated) queryClient.clear();
    });
  }, []);

  // Refresh token rejected → wipe cached server data and tell the user.
  useEffect(() => {
    return onSessionExpired(() => {
      queryClient.clear();
      toast.error("Your session has expired. Please sign in again.");
    });
  }, []);

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster position="bottom-right" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <RoleRoutes />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
