import { Alert, Box, Button, Container, Paper, Tab, Tabs, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import api from '../services/api';

export default function Login() {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ severity: 'success' | 'info'; message: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [regStep, setRegStep] = useState<'credentials' | 'confirm'>('credentials');
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const navigate = useNavigate();

  const formatAuthError = (message: string) => {
    const m = message.toLowerCase();
    if (
      m.includes('email rate limit exceeded') ||
      (m.includes('rate limit') && m.includes('email'))
    ) {
      return 'Превышен лимит отправки писем подтверждения. Подождите и попробуйте позже или используйте другой email. Для продакшена нужно подключить SMTP в Supabase Auth.';
    }
    if (m.includes('rate limit') || m.includes('too many requests')) {
      return 'Слишком много попыток. Подождите и попробуйте позже.';
    }
    return message;
  };

  const handleSendCode = async () => {
    if (cooldownLeft > 0) return;
    setLoading(true);
    setError('');
    setNotice(null);

    if (!consent) {
      setError('Необходимо согласиться на обработку персональных данных');
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Введите email.');
      setLoading(false);
      return;
    }
    const newPassword = password.trim();
    if (!newPassword) {
      setError('Придумайте пароль.');
      setLoading(false);
      return;
    }
    if (newPassword.length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      setLoading(false);
      return;
    }

    // Use backend custom OTP
    try {
      await api.post('/auth-custom/otp/send', { email: cleanEmail });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Не удалось отправить письмо.';
      setError(String(msg));
      setLoading(false);
      return;
    }

    setCooldownLeft(60);
    setRegStep('confirm');
    setNotice({
      severity: 'info',
      message: 'Мы отправили письмо с кодом. Введите код ниже для подтверждения email.',
    });
    setLoading(false);
  };

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = window.setInterval(() => {
      setCooldownLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownLeft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice(null);

    if (tab === 0) {
      // Login
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          setError('Неправильный логин или пароль');
        } else {
          setError(formatAuthError(error.message));
        }
        setLoading(false);
      } else {
        navigate('/');
      }
    } else {
      if (regStep === 'credentials') {
        setLoading(false);
        await handleSendCode();
        return;
      }

      // Register: step 2 confirm email (OTP code)
      if (!consent) {
        setError('Необходимо согласиться на обработку персональных данных');
        setLoading(false);
        return;
      }

      const cleanEmail = email.trim();
      if (!cleanEmail) {
        setError('Введите email.');
        setLoading(false);
        return;
      }

      const token = otpCode.trim();
      if (!token) {
        setError('Введите код из письма.');
        setLoading(false);
        return;
      }
      if (!/^\d{6,8}$/.test(token)) {
        setError('Код должен состоять из 6–8 цифр.');
        setLoading(false);
        return;
      }

      const newPassword = password.trim();
      if (!newPassword) {
        setError('Придумайте пароль.');
        setLoading(false);
        return;
      }

      try {
        await api.post('/auth-custom/otp/verify', {
          email: cleanEmail,
          code: token,
          password: newPassword,
        });
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: newPassword,
        });
        if (signErr) {
          setError(formatAuthError(signErr.message));
          setLoading(false);
          return;
        }
        navigate('/', { state: { registrationSuccess: true } });
      } catch (err: any) {
        const msg = err?.response?.data?.detail || err?.message || 'Не удалось подтвердить код.';
        setError(String(msg));
        setLoading(false);
        return;
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
            onChange={(_, newValue) => {
              setTab(newValue);
              setError('');
              setNotice(null);
              setLoading(false);
              if (newValue === 0) {
                setPassword('');
              } else {
                setPassword('');
                setRegStep('credentials');
                setOtpCode('');
                setCooldownLeft(0);
              }
            }}
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
          {notice && (
            <Alert severity={notice.severity} sx={{ mb: 2 }}>
              {notice.message}
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
              disabled={tab === 1 && regStep === 'confirm'}
            />
            {tab === 0 ? (
              <TextField
                margin='normal'
                required
                fullWidth
                name='password'
                label='Пароль'
                type='password'
                id='password'
                autoComplete='current-password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ) : null}
            {tab === 1 && regStep === 'credentials' ? (
              <TextField
                margin='normal'
                required
                fullWidth
                name='password'
                label='Пароль'
                type='password'
                id='reg-password'
                autoComplete='new-password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ) : null}
            {tab === 1 && regStep === 'confirm' ? (
              <TextField
                margin='normal'
                required
                fullWidth
                name='otp'
                label='Код из письма'
                value={otpCode}
                onChange={(e) => setOtpCode(String(e.target.value).replace(/\D/g, '').slice(0, 8))}
                inputProps={{ inputMode: 'numeric' }}
                helperText={cooldownLeft > 0 ? `Повторная отправка через ${cooldownLeft}с` : ''}
              />
            ) : null}

            {tab === 1 && (
              <Box sx={{ mt: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type='checkbox'
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    Согласие на обработку персональных данных{' '}
                    <a
                      href='https://docs.google.com/document/d/1pkV6DiFigJ_jG-zkH_fsXpr-KgGu-2ibxIC9gNvJv-Y/edit?usp=sharing'
                      target='_blank'
                      rel='noreferrer'
                    >
                      (открыть)
                    </a>
                  </span>
                </label>
              </Box>
            )}
            {tab === 0 ? (
              <Button
                type='submit'
                fullWidth
                variant='contained'
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? 'Загрузка...' : 'Войти'}
              </Button>
            ) : (
              <>
                {regStep === 'credentials' ? (
                  <Button
                    type='button'
                    fullWidth
                    variant='contained'
                    sx={{ mt: 3, mb: 2 }}
                    disabled={loading || cooldownLeft > 0}
                    onClick={() => void handleSendCode()}
                  >
                    {loading
                      ? 'Загрузка...'
                      : cooldownLeft > 0
                        ? `Отправить письмо (${cooldownLeft}с)`
                        : 'Отправить письмо'}
                  </Button>
                ) : null}
                {regStep === 'confirm' ? (
                  <>
                    <Button
                      type='submit'
                      fullWidth
                      variant='contained'
                      sx={{ mt: 3, mb: 2 }}
                      disabled={loading}
                    >
                      {loading ? 'Загрузка...' : 'Подтвердить код'}
                    </Button>
                    {cooldownLeft === 0 ? (
                      <Button
                        type='button'
                        fullWidth
                        variant='outlined'
                        disabled={loading}
                        onClick={() => void handleSendCode()}
                      >
                        Отправить письмо снова
                      </Button>
                    ) : null}
                    <Button
                      type='button'
                      fullWidth
                      variant='text'
                      disabled={loading}
                      onClick={() => {
                        setRegStep('credentials');
                        setOtpCode('');
                        setError('');
                        setNotice(null);
                      }}
                    >
                      Назад
                    </Button>
                  </>
                ) : null}
              </>
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
