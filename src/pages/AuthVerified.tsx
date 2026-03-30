import { Box, Button, Container, Paper, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function AuthVerified() {
  const navigate = useNavigate();

  return (
    <Container maxWidth='sm' sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant='h5' gutterBottom>
          Почта подтверждена
        </Typography>
        <Typography color='text.secondary' sx={{ mb: 3 }}>
          Спасибо! Ваш e-mail подтвержден. Теперь вы можете войти, используя email и пароль.
        </Typography>
        <Box>
          <Button variant='contained' onClick={() => navigate('/login')}>
            Перейти к входу
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

