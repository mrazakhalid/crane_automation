import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout.js';
import { RequireAuth, RequireRole } from './components/RouteGuards.js';
import { ThemeProvider } from './components/ThemeProvider.js';
import { ToastProvider } from './components/ToastProvider.js';
import { AuthProvider } from './context/AuthProvider.js';
import { AccountPage } from './pages/AccountPage.js';
import { CraneViewPage } from './pages/CraneViewPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LinesPage } from './pages/LinesPage.js';
import { LogsPage } from './pages/LogsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { PlantPage } from './pages/PlantPage.js';
import { PlcManagerPage } from './pages/PlcManagerPage.js';
import { PlcPage } from './pages/PlcPage.js';
// Process tab hidden for now — the workspace lives on the manager Dashboard.
// import { ProcessPage } from './pages/ProcessPage.js';
import { UsersPage } from './pages/UsersPage.js';

/**
 * Root application component.
 *
 * Purpose: Compose the global providers (theme, toasts, auth) and the route
 *   tree: a public /login, and an authenticated shell whose /users branch is
 *   gated to super-admins. Unknown paths fall back to the dashboard.
 */
export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route element={<RequireRole roles={['manager', 'super_admin']} />}>
                    <Route path="plant" element={<PlantPage />} />
                    <Route path="crane" element={<CraneViewPage />} />
                    <Route path="logs" element={<LogsPage />} />
                  </Route>
                  {/* Process tab hidden for now — workspace is on the manager Dashboard.
                  <Route element={<RequireRole roles={['manager']} />}>
                    <Route path="process" element={<ProcessPage />} />
                  </Route> */}
                  <Route element={<RequireRole roles={['super_admin']} />}>
                    <Route path="lines" element={<LinesPage />} />
                    <Route path="plc" element={<PlcPage />} />
                    <Route path="plc-manager" element={<PlcManagerPage />} />
                    <Route path="users" element={<UsersPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
