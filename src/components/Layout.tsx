import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { signOut, user, role, accessToken, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const isAdmin = role === 'admin' || role === 'secretary';
  const hasAuth = Boolean(accessToken || user);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position='static'>
        <Toolbar>
          <Typography
            variant='h6'
            component='div'
            sx={{ flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            MAS-WRESTLING ONLINE {isAdmin ? 'Admin' : 'Спортсмен'}
          </Typography>
          {hasAuth && !loading && (
            <>
              {isAdmin ? (
                <>
                  <Button
                    color='inherit'
                    onClick={() => navigate('/competitions')}
                    sx={{
                      mr: 2,
                      fontWeight: location.pathname.includes('/competitions') ? 'bold' : 'normal',
                    }}
                  >
                    Соревнования
                  </Button>
                  <Button
                    color='inherit'
                    onClick={() => navigate('/users')}
                    sx={{
                      mr: 2,
                      fontWeight: location.pathname === '/users' ? 'bold' : 'normal',
                    }}
                  >
                    Администрирование
                  </Button>
                  <Button
                    color='inherit'
                    onClick={() => navigate('/users/athletes')}
                    sx={{
                      mr: 2,
                      fontWeight: location.pathname.includes('/users/athletes') ? 'bold' : 'normal',
                    }}
                  >
                    Пользователи
                  </Button>
                </>
              ) : (
                <Button
                  color='inherit'
                  onClick={() => navigate('/dashboard')}
                  sx={{
                    mr: 2,
                    fontWeight: location.pathname.includes('/dashboard') ? 'bold' : 'normal',
                  }}
                >
                  Мой профиль
                </Button>
              )}
              <Button color='inherit' onClick={handleLogout}>
                Выйти
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container component='main' sx={{ flexGrow: 1, py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
