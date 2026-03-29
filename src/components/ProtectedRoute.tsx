import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute() {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box display='flex' justifyContent='center' alignItems='center' minHeight='100vh'>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return <Navigate to='/login' state={{ from: location }} replace />;
  }

  console.log('ProtectedRoute role:', role, 'location:', location.pathname);

  // If user is athlete and trying to access admin routes, redirect to dashboard
  if (role === 'athlete' && location.pathname !== '/dashboard') {
    return <Navigate to='/dashboard' replace />;
  }

  // If user is admin/secretary and trying to access athlete dashboard, redirect to admin panel
  if ((role === 'admin' || role === 'secretary') && location.pathname === '/dashboard') {
    return <Navigate to='/competitions' replace />;
  }

  return <Outlet />;
}
