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
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import api, { locationService } from '../services/api';
import { formatWeightLabel } from '../utils/categoryFormat';

export default function UserDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [notice, setNotice] = useState<{
    severity: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!user) return null;

  return (
    <Container maxWidth='md' sx={{ mt: { xs: 2, sm: 4 }, mb: 4 }}>
      <Typography variant='h4' gutterBottom sx={{ fontSize: { xs: 24, sm: 34 } }}>
        Личный кабинет спортсмена
      </Typography>

      {notice ? (
        <Box mb={2}>
          <Alert severity={notice.severity} onClose={() => setNotice(null)}>
            {notice.message}
          </Alert>
        </Box>
      ) : null}

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
      {tab === 1 && <ApplicationsTab setNotice={setNotice} />}
      {tab === 2 && <CompetitionsTab setNotice={setNotice} />}
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
  const [showValidation, setShowValidation] = useState(false);

  const { data: reg } = useQuery({
    queryKey: ['registration', userId],
    queryFn: async () => {
      const { data } = await api.get(`/users/me/registration`);
      return data as { locked: boolean; stage?: string | null };
    },
    retry: false,
  });

  const locked = Boolean(reg?.locked);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/users/me/profile`);
        return data;
      } catch {
        setNotice({ severity: 'error', message: 'Не удалось загрузить профиль.' });
        return null;
      }
    },
    retry: false,
  });

  const { data: locationPath } = useQuery({
    queryKey: ['location_path', profile?.location_id],
    queryFn: async () => {
      if (!profile?.location_id) return null;
      try {
        return await locationService.getLocationPath(String(profile.location_id));
      } catch {
        return null;
      }
    },
    enabled: Boolean(profile?.location_id),
    retry: false,
  });

  const { data: athlete } = useQuery({
    queryKey: ['athlete', userId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/users/me/athlete`);
        return data;
      } catch {
        setNotice({ severity: 'error', message: 'Не удалось загрузить данные спортсмена.' });
        return null;
      }
    },
    retry: false,
  });

  const { data: details } = useQuery({
    queryKey: ['details', userId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/users/me/details`);
        return data as {
          birth_date?: string | null;
          rank?: string | null;
          photo_url?: string | null;
          gender?: string | null;
        };
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const { data: countries } = useQuery({
    queryKey: ['locations', 'country'],
    queryFn: async () => {
      const { data } = await api.get(`/locations/`, { params: { type: 'country' } });
      return data;
    },
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
  });

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        city: profile.city || '',
        region_id: '',
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

    const fullName = String(data.full_name || '').trim();
    const fullNameParts = fullName.split(/\s+/).filter(Boolean);
    if (!fullName) {
      errors.full_name = 'Заполните ФИО.';
    } else if (fullNameParts.length < 3) {
      errors.full_name = 'ФИО должно быть полностью (минимум 3 слова).';
    }

    const coachName = String(data.coach_name || '').trim();
    if (!coachName) {
      errors.coach_name = 'Заполните ФИО тренера.';
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
      errors.photo_url = 'Загрузите фото 3×4.';
    }

    const messages = Object.values(errors).filter(Boolean) as string[];
    return { ok: messages.length === 0, errors, message: messages[0] || '' };
  };

  const validation = validateProfile(formData);

  const saveProfile = async (data: typeof formData) => {
    const check = validateProfile(data);
    if (!check.ok) throw new Error(check.message);
    const fullName = String(data.full_name || '').trim();
    await api.put(`/users/me/profile`, {
      full_name: fullName,
      phone: String(data.phone || '').replace(/\D/g, '') || null,
      city: String(data.city || '').trim(),
      location_id: data.region_id ? data.region_id : null,
    });
    await api.put(`/users/me/athlete`, null, { params: { coach_name: data.coach_name } });
    await api.put(`/users/me/details`, {
      birth_date: data.birth_date ? data.birth_date : null,
      gender: data.gender || null,
      rank: data.rank || null,
      photo_url: data.photo_url || null,
    });
  };

  const updateProfile = useMutation({
    mutationFn: saveProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['athlete', userId] });
      queryClient.invalidateQueries({ queryKey: ['details', userId] });
      setNotice({ severity: 'success', message: 'Профиль сохранён.' });
    },
    onError: (err: any) => {
      const msg = err?.message || err?.response?.data?.detail || 'Не удалось сохранить профиль.';
      setNotice({ severity: 'error', message: String(msg) });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const check = validateProfile(formData);
      if (!check.ok) throw new Error(check.message);
      await updateProfile.mutateAsync(formData);
      await api.post(`/users/me/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['athlete', userId] });
      queryClient.invalidateQueries({ queryKey: ['details', userId] });
      setNotice({ severity: 'success', message: 'Регистрация завершена. Профиль заблокирован.' });
    },
    onError: (err: any) => {
      const msg =
        err?.message || err?.response?.data?.detail || 'Не удалось завершить регистрацию.';
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });
      if (uploadError) throw uploadError;
      setFormData((prev) => ({ ...prev, photo_url: filePath }));
      setNotice({ severity: 'success', message: 'Фото загружено.' });
    } catch (e: any) {
      const msg = e?.message || e?.error_description || 'Ошибка при загрузке фото.';
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

  if (profileLoading) return <CircularProgress />;

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      {locked ? (
        <Box mb={2}>
          <Alert severity='info'>
            Профиль заблокирован. Для изменений обратитесь к администратору.
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
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            disabled={locked}
            error={showValidation && Boolean(validation.errors.full_name)}
            helperText={showValidation ? validation.errors.full_name : ''}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label='ФИО Тренера'
            value={formData.coach_name}
            onChange={(e) => setFormData({ ...formData, coach_name: e.target.value })}
            disabled={locked}
            error={showValidation && Boolean(validation.errors.coach_name)}
            helperText={showValidation ? validation.errors.coach_name : ''}
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
          <TextField
            fullWidth
            type='date'
            label='Дата рождения'
            InputLabelProps={{ shrink: true }}
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            disabled={locked}
            error={showValidation && Boolean(validation.errors.birth_date)}
            helperText={showValidation ? validation.errors.birth_date : ''}
          />
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
          <FormControl fullWidth>
            <InputLabel>Страна</InputLabel>
            <Select
              value={formData.country_id}
              label='Страна'
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
              onChange={(e) =>
                setFormData({ ...formData, district_id: e.target.value, region_id: '' })
              }
              disabled={locked || !formData.country_id}
            >
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
              onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
              disabled={locked || !formData.district_id}
            >
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
                  supabase.storage.from('avatars').getPublicUrl(formData.photo_url).data.publicUrl
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
            disabled={
              updateProfile.isPending || completeMutation.isPending || locked || !validation.ok
            }
          >
            Сохранить профиль
          </Button>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant='outlined'
            fullWidth
            onClick={() => {
              setShowValidation(true);
              completeMutation.mutate();
            }}
            disabled={completeMutation.isPending || updateProfile.isPending || locked}
          >
            Завершить регистрацию
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}

function ApplicationsTab({
  setNotice,
}: {
  setNotice: React.Dispatch<
    React.SetStateAction<{ severity: 'success' | 'error' | 'info'; message: string } | null>
  >;
}) {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['my_applications'],
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
              Категория: {app.competition_categories.gender === 'male' ? 'М' : 'Ж'},{' '}
              {app.competition_categories.age_min}-{app.competition_categories.age_max} лет
            </Typography>
            <Typography>Статус: {app.status}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function CompetitionsTab({
  setNotice,
}: {
  setNotice: React.Dispatch<
    React.SetStateAction<{ severity: 'success' | 'error' | 'info'; message: string } | null>
  >;
}) {
  const queryClient = useQueryClient();
  const deadline = new Date('2026-04-18T00:00:00+03:00');
  const deadlinePassed = new Date() >= deadline;
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['active_competitions'],
    queryFn: async () => {
      const { data } = await api.get(`/competitions/active`);
      return data;
    },
  });

  const { data: reg } = useQuery({
    queryKey: ['registration_me'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/users/me/registration`);
        return data;
      } catch {
        setNotice({ severity: 'error', message: 'Не удалось загрузить статус регистрации.' });
        return null;
      }
    },
    retry: false,
  });

  const { data: details } = useQuery({
    queryKey: ['details_me'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/users/me/details`);
        return data as { birth_date?: string | null; gender?: string | null };
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await api.post(`/applications/me`, null, { params: { category_id: categoryId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_applications'] });
      setNotice({ severity: 'success', message: 'Заявка успешно подана.' });
    },
    onError: (err: any) => {
      setNotice({
        severity: 'error',
        message: err.response?.data?.detail || 'Ошибка при подаче заявки',
      });
    },
  });

  if (isLoading) return <CircularProgress />;
  if (!competitions?.length) return <Typography>Нет активных соревнований.</Typography>;

  const birth = details?.birth_date ? new Date(details.birth_date) : null;
  const gender = details?.gender || null;
  const ageAt = (birthDate: Date, atDate: Date) => {
    let age = atDate.getFullYear() - birthDate.getFullYear();
    const m = atDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && atDate.getDate() < birthDate.getDate())) age -= 1;
    return age;
  };

  return (
    <Grid container spacing={2}>
      {competitions.map((comp: any) => (
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
              {comp.categories
                ?.filter((cat: any) => {
                  if (!birth || !gender) return false;
                  if (cat.gender && cat.gender !== gender) return false;
                  const atDate = comp.start_date ? new Date(comp.start_date) : new Date();
                  const age = ageAt(birth, atDate);
                  if (typeof cat.age_min === 'number' && age < cat.age_min) return false;
                  if (typeof cat.age_max === 'number' && age > cat.age_max) return false;
                  return true;
                })
                .map((cat: any) => (
                  <Chip
                    key={cat.id}
                    label={`${cat.gender === 'male' ? 'М' : 'Ж'} | ${cat.age_min}-${cat.age_max} лет | ${formatWeightLabel(
                      cat.weight_min,
                      cat.weight_max,
                    )}`}
                    onClick={() => {
                      if (deadlinePassed) {
                        setNotice({
                          severity: 'info',
                          message: 'Подача заявок закрыта (после 18 апреля 00:00).',
                        });
                        return;
                      }
                      if (!reg?.locked) {
                        setNotice({
                          severity: 'info',
                          message: 'Для подачи заявки заполните профиль и завершите регистрацию.',
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
                    clickable={!deadlinePassed && Boolean(reg?.locked)}
                  />
                ))}
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
