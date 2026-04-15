import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import api from '../services/api';
import { formatCategoryLabel } from '../utils/categoryFormat';

export default function UserDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [notice, setNotice] = useState<{
    severity: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const st = location.state as any;
    if (!st?.registrationSuccess) return;
    setNotice({
      severity: 'info',
      message:
        'Для участия в соревнованиях заполните профиль и подайте заявку на соревнования в разделе «Соревнования».',
    });
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, user]);

  if (!user) return null;

  return (
    <Container maxWidth='md' sx={{ mt: { xs: 2, sm: 4 }, mb: 4 }}>
      <Typography variant='h4' gutterBottom sx={{ fontSize: { xs: 24, sm: 34 } }}>
        Личный кабинет спортсмена
      </Typography>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={6000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        key={notice ? `${notice.severity}:${notice.message}` : 'notice'}
      >
        {notice ? (
          <Alert severity={notice.severity} variant='filled' onClose={() => setNotice(null)}>
            {notice.message}
          </Alert>
        ) : (
          <span />
        )}
      </Snackbar>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, newValue) => setTab(newValue)}
          variant={isMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
        >
          <Tab label='Профиль' />
          <Tab label='Заявки' />
          <Tab label='Соревнования' />
        </Tabs>
      </Paper>

      {tab === 0 && <ProfileTab userId={user.id} setNotice={setNotice} />}
      {tab === 1 && <ApplicationsTab userId={user.id} setNotice={setNotice} />}
      {tab === 2 && <CompetitionsTab userId={user.id} setNotice={setNotice} />}
    </Container>
  );
}

function ProfileTab({
  userId,
  setNotice,
}: {
  userId: string;
  setNotice: React.Dispatch<
    React.SetStateAction<{ severity: 'success' | 'error' | 'info'; message: string } | null>
  >;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    city: '',
    country_id: '',
    district_id: '',
    region_id: '',
    coach_name: '',
    birth_date: '',
    gender: '',
    rank: '',
    photo_url: '',
  });
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoSignedUrl, setPhotoSignedUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [touched, setTouched] = useState<{ full_name: boolean; coach_name: boolean }>({
    full_name: false,
    coach_name: false,
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard', userId],
    queryFn: async () => {
      const { data } = await api.get(`/users/me/dashboard`);
      return data as {
        registration: { locked: boolean; stage?: string | null };
        profile: any;
        athlete: any;
        details: any;
        location_path: {
          country_id?: string | null;
          district_id?: string | null;
          region_id?: string | null;
        } | null;
      };
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const locked = Boolean(dashboard?.registration?.locked);
  const profile = dashboard?.profile || null;
  const athlete = dashboard?.athlete || null;
  const details = dashboard?.details || null;
  const locationPath = dashboard?.location_path || null;

  const { data: countries } = useQuery({
    queryKey: ['locations', 'country'],
    queryFn: async () => {
      const { data } = await api.get(`/locations/`, { params: { type: 'country' } });
      return data;
    },
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: districts } = useQuery({
    queryKey: ['locations', 'district', formData.country_id],
    queryFn: async () => {
      if (!formData.country_id) return [];
      const { data } = await api.get(`/locations/`, {
        params: { type: 'district', parent_id: formData.country_id },
      });
      return data;
    },
    enabled: !!formData.country_id,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: regions } = useQuery({
    queryKey: ['locations', 'region', formData.district_id],
    queryFn: async () => {
      if (!formData.district_id) return [];
      const { data } = await api.get(`/locations/`, {
        params: { type: 'region', parent_id: formData.district_id },
      });
      return data;
    },
    enabled: !!formData.district_id,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        city: profile.city || '',
        region_id: profile.location_id || '',
      }));
    }
    if (athlete) {
      setFormData((prev) => ({
        ...prev,
        coach_name: athlete.coach_name || '',
      }));
    }
    if (details) {
      setFormData((prev) => ({
        ...prev,
        birth_date: details.birth_date || '',
        gender: details.gender || '',
        rank: details.rank || '',
        photo_url: details.photo_url || '',
      }));
    }
  }, [profile, athlete, details]);

  const normalizeFullName = (v: unknown) =>
    String(v ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  const getNameErrors = (value: string) => {
    const v = normalizeFullName(value);
    if (!v) return { error: 'Заполните ФИО.' };
    if (/\d/.test(v)) return { error: 'ФИО не должно содержать цифры.' };
    const parts = v.split(' ').filter(Boolean);
    if (parts.length < 3) {
      return {
        error: 'ФИО должно быть полностью (минимум 3 слова). Например: Иванов Иван Иванович.',
      };
    }
    if (/[A-Za-z]/.test(v)) {
      return { hint: 'Проверьте раскладку: обычно ФИО вводится кириллицей.' };
    }
    return {};
  };

  useEffect(() => {
    if (!locationPath) return;
    setFormData((prev) => ({
      ...prev,
      country_id: locationPath.country_id || prev.country_id,
      district_id: locationPath.district_id || prev.district_id,
      region_id: locationPath.region_id || prev.region_id,
    }));
  }, [locationPath]);

  const validateProfile = (data: typeof formData) => {
    const errors: Partial<Record<keyof typeof formData, string>> = {};

    const fullName = normalizeFullName(data.full_name);
    const fullNameCheck = getNameErrors(fullName);
    if (fullNameCheck.error) errors.full_name = fullNameCheck.error;

    const coachName = normalizeFullName(data.coach_name);
    const coachNameCheck = getNameErrors(coachName);
    if (coachNameCheck.error) {
      errors.coach_name = coachNameCheck.error.replace('Заполните ФИО.', 'Заполните ФИО тренера.');
    }

    const city = String(data.city || '').trim();
    if (!city) {
      errors.city = 'Заполните город/село.';
    }

    const digits = String(data.phone || '').replace(/\D/g, '');
    if (!digits) {
      errors.phone = 'Заполните телефон.';
    } else if (!(digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8')))) {
      errors.phone = 'Телефон должен содержать 11 цифр и начинаться с 7 или 8.';
    }

    if (!data.country_id) {
      errors.country_id = 'Выберите страну.';
    }
    if (!data.district_id) {
      errors.district_id = 'Выберите округ.';
    }
    if (!data.region_id) {
      errors.region_id = 'Выберите регион.';
    }

    if (!data.birth_date) {
      errors.birth_date = 'Заполните дату рождения.';
    } else {
      const d = new Date(data.birth_date);
      if (Number.isNaN(d.getTime())) {
        errors.birth_date = 'Некорректная дата рождения.';
      } else if (d > new Date()) {
        errors.birth_date = 'Дата рождения не может быть в будущем.';
      }
    }

    if (!data.gender) {
      errors.gender = 'Выберите пол.';
    } else if (data.gender !== 'male' && data.gender !== 'female') {
      errors.gender = 'Некорректное значение пола.';
    }

    if (!data.rank) {
      errors.rank = 'Выберите разряд/звание.';
    }

    if (!data.photo_url) {
      if (!photoFile) errors.photo_url = 'Загрузите фото 3×4.';
    }

    const messages = Object.values(errors).filter(Boolean) as string[];
    return { ok: messages.length === 0, errors, message: messages[0] || '' };
  };

  const validation = validateProfile(formData);

  const saveProfile = async (data: typeof formData) => {
    const check = validateProfile(data);
    if (!check.ok) throw new Error(check.message);
    const form = new FormData();
    form.append('full_name', String(data.full_name || '').trim());
    form.append('phone', String(data.phone || ''));
    form.append('city', String(data.city || '').trim());
    form.append('location_id', data.region_id ? String(data.region_id) : '');
    form.append('coach_name', String(data.coach_name || '').trim());
    form.append('birth_date', data.birth_date ? String(data.birth_date) : '');
    form.append('gender', data.gender ? String(data.gender) : '');
    form.append('rank', data.rank ? String(data.rank) : '');
    form.append('photo_url', data.photo_url ? String(data.photo_url) : '');
    if (photoFile) form.append('photo', photoFile);

    const { data: resp } = await api.post(`/users/me/profile/submit`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const savedPhotoUrl = resp?.photo_url ? String(resp.photo_url) : null;
    return { photo_url: savedPhotoUrl };
  };

  const updateProfile = useMutation({
    mutationFn: saveProfile,
    onSuccess: (data, variables) => {
      const finalPhotoUrl = data?.photo_url ? String(data.photo_url) : variables.photo_url || null;
      if (finalPhotoUrl) {
        setFormData((prev) => ({ ...prev, photo_url: finalPhotoUrl }));
        setPhotoFile(null);
      }
      queryClient.setQueryData(['details', userId], (prev: any) => ({
        ...(prev || {}),
        birth_date: variables.birth_date || null,
        gender: variables.gender || null,
        rank: variables.rank || null,
        photo_url: finalPhotoUrl,
      }));
      queryClient.invalidateQueries({ queryKey: ['details', userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
      setShowValidation(false);
      setNotice({ severity: 'success', message: 'Регистрация успешно завершена' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Не удалось сохранить профиль.';
      setNotice({ severity: 'error', message: String(msg) });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const localUrl = URL.createObjectURL(file);
      setPhotoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localUrl;
      });
      setPhotoFile(file);
      setNotice({ severity: 'info', message: 'Фото выбрано. Нажмите «Сохранить профиль».' });
    } catch (ex: any) {
      const msg = ex?.message || ex?.error_description || 'Ошибка при загрузке фото.';
      setNotice({ severity: 'error', message: String(msg) });
    }
  };

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!formData.photo_url) {
        setPhotoSignedUrl(null);
        return;
      }
      if (photoPreviewUrl) return;
      if (/^https?:\/\//i.test(formData.photo_url)) {
        setPhotoSignedUrl(formData.photo_url);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setPhotoSignedUrl(null);
        return;
      }
      const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(formData.photo_url, 60 * 60);
      if (cancelled) return;
      if (error) {
        setPhotoSignedUrl(null);
        return;
      }
      setPhotoSignedUrl(data?.signedUrl || null);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [formData.photo_url, photoPreviewUrl]);

  if (dashboardLoading) return <CircularProgress />;

  const fullNameFeedback = getNameErrors(formData.full_name);
  const coachNameFeedback = getNameErrors(formData.coach_name);

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      {locked ? (
        <Box mb={2}>
          <Alert severity='info'>
            Редактирование профиля заблокировано. Для изменения данных напишите на
            alex440544@gmail.com
          </Alert>
        </Box>
      ) : null}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant='h6'>Личные данные</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label='ФИО (полностью)'
            value={formData.full_name}
            onChange={(e) => {
              if (!touched.full_name) setTouched((p) => ({ ...p, full_name: true }));
              setFormData({ ...formData, full_name: e.target.value });
            }}
            disabled={locked}
            error={
              (showValidation || touched.full_name) &&
              Boolean(validation.errors.full_name || fullNameFeedback.error)
            }
            helperText={
              showValidation
                ? validation.errors.full_name
                : touched.full_name
                  ? fullNameFeedback.error ||
                    fullNameFeedback.hint ||
                    'Пример: Иванов Иван Иванович'
                  : ''
            }
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label='ФИО Тренера'
            value={formData.coach_name}
            onChange={(e) => {
              if (!touched.coach_name) setTouched((p) => ({ ...p, coach_name: true }));
              setFormData({ ...formData, coach_name: e.target.value });
            }}
            disabled={locked}
            error={
              (showValidation || touched.coach_name) &&
              Boolean(validation.errors.coach_name || coachNameFeedback.error)
            }
            helperText={
              showValidation
                ? validation.errors.coach_name
                : touched.coach_name
                  ? coachNameFeedback.error ||
                    coachNameFeedback.hint ||
                    'Пример: Петров Пётр Петрович'
                  : ''
            }
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label='Телефон'
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            disabled={locked}
            error={showValidation && Boolean(validation.errors.phone)}
            helperText={showValidation ? validation.errors.phone : ''}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='ru'>
            <DatePicker
              label='Дата рождения'
              format='DD.MM.YYYY'
              value={formData.birth_date ? dayjs(formData.birth_date) : null}
              onChange={(v) => {
                const iso = v && v.isValid() ? v.format('YYYY-MM-DD') : '';
                setFormData({ ...formData, birth_date: iso });
              }}
              disabled={locked}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: showValidation && Boolean(validation.errors.birth_date),
                  helperText: showValidation ? validation.errors.birth_date : '',
                },
              }}
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl
            fullWidth
            disabled={locked}
            error={showValidation && Boolean(validation.errors.gender)}
          >
            <InputLabel>Пол</InputLabel>
            <Select
              value={formData.gender}
              label='Пол'
              onChange={(e) => setFormData({ ...formData, gender: String(e.target.value) })}
            >
              <MenuItem value='male'>Мужской</MenuItem>
              <MenuItem value='female'>Женский</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl
            fullWidth
            disabled={locked}
            error={showValidation && Boolean(validation.errors.rank)}
          >
            <InputLabel>Разряд / звание</InputLabel>
            <Select
              value={formData.rank}
              label='Разряд / звание'
              onChange={(e) => setFormData({ ...formData, rank: String(e.target.value) })}
            >
              <MenuItem value='Б/Р'>Без разряда</MenuItem>
              <MenuItem value='3 юн'>3 юношеский</MenuItem>
              <MenuItem value='2 юн'>2 юношеский</MenuItem>
              <MenuItem value='1 юн'>1 юношеский</MenuItem>
              <MenuItem value='3'>3 спортивный</MenuItem>
              <MenuItem value='2'>2 спортивный</MenuItem>
              <MenuItem value='1'>1 спортивный</MenuItem>
              <MenuItem value='КМС'>КМС</MenuItem>
              <MenuItem value='МС'>МС</MenuItem>
              <MenuItem value='МСМК'>МСМК</MenuItem>
              <MenuItem value='ЗМС'>ЗМС</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label='Населенный пункт (город/село)'
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            disabled={locked}
            error={showValidation && Boolean(validation.errors.city)}
            helperText={showValidation ? validation.errors.city : ''}
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant='h6'>Регион</Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth error={showValidation && Boolean(validation.errors.country_id)}>
            <InputLabel>Страна</InputLabel>
            <Select
              value={formData.country_id}
              label='Страна'
              MenuProps={{ disableScrollLock: true }}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  country_id: e.target.value,
                  district_id: '',
                  region_id: '',
                })
              }
              disabled={locked}
            >
              {formData.country_id &&
              !countries?.some((c: any) => String(c.id) === String(formData.country_id)) ? (
                <MenuItem value={formData.country_id}>Загрузка...</MenuItem>
              ) : null}
              {countries?.map((c: any) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl
            fullWidth
            disabled={!formData.country_id}
            error={showValidation && Boolean(validation.errors.district_id)}
          >
            <InputLabel>Округ</InputLabel>
            <Select
              value={formData.district_id}
              label='Округ'
              MenuProps={{ disableScrollLock: true }}
              onChange={(e) =>
                setFormData({ ...formData, district_id: e.target.value, region_id: '' })
              }
              disabled={locked || !formData.country_id}
            >
              {formData.district_id &&
              !districts?.some((d: any) => String(d.id) === String(formData.district_id)) ? (
                <MenuItem value={formData.district_id}>Загрузка...</MenuItem>
              ) : null}
              {districts?.map((d: any) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl
            fullWidth
            disabled={!formData.district_id}
            error={showValidation && Boolean(validation.errors.region_id)}
          >
            <InputLabel>Регион</InputLabel>
            <Select
              value={formData.region_id}
              label='Регион'
              MenuProps={{ disableScrollLock: true }}
              onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
              disabled={locked || !formData.district_id}
            >
              {formData.region_id &&
              !regions?.some((r: any) => String(r.id) === String(formData.region_id)) ? (
                <MenuItem value={formData.region_id}>Загрузка...</MenuItem>
              ) : null}
              {regions?.map((r: any) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <Typography variant='h6'>Фото 3×4</Typography>
          {!locked ? (
            <Button variant='outlined' component='label' fullWidth sx={{ mt: 1 }}>
              Загрузить фото
              <input type='file' hidden accept='image/*' onChange={handleFileUpload} />
            </Button>
          ) : null}
          {photoPreviewUrl || photoSignedUrl || formData.photo_url ? (
            <Box mt={1}>
              <img
                src={
                  photoPreviewUrl ||
                  photoSignedUrl ||
                  (/^https?:\/\//i.test(formData.photo_url)
                    ? formData.photo_url
                    : supabase.storage.from('avatars').getPublicUrl(formData.photo_url).data
                        .publicUrl)
                }
                alt='Фото 3x4'
                style={{ width: '100%', maxHeight: '240px', objectFit: 'contain' }}
              />
            </Box>
          ) : null}
        </Grid>

        <Grid item xs={12}>
          <Button
            variant='contained'
            fullWidth
            onClick={() => {
              setShowValidation(true);
              if (!validation.ok) {
                setNotice({ severity: 'error', message: validation.message });
                return;
              }
              updateProfile.mutate(formData);
            }}
            disabled={updateProfile.isPending || locked || !validation.ok}
          >
            Сохранить профиль
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}

function ApplicationsTab({
  userId,
  setNotice,
}: {
  userId: string;
  setNotice: React.Dispatch<
    React.SetStateAction<{ severity: 'success' | 'error' | 'info'; message: string } | null>
  >;
}) {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['my_applications', userId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/users/me/applications`);
        return data;
      } catch (err: any) {
        const msg = err?.response?.data?.detail || 'Не удалось загрузить заявки.';
        setNotice({ severity: 'error', message: String(msg) });
        return [];
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <CircularProgress />;
  if (!applications?.length) return <Typography>У вас нет заявок.</Typography>;

  return (
    <Grid container spacing={2}>
      {applications.map((app: any) => (
        <Grid item xs={12} key={app.id}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6'>{app.competitions.name}</Typography>
            <Typography>
              Категория:{' '}
              {formatCategoryLabel({
                gender: app.competition_categories.gender,
                ageMin: app.competition_categories.age_min,
                ageMax: app.competition_categories.age_max,
                weightMin: app.competition_categories.weight_min,
                weightMax: app.competition_categories.weight_max,
                atDate: app.competitions.start_date,
              })}
            </Typography>
            <Typography>
              Статус:{' '}
              {app.status === 'pending'
                ? 'заявка подана'
                : app.status === 'approved'
                  ? 'одобрена'
                  : app.status === 'weighed'
                    ? 'взвешен(а)'
                    : app.status === 'rejected'
                      ? 'отклонена'
                      : String(app.status || '—')}
            </Typography>
            <Alert severity='info' sx={{ mt: 1 }}>
              Ваш электронный паспорт спортсмена будет активирован после верификации поданных вами
              данных 25 апреля 2026 года перед началом мандатной комиссией на месте проведения
              соревнования. Стоимость электронного паспорта составляет 1000 рублей и оплата
              производится на месте.
            </Alert>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function CompetitionsTab({
  userId,
  setNotice,
}: {
  userId: string;
  setNotice: React.Dispatch<
    React.SetStateAction<{ severity: 'success' | 'error' | 'info'; message: string } | null>
  >;
}) {
  const queryClient = useQueryClient();
  const deadline = new Date('2026-04-23T00:00:00+03:00');
  const deadlinePassed = new Date() >= deadline;
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['active_competitions'],
    queryFn: async () => {
      const { data } = await api.get(`/competitions/active`);
      return data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const cachedDashboard: any = queryClient.getQueryData(['dashboard', userId]);
  const detailsFromDashboard = cachedDashboard?.details || null;
  const { data: details } = useQuery({
    queryKey: ['details', userId],
    queryFn: async () => {
      const { data } = await api.get(`/users/me/details`);
      return data as {
        birth_date?: string | null;
        gender?: string | null;
        rank?: string | null;
        photo_url?: string | null;
      };
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: !detailsFromDashboard,
    initialData: detailsFromDashboard || undefined,
  });

  const { data: applications } = useQuery({
    queryKey: ['my_applications', userId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/users/me/applications`);
        return data as Array<{ id: string; competition_id?: string }>;
      } catch {
        return [];
      }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const appliedCompetitionIds = new Set<string>(
    (applications || [])
      .map((a: any) => String(a?.competition_id || a?.competition?.id || a?.competitions?.id || ''))
      .filter(Boolean),
  );

  const applyMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await api.post(`/applications/me`, null, { params: { category_id: categoryId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_applications', userId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
      setNotice({ severity: 'success', message: 'Заявка успешно подана.' });
    },
    onError: (err: any) => {
      setNotice({
        severity: 'error',
        message:
          err.response?.data?.detail === 'Already applied to this competition'
            ? 'Вы уже подали заявку на это соревнование.'
            : err.response?.data?.detail || 'Ошибка при подаче заявки',
      });
    },
  });

  if (isLoading) return <CircularProgress />;
  const visibleCompetitions = (competitions || []).filter((comp: any) => {
    const name = String(comp?.name || '');
    return !name.toUpperCase().includes('[TEST]');
  });
  if (!visibleCompetitions.length) return <Typography>Нет активных соревнований.</Typography>;

  const birth = details?.birth_date ? new Date(details.birth_date) : null;
  const gender = details?.gender || null;
  const normalizeGender = (g: unknown) => {
    const s = String(g ?? '')
      .trim()
      .toLowerCase();
    if (s === 'male' || s === 'm' || s === 'м') return 'male';
    if (s === 'female' || s === 'f' || s === 'ж') return 'female';
    return s;
  };
  const ageAt = (birthDate: Date, atDate: Date) => {
    const year = Number.isFinite(atDate.getTime())
      ? atDate.getFullYear()
      : new Date().getFullYear();
    return year - birthDate.getFullYear();
  };

  return (
    <Grid container spacing={2}>
      {visibleCompetitions.map((comp: any) => (
        <Grid item xs={12} key={comp.id}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6'>{comp.name}</Typography>
            <Typography color='textSecondary' gutterBottom>
              {new Date(comp.start_date).toLocaleDateString()} -{' '}
              {new Date(comp.end_date).toLocaleDateString()}
            </Typography>

            <Typography variant='subtitle2' sx={{ mt: 2, mb: 1 }}>
              Доступные категории:
            </Typography>
            {!birth || !gender ? (
              <Typography color='textSecondary' sx={{ mb: 1 }}>
                Заполните дату рождения и пол в профиле, чтобы увидеть доступные категории.
              </Typography>
            ) : null}
            <Box display='flex' flexWrap='wrap' gap={1}>
              {Array.from(
                new Map(
                  (comp.categories || [])
                    .filter((cat: any) => {
                      if (!birth || !gender) return false;
                      if (cat.gender && normalizeGender(cat.gender) !== normalizeGender(gender))
                        return false;
                      const atDate = comp.start_date ? new Date(comp.start_date) : new Date();
                      const age = ageAt(birth, atDate);
                      if (typeof cat.age_min === 'number' && age < cat.age_min) return false;
                      if (typeof cat.age_max === 'number' && age > cat.age_max) return false;
                      return true;
                    })
                    .map((cat: any) => {
                      const label = formatCategoryLabel({
                        gender: cat.gender,
                        ageMin: cat.age_min,
                        ageMax: cat.age_max,
                        weightMin: cat.weight_min,
                        weightMax: cat.weight_max,
                        atDate: comp.start_date,
                      });
                      return [label, cat] as const;
                    }),
                ).values(),
              ).map((cat: any) => (
                <Chip
                  key={cat.id}
                  label={formatCategoryLabel({
                    gender: cat.gender,
                    ageMin: cat.age_min,
                    ageMax: cat.age_max,
                    weightMin: cat.weight_min,
                    weightMax: cat.weight_max,
                    atDate: comp.start_date,
                  })}
                  onClick={() => {
                    if (deadlinePassed) {
                      setNotice({
                        severity: 'info',
                        message: 'Подача заявок закрыта (после 22 апреля 23:59).',
                      });
                      return;
                    }
                    if (appliedCompetitionIds.has(String(comp.id))) {
                      setNotice({
                        severity: 'info',
                        message: 'Вы уже подали заявку на это соревнование.',
                      });
                      return;
                    }
                    if (!birth || !gender) {
                      setNotice({
                        severity: 'info',
                        message: 'Для подачи заявки заполните дату рождения и пол в профиле.',
                      });
                      return;
                    }
                    if (window.confirm('Подать заявку в эту категорию?')) {
                      applyMutation.mutate(cat.id);
                    }
                  }}
                  color='primary'
                  variant='outlined'
                  clickable={
                    !deadlinePassed &&
                    !applyMutation.isPending &&
                    !appliedCompetitionIds.has(String(comp.id))
                  }
                />
              ))}
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
