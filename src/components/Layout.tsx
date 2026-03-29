import { AppBar, Box, Button, Toolbar, Typography, Container } from '@mui/material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { signOut, user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const isAdmin = role === 'admin' || role === 'secretary';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ flexGrow: 1, cursor: 'pointer' }} 
            onClick={() => navigate('/')}
          >
            CompEase {isAdmin ? 'Admin' : 'Спортсмен'}
          </Typography>
          {user && (
            <>
              {!isAdmin && (
                <Button 
                  color="inherit" 
                  onClick={() => navigate('/dashboard')}
                  sx={{ mr: 2, fontWeight: location.pathname.includes('/dashboard') ? 'bold' : 'normal' }}
                >
                  Мой профиль
                </Button>
              )}
              <Button color="inherit" onClick={handleLogout}>
                Выйти
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
