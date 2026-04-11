import { Alert, Box, Button, Container, Paper, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function AuthResetPassword() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const query = useQuery();
  const { setAuthToken } = useAuth();
  const linkMode = Boolean(email.trim() && token.trim());

  useEffect(() => {
    const e = query.get('email');
    if (e) setEmail(e);
    const t = query.get('token');
    if (t) setToken(t);
  }, [query]);

  const sendLink = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Введите email.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth-custom/reset/send', { email: email.trim() });
      setNotice('Если такая почта зарегистрирована, мы отправили ссылку для восстановления.');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Не удалось отправить письмо.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!linkMode) {
      setError('Откройте ссылку из письма для восстановления пароля.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      return;
    }
    if (password !== password2) {
      setError('Пароли не совпадают.');
      return;
    }
    setLoading(true);
    try {
      const resp = await api.post('/auth-custom/reset/confirm', {
        email: email.trim(),
        token: token.trim(),
        password,
      });
      const issuedToken = String(resp?.data?.access_token || '');
      if (issuedToken) {
        await setAuthToken(issuedToken);
        navigate('/dashboard');
        return;
      }
      setNotice('Пароль изменён. Перейдите к входу.');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Не удалось изменить пароль.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth='sm' sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant='h5' gutterBottom>
          Восстановление пароля
        </Typography>
        {error ? (
          <Alert severity='error' sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        {notice ? (
          <Alert severity='success' sx={{ mb: 2 }}>
            {notice}
          </Alert>
        ) : null}

        {linkMode ? (
          <Box component='form' onSubmit={onConfirm} noValidate>
            <TextField
              margin='normal'
              required
              fullWidth
              label='Новый пароль'
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <TextField
              margin='normal'
              required
              fullWidth
              label='Повторите пароль'
              type='password'
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              disabled={loading}
            />
            <Button type='submit' fullWidth variant='contained' sx={{ mt: 2 }} disabled={loading}>
              Сохранить пароль
            </Button>
            <Button
              type='button'
              fullWidth
              variant='text'
              sx={{ mt: 1 }}
              onClick={() => navigate('/login')}
            >
              Вернуться к входу
            </Button>
          </Box>
        ) : (
          <Box
            component='form'
            onSubmit={(e) => {
              e.preventDefault();
              void sendLink();
            }}
            noValidate
          >
            <TextField
              margin='normal'
              required
              fullWidth
              label='Email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <Button type='submit' fullWidth variant='contained' sx={{ mt: 2 }} disabled={loading}>
              Отправить ссылку восстановления
            </Button>
            <Typography color='text.secondary' sx={{ mt: 2 }}>
              На почту придёт ссылка. Откройте её, чтобы задать новый пароль.
            </Typography>
            <Button
              type='button'
              fullWidth
              variant='text'
              sx={{ mt: 1 }}
              onClick={() => navigate('/login')}
            >
              Вернуться к входу
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
