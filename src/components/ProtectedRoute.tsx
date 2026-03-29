import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

export default function ProtectedRoute() {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return <Outlet />;
  }

  // Redirect athletes away from admin routes
  const isAdminRoute = !location.pathname.startsWith('/dashboard');
  if (isAdminRoute && role === 'athlete') {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect admins away from athlete routes (optional, but good for UX)
  if (!isAdminRoute && (role === 'admin' || role === 'secretary')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
