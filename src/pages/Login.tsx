import { Alert, Box, Button, Container, Paper, Tab, Tabs, TextField } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (tab === 0) {
      // Login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          setError('Неправильный логин или пароль');
        } else {
          setError(error.message);
        }
        setLoading(false);
      } else {
        navigate('/');
      }
    } else {
      // Register a new user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        if (data.user) {
          const { error: dbError } = await supabase
            .from('users')
            .upsert({ id: data.user.id, email: data.user.email }, { onConflict: 'id' });

          if (dbError) {
            setError(dbError.message);
            setLoading(false);
            return;
          }
        }
        navigate('/dashboard');
      }
    }
  };

  return (
    <Container component='main' maxWidth='xs'>
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Tabs
            value={tab}
            onChange={(_, newValue) => setTab(newValue)}
            variant='fullWidth'
            sx={{ mb: 3 }}
          >
            <Tab label='Вход' />
            <Tab label='Регистрация' />
          </Tabs>

          {error && (
            <Alert severity='error' sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component='form' onSubmit={handleSubmit} noValidate>
            <TextField
              margin='normal'
              required
              fullWidth
              id='email'
              label='Email'
              name='email'
              autoComplete='email'
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin='normal'
              required
              fullWidth
              name='password'
              label='Пароль'
              type='password'
              id='password'
              autoComplete={tab === 0 ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type='submit'
              fullWidth
              variant='contained'
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Загрузка...' : tab === 0 ? 'Войти' : 'Зарегистрироваться'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
