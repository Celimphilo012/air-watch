import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import HistoricalPage from "./pages/HistoricalPage";
import UploadPage from "./pages/UploadPage";
import TrainPage from "./pages/TrainPage";
import PredictPage from "./pages/PredictPage";
import ReportPage from "./pages/ReportPage";
import NotificationsPage from "./pages/NotificationsPage";
import ModelReportPage from "./pages/ModelReportPage";
import AdminPage from "./pages/AdminPage";
import ZonesPage from "./pages/ZonesPage";
import AuditPage from "./pages/AuditPage";
import ConfigPage from "./pages/ConfigPage";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading...
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-2xl font-bold text-red-500 mb-2">Access Denied</p>
          <p className="text-gray-500">
            Your role does not have access to this page.
          </p>
        </div>
      </div>
    );
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="historical" element={<HistoricalPage />} />
        <Route
          path="upload"
          element={
            <ProtectedRoute roles={["environmental_officer", "admin"]}>
              <UploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="train"
          element={
            <ProtectedRoute roles={["environmental_officer", "admin"]}>
              <TrainPage />
            </ProtectedRoute>
          }
        />
        <Route path="predict" element={<PredictPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route
          path="notifications"
          element={
            <ProtectedRoute roles={["environmental_officer", "admin"]}>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="model-report" element={<ModelReportPage />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="zones"
          element={
            <ProtectedRoute roles={["admin"]}>
              <ZonesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="config"
          element={
            <ProtectedRoute roles={["admin"]}>
              <ConfigPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
