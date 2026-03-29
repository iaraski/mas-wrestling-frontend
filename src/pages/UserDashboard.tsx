import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Tabs, Tab, CircularProgress, Grid, TextField, Button, Alert, Select, MenuItem, InputLabel, FormControl, Chip
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export default function UserDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);

  if (!user) return null;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Личный кабинет спортсмена
      </Typography>
      
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)} variant="fullWidth">
          <Tab label="Профиль" />
          <Tab label="Паспортные данные" />
          <Tab label="Мои заявки" />
          <Tab label="Соревнования" />
        </Tabs>
      </Paper>

      {tab === 0 && <ProfileTab userId={user.id} />}
      {tab === 1 && <PassportTab userId={user.id} />}
      {tab === 2 && <ApplicationsTab userId={user.id} />}
      {tab === 3 && <CompetitionsTab userId={user.id} />}
    </Box>
  );
}

function ProfileTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    city: '',
    country_id: '',
    district_id: '',
    region_id: '',
    coach_name: '',
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/users/me/profile`, { params: { user_id: userId } });
      return data;
    },
    retry: false
  });

  const { data: athlete } = useQuery({
    queryKey: ['athlete', userId],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/users/me/athlete`, { params: { user_id: userId } });
      return data;
    },
    retry: false
  });

  const { data: countries } = useQuery({
    queryKey: ['locations', 'country'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/locations/?type=country`);
      return data;
    }
  });

  const { data: districts } = useQuery({
    queryKey: ['locations', 'district', formData.country_id],
    queryFn: async () => {
      if (!formData.country_id) return [];
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/locations/?type=district&parent_id=${formData.country_id}`);
      return data;
    },
    enabled: !!formData.country_id
  });

  const { data: regions } = useQuery({
    queryKey: ['locations', 'region', formData.district_id],
    queryFn: async () => {
      if (!formData.district_id) return [];
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/locations/?type=region&parent_id=${formData.district_id}`);
      return data;
    },
    enabled: !!formData.district_id
  });

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        city: profile.city || '',
        region_id: profile.location_id || '',
        district_id: profile.location?.parent?.id || '',
        country_id: profile.location?.parent?.parent?.id || '',
      }));
    }
    if (athlete) {
      setFormData(prev => ({
        ...prev,
        coach_name: athlete.coach_name || ''
      }));
    }
  }, [profile, athlete]);

  const updateProfile = useMutation({
    mutationFn: async (data: typeof formData) => {
      await axios.put(`${import.meta.env.VITE_API_URL}/users/me/profile?user_id=${userId}`, {
        full_name: data.full_name,
        phone: data.phone,
        city: data.city,
        location_id: data.region_id
      });
      await axios.put(`${import.meta.env.VITE_API_URL}/users/me/athlete?user_id=${userId}&coach_name=${data.coach_name}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['athlete', userId] });
      alert('Профиль сохранен!');
    }
  });

  if (profileLoading) return <CircularProgress />;

  return (
    <Paper sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6">Личные данные</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="ФИО (полностью)"
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Телефон"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="ФИО Тренера"
            value={formData.coach_name}
            onChange={e => setFormData({ ...formData, coach_name: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Населенный пункт (город/село)"
            value={formData.city}
            onChange={e => setFormData({ ...formData, city: e.target.value })}
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6">Регион</Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Страна</InputLabel>
            <Select
              value={formData.country_id}
              label="Страна"
              onChange={e => setFormData({ ...formData, country_id: e.target.value, district_id: '', region_id: '' })}
            >
              {countries?.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth disabled={!formData.country_id}>
            <InputLabel>Округ</InputLabel>
            <Select
              value={formData.district_id}
              label="Округ"
              onChange={e => setFormData({ ...formData, district_id: e.target.value, region_id: '' })}
            >
              {districts?.map((d: any) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth disabled={!formData.district_id}>
            <InputLabel>Регион</InputLabel>
            <Select
              value={formData.region_id}
              label="Регион"
              onChange={e => setFormData({ ...formData, region_id: e.target.value })}
            >
              {regions?.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Button variant="contained" onClick={() => updateProfile.mutate(formData)} disabled={updateProfile.isPending}>
            Сохранить профиль
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}

function PassportTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    series: '',
    number: '',
    issued_by: '',
    issue_date: '',
    birth_date: '',
    gender: '',
    rank: '',
    photo_url: '',
    passport_scan_url: '',
  });

  const { data: athlete } = useQuery({
    queryKey: ['athlete', userId],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/users/me/athlete`, { params: { user_id: userId } });
      return data;
    },
    retry: false
  });

  useEffect(() => {
    if (athlete?.passports?.[0]) {
      const p = athlete.passports[0];
      setFormData({
        series: p.series || '',
        number: p.number || '',
        issued_by: p.issued_by || '',
        issue_date: p.issue_date || '',
        birth_date: p.birth_date || '',
        gender: p.gender || '',
        rank: p.rank || '',
        photo_url: p.photo_url || '',
        passport_scan_url: p.passport_scan_url || '',
      });
    }
  }, [athlete]);

  const updatePassport = useMutation({
    mutationFn: async (data: typeof formData) => {
      await axios.put(`${import.meta.env.VITE_API_URL}/users/me/passport?user_id=${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete', userId] });
      alert('Паспортные данные сохранены!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Ошибка сохранения');
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photo_url' | 'passport_scan_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars') // Or create a new bucket 'documents' in supabase
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // In this setup, we'll store the supabase storage path instead of telegram file_id
      // The backend proxy might need to be adjusted or frontend handles it directly if it's not a tg file
      // For simplicity, we just save the storage path.
      setFormData(prev => ({ ...prev, [field]: filePath }));
      alert('Файл загружен!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Ошибка при загрузке файла');
    }
  };

  const isVerified = athlete?.passports?.[0]?.is_verified;

  return (
    <Paper sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6">
            Паспортные данные 
            {isVerified && <Chip label="Подтвержден" color="success" size="small" sx={{ ml: 2 }} />}
          </Typography>
          {isVerified && <Alert severity="info" sx={{ mt: 1 }}>Ваш профиль подтвержден. Редактирование запрещено.</Alert>}
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Серия паспорта"
            value={formData.series}
            onChange={e => setFormData({ ...formData, series: e.target.value })}
            disabled={isVerified}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Номер паспорта"
            value={formData.number}
            onChange={e => setFormData({ ...formData, number: e.target.value })}
            disabled={isVerified}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Кем выдан"
            value={formData.issued_by}
            onChange={e => setFormData({ ...formData, issued_by: e.target.value })}
            disabled={isVerified}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="date"
            label="Дата выдачи"
            InputLabelProps={{ shrink: true }}
            value={formData.issue_date}
            onChange={e => setFormData({ ...formData, issue_date: e.target.value })}
            disabled={isVerified}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="date"
            label="Дата рождения"
            InputLabelProps={{ shrink: true }}
            value={formData.birth_date}
            onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
            disabled={isVerified}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth disabled={isVerified}>
            <InputLabel>Пол</InputLabel>
            <Select
              value={formData.gender}
              label="Пол"
              onChange={e => setFormData({ ...formData, gender: e.target.value })}
            >
              <MenuItem value="male">Мужской</MenuItem>
              <MenuItem value="female">Женский</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth disabled={isVerified}>
            <InputLabel>Разряд</InputLabel>
            <Select
              value={formData.rank}
              label="Разряд"
              onChange={e => setFormData({ ...formData, rank: e.target.value })}
            >
              <MenuItem value="Б/Р">Без разряда</MenuItem>
              <MenuItem value="3 юн">3 юношеский</MenuItem>
              <MenuItem value="2 юн">2 юношеский</MenuItem>
              <MenuItem value="1 юн">1 юношеский</MenuItem>
              <MenuItem value="3">3 спортивный</MenuItem>
              <MenuItem value="2">2 спортивный</MenuItem>
              <MenuItem value="1">1 спортивный</MenuItem>
              <MenuItem value="КМС">КМС</MenuItem>
              <MenuItem value="МС">МС</MenuItem>
              <MenuItem value="МСМК">МСМК</MenuItem>
              <MenuItem value="ЗМС">ЗМС</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>Фотография (лицо 3х4)</Typography>
          {!isVerified && (
            <Button variant="outlined" component="label" fullWidth>
              Загрузить фото
              <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'photo_url')} />
            </Button>
          )}
          {formData.photo_url && (
            <Box mt={1}>
              {formData.photo_url.includes('documents/') ? (
                <img src={supabase.storage.from('avatars').getPublicUrl(formData.photo_url).data.publicUrl} alt="Фото" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
              ) : (
                <img src={`${import.meta.env.VITE_API_URL}/api/v1/tg-file/${formData.photo_url}`} alt="Фото (из Telegram)" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }} />
              )}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>Скан паспорта (разворот)</Typography>
          {!isVerified && (
            <Button variant="outlined" component="label" fullWidth>
              Загрузить скан
              <input type="file" hidden accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'passport_scan_url')} />
            </Button>
          )}
          {formData.passport_scan_url && (
            <Box mt={1}>
              {formData.passport_scan_url.includes('documents/') ? (
                <Typography>Файл загружен (Supabase Storage)</Typography>
              ) : (
                <Typography>Файл загружен (Telegram)</Typography>
              )}
            </Box>
          )}
        </Grid>

        {!isVerified && (
          <Grid item xs={12}>
            <Button variant="contained" onClick={() => updatePassport.mutate(formData)} disabled={updatePassport.isPending}>
              Сохранить паспортные данные
            </Button>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
}

function ApplicationsTab({ userId }: { userId: string }) {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['my_applications', userId],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/users/me/applications`, { params: { user_id: userId } });
      return data;
    }
  });

  if (isLoading) return <CircularProgress />;
  if (!applications?.length) return <Typography>У вас нет заявок.</Typography>;

  return (
    <Grid container spacing={2}>
      {applications.map((app: any) => (
        <Grid item xs={12} key={app.id}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">{app.competitions.name}</Typography>
            <Typography>Категория: {app.competition_categories.gender === 'male' ? 'М' : 'Ж'}, {app.competition_categories.age_min}-{app.competition_categories.age_max} лет</Typography>
            <Typography>Статус: {app.status}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function CompetitionsTab({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['active_competitions'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/competitions/active`);
      return data;
    }
  });

  const { data: athlete } = useQuery({
    queryKey: ['athlete', userId],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/users/me/athlete`, { params: { user_id: userId } });
      return data;
    },
    retry: false
  });

  const applyMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await axios.post(`${import.meta.env.VITE_API_URL}/applications/me?user_id=${userId}&category_id=${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_applications', userId] });
      alert('Заявка успешно подана!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Ошибка при подаче заявки');
    }
  });

  if (isLoading) return <CircularProgress />;
  if (!competitions?.length) return <Typography>Нет активных соревнований.</Typography>;

  return (
    <Grid container spacing={2}>
      {competitions.map((comp: any) => (
        <Grid item xs={12} key={comp.id}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">{comp.name}</Typography>
            <Typography color="textSecondary" gutterBottom>
              {new Date(comp.start_date).toLocaleDateString()} - {new Date(comp.end_date).toLocaleDateString()}
            </Typography>
            
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Доступные категории:</Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {comp.categories?.map((cat: any) => (
                <Chip 
                  key={cat.id} 
                  label={`${cat.gender === 'male' ? 'М' : 'Ж'} | ${cat.age_min}-${cat.age_max} лет | до ${cat.weight_max || 'свыше ' + cat.weight_min} кг`}
                  onClick={() => {
                    if (!athlete?.passports?.[0]) {
                      alert('Для подачи заявки необходимо заполнить паспортные данные!');
                      return;
                    }
                    if (window.confirm('Подать заявку в эту категорию?')) {
                      applyMutation.mutate(cat.id);
                    }
                  }}
                  color="primary"
                  variant="outlined"
                  clickable
                />
              ))}
            </Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
