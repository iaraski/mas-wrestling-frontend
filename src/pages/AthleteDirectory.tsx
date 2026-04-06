import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { applicationService, competitionService, userService } from '../services/api';
import { formatCategoryLabel } from '../utils/categoryFormat';

type AthleteRow = {
  athlete_id: string;
  user_id: string;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  location_id?: string | null;
  email?: string | null;
  coach_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  rank?: string | null;
  photo_url?: string | null;
};

type Competition = {
  id: string;
  name: string;
};

type CompetitionCategory = {
  id: string;
  gender: 'male' | 'female';
  age_min: number;
  age_max: number;
  weight_min: number;
  weight_max?: number | null;
};

type CompetitionDetails = {
  id: string;
  name: string;
  start_date?: string;
  categories?: CompetitionCategory[];
};

const ageAt = (birthDate: Date, atDate: Date) => {
  let age = atDate.getFullYear() - birthDate.getFullYear();
  const m = atDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && atDate.getDate() < birthDate.getDate())) age -= 1;
  return age;
};

export default function AthleteDirectory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteRow | null>(null);
  const [applyCompetitionId, setApplyCompetitionId] = useState<string>('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsAthleteId, setDetailsAthleteId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    city: '',
    location_id: '',
    coach_name: '',
    birth_date: '',
    gender: '',
    rank: '',
    photo_url: '',
  });

  const { data: competitions, isLoading: competitionsLoading } = useQuery<Competition[]>({
    queryKey: ['competitions_all'],
    queryFn: competitionService.getCompetitions,
  });

  useEffect(() => {
    if (!open) return;
    if (applyCompetitionId) return;
    if (competitions && competitions.length > 0) setApplyCompetitionId(competitions[0].id);
  }, [applyCompetitionId, competitions, open]);

  const { data: competitionDetails } = useQuery<CompetitionDetails>({
    queryKey: ['competition_details', applyCompetitionId],
    queryFn: () => competitionService.getCompetitionDetails(applyCompetitionId),
    enabled: Boolean(applyCompetitionId) && open,
  });

  const { data: athletes, isLoading: athletesLoading } = useQuery<AthleteRow[]>({
    queryKey: ['athletes', searchQuery],
    queryFn: () => userService.getAthletes(searchQuery || undefined),
  });

  const { data: athleteDetails, isLoading: athleteDetailsLoading } = useQuery({
    queryKey: ['athlete_details', detailsAthleteId],
    queryFn: async () => {
      if (!detailsAthleteId) return null;
      return userService.getAthleteDetails(detailsAthleteId);
    },
    enabled: Boolean(detailsAthleteId),
    retry: false,
  });

  useEffect(() => {
    if (!detailsOpen) return;
    setImageLoaded(false);
  }, [detailsOpen, detailsAthleteId]);

  useEffect(() => {
    if (!athleteDetails) return;
    setEditForm({
      full_name: athleteDetails.full_name || '',
      phone: athleteDetails.phone || '',
      city: athleteDetails.city || '',
      location_id: athleteDetails.location_id || '',
      coach_name: athleteDetails.coach_name || '',
      birth_date: athleteDetails.birth_date || '',
      gender: athleteDetails.gender || '',
      rank: athleteDetails.rank || '',
      photo_url: athleteDetails.photo_url || '',
    });
    setEditMode(false);
  }, [athleteDetails]);

  const eligibleCategories = useMemo(() => {
    if (!selectedAthlete || !competitionDetails?.categories) return [];
    if (!selectedAthlete.birth_date || !selectedAthlete.gender) return [];
    const birth = new Date(selectedAthlete.birth_date);
    const at = competitionDetails.start_date ? new Date(competitionDetails.start_date) : new Date();
    const a = ageAt(birth, at);
    return competitionDetails.categories.filter((c) => {
      if (c.gender !== selectedAthlete.gender) return false;
      if (a < c.age_min || a > c.age_max) return false;
      return true;
    });
  }, [selectedAthlete, competitionDetails]);

  const applyMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!selectedAthlete) throw new Error('Athlete not selected');
      return applicationService.adminApplyAthleteToCategory({
        athlete_id: selectedAthlete.athlete_id,
        category_id: categoryId,
      });
    },
    onSuccess: () => {
      setOpen(false);
      setSelectedAthlete(null);
      setApplyCompetitionId('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!detailsAthleteId) throw new Error('Athlete not selected');
      return userService.updateAthleteDetails(detailsAthleteId, {
        full_name: editForm.full_name,
        phone: editForm.phone || null,
        city: editForm.city,
        location_id: editForm.location_id || null,
        coach_name: editForm.coach_name,
        birth_date: editForm.birth_date || null,
        gender: editForm.gender || null,
        rank: editForm.rank || null,
        photo_url: editForm.photo_url || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes', searchQuery] });
      queryClient.invalidateQueries({ queryKey: ['athlete_details', detailsAthleteId] });
      setEditMode(false);
    },
  });

  const editableMutation = useMutation({
    mutationFn: async (editable: boolean) => {
      if (!detailsAthleteId) throw new Error('Athlete not selected');
      return userService.setAthleteEditable(detailsAthleteId, editable);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes', searchQuery] });
      queryClient.invalidateQueries({ queryKey: ['athlete_details', detailsAthleteId] });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `admin-athlete-${Date.now()}-${Math.random()}.${fileExt}`;
    const filePath = `documents/${fileName}`;
    const { error } = await supabase.storage.from('avatars').upload(filePath, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });
    if (error) throw error;
    setEditForm((p) => ({ ...p, photo_url: filePath }));
  };

  const openApplyDialog = (athlete: AthleteRow) => {
    setSelectedAthlete(athlete);
    setOpen(true);
  };

  const openDetailsDialog = (athlete: AthleteRow) => {
    setDetailsAthleteId(athlete.athlete_id);
    setDetailsOpen(true);
  };

  return (
    <Container maxWidth='lg' sx={{ mt: 4 }}>
      <Box display='flex' alignItems='center' mb={2}>
        <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant='h4'>Пользователи</Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display='flex' gap={2} flexWrap='wrap' alignItems='center'>
          <TextField
            label='Поиск (ФИО)'
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ minWidth: 320 }}
          />
          <Button variant='contained' onClick={() => setSearchQuery(searchText.trim())}>
            Найти
          </Button>
        </Box>
      </Paper>

      {competitionsLoading || athletesLoading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ФИО</TableCell>
                <TableCell>Пол</TableCell>
                <TableCell>Дата рождения</TableCell>
                <TableCell>Тренер</TableCell>
                <TableCell>Телефон</TableCell>
                <TableCell>Город</TableCell>
                <TableCell align='right'>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(athletes || []).map((a) => (
                <TableRow key={a.athlete_id}>
                  <TableCell>{a.full_name || '—'}</TableCell>
                  <TableCell>
                    {a.gender ? <Chip label={a.gender === 'male' ? 'М' : 'Ж'} size='small' /> : '—'}
                  </TableCell>
                  <TableCell>{a.birth_date || '—'}</TableCell>
                  <TableCell>{a.coach_name || '—'}</TableCell>
                  <TableCell>{a.phone || '—'}</TableCell>
                  <TableCell>{a.city || '—'}</TableCell>
                  <TableCell align='right'>
                    <Box display='flex' gap={1} justifyContent='flex-end'>
                      <Button variant='text' size='small' onClick={() => openDetailsDialog(a)}>
                        Подробнее
                      </Button>
                      <Button
                        variant='outlined'
                        size='small'
                        startIcon={<PersonAddIcon />}
                        onClick={() => openApplyDialog(a)}
                      >
                        Добавить
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {!athletes?.length ? (
                <TableRow>
                  <TableCell colSpan={7} align='center'>
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Добавить спортсмена на соревнование</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Соревнование</InputLabel>
            <Select
              value={applyCompetitionId}
              label='Соревнование'
              onChange={(e) => setApplyCompetitionId(String(e.target.value))}
            >
              {(competitions || []).map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography sx={{ mb: 1 }}>
            {selectedAthlete?.full_name || '—'} • {competitionDetails?.name || '—'}
          </Typography>
          {!selectedAthlete?.birth_date || !selectedAthlete?.gender ? (
            <Typography color='textSecondary'>
              У спортсмена не заполнены дата рождения и/или пол.
            </Typography>
          ) : eligibleCategories.length === 0 ? (
            <Typography color='textSecondary'>Нет подходящих категорий.</Typography>
          ) : (
            <Box display='flex' flexWrap='wrap' gap={1}>
              {eligibleCategories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={formatCategoryLabel({
                    gender: cat.gender,
                    ageMin: cat.age_min,
                    ageMax: cat.age_max,
                    weightMin: cat.weight_min,
                    weightMax: cat.weight_max,
                    atDate: competitionDetails?.start_date || null,
                  })}
                  onClick={() => applyMutation.mutate(cat.id)}
                  clickable
                  color='primary'
                  variant='outlined'
                  disabled={applyMutation.isPending}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Данные спортсмена</DialogTitle>
        <DialogContent dividers>
          {athleteDetailsLoading ? (
            <CircularProgress />
          ) : athleteDetails ? (
            <Box display='flex' flexDirection='column' gap={2}>
              <Box display='flex' alignItems='center' justifyContent='space-between'>
                <Typography variant='subtitle2'>Редактировать</Typography>
                <Switch checked={editMode} onChange={(_, v) => setEditMode(v)} />
              </Box>
              <Box display='flex' alignItems='center' justifyContent='space-between'>
                <Typography variant='subtitle2'>Разрешить редактирование спортсмену</Typography>
                <Switch
                  checked={!athleteDetails.locked}
                  onChange={(_, v) => editableMutation.mutate(v)}
                  disabled={editableMutation.isPending}
                />
              </Box>
              <TextField
                label='ФИО'
                value={editForm.full_name}
                onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                fullWidth
                disabled={!editMode}
              />
              <TextField
                label='Телефон'
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                fullWidth
                disabled={!editMode}
              />
              <TextField
                label='Город'
                value={editForm.city}
                onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                fullWidth
                disabled={!editMode}
              />
              <TextField
                label='Регион (location_id)'
                value={editForm.location_id}
                onChange={(e) => setEditForm((p) => ({ ...p, location_id: e.target.value }))}
                fullWidth
                disabled={!editMode}
              />
              <TextField
                label='ФИО тренера'
                value={editForm.coach_name}
                onChange={(e) => setEditForm((p) => ({ ...p, coach_name: e.target.value }))}
                fullWidth
                disabled={!editMode}
              />
              <TextField
                type='date'
                label='Дата рождения'
                InputLabelProps={{ shrink: true }}
                value={editForm.birth_date}
                onChange={(e) => setEditForm((p) => ({ ...p, birth_date: e.target.value }))}
                fullWidth
                disabled={!editMode}
              />
              <FormControl fullWidth disabled={!editMode}>
                <InputLabel>Пол</InputLabel>
                <Select
                  value={editForm.gender}
                  label='Пол'
                  onChange={(e) => setEditForm((p) => ({ ...p, gender: String(e.target.value) }))}
                >
                  <MenuItem value='male'>Мужской</MenuItem>
                  <MenuItem value='female'>Женский</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label='Разряд'
                value={editForm.rank}
                onChange={(e) => setEditForm((p) => ({ ...p, rank: e.target.value }))}
                fullWidth
                disabled={!editMode}
              />

              <Box>
                {editMode ? (
                  <Button variant='outlined' component='label' fullWidth>
                    Загрузить фото 3×4
                    <input type='file' hidden accept='image/*' onChange={handlePhotoUpload} />
                  </Button>
                ) : null}
                {editForm.photo_url ? (
                  <Box mt={1}>
                    {!imageLoaded && (
                      <Skeleton
                        variant='rectangular'
                        width='100%'
                        height={200}
                        sx={{ borderRadius: '4px' }}
                      />
                    )}
                    <Box
                      component='img'
                      src={
                        editForm.photo_url.startsWith('http')
                          ? editForm.photo_url
                          : editForm.photo_url.includes('documents/')
                            ? supabase.storage.from('avatars').getPublicUrl(editForm.photo_url).data
                                .publicUrl
                            : editForm.photo_url
                      }
                      alt='Фото 3x4'
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                      sx={{
                        width: '100%',
                        maxHeight: '240px',
                        objectFit: 'contain',
                        display: imageLoaded ? 'block' : 'none',
                        borderRadius: '4px',
                        border: '1px solid #eee',
                      }}
                    />
                  </Box>
                ) : null}
              </Box>
            </Box>
          ) : (
            <Typography color='textSecondary'>Нет данных</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Закрыть</Button>
          <Button
            variant='contained'
            onClick={() => updateMutation.mutate()}
            disabled={!editMode || updateMutation.isPending}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
