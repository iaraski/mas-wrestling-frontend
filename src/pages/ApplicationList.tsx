import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
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
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { applicationService, competitionService, userService } from '../services/api';
import { formatWeightLabel } from '../utils/categoryFormat';

type Gender = 'male' | 'female';

type CompetitionCategory = {
  id: string;
  gender: Gender;
  age_min: number;
  age_max: number;
  weight_min: number;
  weight_max?: number | null;
};

type Competition = {
  id: string;
  name: string;
  start_date?: string;
  categories: CompetitionCategory[];
};

type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'weighed';

type Application = {
  id: string;
  created_at?: string | null;
  athlete_name?: string | null;
  athlete_city?: string | null;
  category_description?: string | null;
  declared_weight?: number | null;
  actual_weight?: number | null;
  draw_number?: number | null;
  status: ApplicationStatus;
};

const ApplicationList = () => {
  const { compId } = useParams<{ compId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: competition } = useQuery<Competition>({
    queryKey: ['competition', compId],
    queryFn: () => competitionService.getCompetitionDetails(compId!),
    enabled: !!compId,
  });

  const { data: applications, isLoading } = useQuery<Application[]>({
    queryKey: ['applications', compId],
    queryFn: () => applicationService.getApplications(compId!),
    enabled: !!compId,
  });

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [actualWeight, setActualWeight] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<number>(0);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [addExistingSearchText, setAddExistingSearchText] = useState('');
  const [addExistingSearchQuery, setAddExistingSearchQuery] = useState('');
  const [addExistingAthlete, setAddExistingAthlete] = useState<any | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [sortField, setSortField] = useState<
    'created_at' | 'athlete_name' | 'category' | 'status' | 'weight' | 'draw_number'
  >('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editProfile, setEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    city: '',
    location_id: '',
    coach_name: '',
    birth_date: '',
    rank: '',
    photo_url: '',
  });

  const { data: selectedAppDetails, isLoading: isLoadingDetails } = useQuery<any>({
    queryKey: ['applicationDetails', selectedAppId],
    queryFn: () => applicationService.getApplicationDetails(selectedAppId!),
    enabled: !!selectedAppId,
  });

  // Reset image loader only when a different application is selected
  useEffect(() => {
    setImageLoaded(false);
  }, [selectedAppId]);

  const { data: athletesForAdd, isLoading: athletesForAddLoading } = useQuery<any[]>({
    queryKey: ['athletes_for_add', addExistingSearchQuery, addExistingOpen],
    queryFn: () => userService.getAthletes(addExistingSearchQuery || undefined),
    enabled: addExistingOpen,
    retry: false,
  });

  const adminApplyFromExistingMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!addExistingAthlete) throw new Error('Выберите спортсмена');
      return applicationService.adminApplyAthleteToCategory({
        athlete_id: String(addExistingAthlete.athlete_id),
        category_id: categoryId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', compId] });
      setAddExistingOpen(false);
      setAddExistingAthlete(null);
      setAddExistingSearchText('');
      setAddExistingSearchQuery('');
    },
  });

  useEffect(() => {
    if (selectedAppId && selectedAppDetails) {
      setActualWeight(selectedAppDetails.actual_weight?.toString() || '');
      setSelectedCategoryId(selectedAppDetails.category_id || '');
      setEditForm({
        full_name: selectedAppDetails.athlete_name || '',
        city: selectedAppDetails.athlete_city || '',
        location_id: selectedAppDetails.athlete_location_id || '',
        coach_name: selectedAppDetails.coach_name || '',
        birth_date: selectedAppDetails.passport?.birth_date || '',
        rank: selectedAppDetails.passport?.rank || '',
        photo_url: selectedAppDetails.passport?.photo_url || '',
      });
      setEditProfile(false);
    }
  }, [selectedAppDetails, selectedAppId]);

  const updateApplicationMutation = useMutation({
    mutationFn: ({
      appId,
      status,
      categoryId,
      weight,
    }: {
      appId: string;
      status: ApplicationStatus;
      categoryId?: string;
      weight?: number | null;
    }) =>
      applicationService.updateApplication(appId, {
        status,
        category_id: categoryId,
        actual_weight: weight,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', compId] });
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      // Не закрываем модалку, чтобы секретарь мог видеть изменения
    },
  });

  const updateAthleteProfileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppId) throw new Error('Нет заявки');
      if (
        !editForm.full_name ||
        !editForm.city ||
        !editForm.location_id ||
        !editForm.coach_name ||
        !editForm.birth_date ||
        !editForm.rank ||
        !editForm.photo_url
      ) {
        throw new Error('Заполните обязательные поля профиля.');
      }
      return applicationService.adminUpdateAthleteProfile(selectedAppId, {
        full_name: editForm.full_name,
        city: editForm.city,
        location_id: editForm.location_id,
        coach_name: editForm.coach_name,
        birth_date: editForm.birth_date,
        rank: editForm.rank,
        photo_url: editForm.photo_url,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
      queryClient.invalidateQueries({ queryKey: ['applications', compId] });
      setEditProfile(false);
    },
  });

  const handleEditPhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `admin-edit-${Date.now()}-${Math.random()}.${fileExt}`;
    const filePath = `documents/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });
    if (uploadError) throw uploadError;
    setEditForm((p) => ({ ...p, photo_url: filePath }));
  };

  const pendingAndRejectedApps =
    applications?.filter((app) => app.status === 'pending' || app.status === 'rejected') ?? [];
  const mandateApps =
    applications?.filter((app) => app.status === 'approved' || app.status === 'weighed') ?? [];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    setStatusFilter('all');
  };

  const categoryLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of competition?.categories || []) {
      map.set(
        cat.id,
        `${cat.gender === 'male' ? 'М' : 'Ж'}, ${cat.age_min}-${cat.age_max} л, ${formatWeightLabel(
          cat.weight_min,
          cat.weight_max,
        )}`,
      );
    }
    return map;
  }, [competition?.categories]);

  const getCategoryLabel = useCallback(
    (catId: string) => {
      return categoryLabelById.get(catId) || 'Неизвестная категория';
    },
    [categoryLabelById],
  );

  const eligibleCategoriesForAthlete = useMemo(() => {
    if (!addExistingOpen || !competition?.categories || !addExistingAthlete) return [];
    if (!addExistingAthlete.birth_date || !addExistingAthlete.gender) return [];
    const birth = new Date(addExistingAthlete.birth_date);
    const at = competition.start_date ? new Date(competition.start_date) : new Date();
    let age = at.getFullYear() - birth.getFullYear();
    const m = at.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age -= 1;
    return competition.categories.filter((c) => {
      if (c.gender !== addExistingAthlete.gender) return false;
      if (age < c.age_min || age > c.age_max) return false;
      return true;
    });
  }, [addExistingAthlete, addExistingOpen, competition]);

  const relevantStatuses: ApplicationStatus[] =
    currentTab === 0 ? ['pending', 'rejected'] : ['approved', 'weighed'];

  const visibleApps = useMemo(() => {
    const base = currentTab === 0 ? pendingAndRejectedApps : mandateApps;
    const q = searchText.trim().toLowerCase();

    const matchesQuery = (app: any) => {
      if (!q) return true;
      const parts = [
        app.athlete_name,
        app.athlete_city,
        app.athlete_email,
        app.athlete_phone,
        app.coach_name,
        app.category_description,
        app.category_id ? getCategoryLabel(app.category_id) : '',
        app.status,
        app.draw_number,
        app.declared_weight,
        app.actual_weight,
      ]
        .filter((v) => v !== null && v !== undefined)
        .map((v) => String(v).toLowerCase());
      return parts.some((p) => p.includes(q));
    };

    let out = base.filter((app: any) => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && app.category_id !== categoryFilter) return false;
      if (!matchesQuery(app)) return false;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const statusRank: Record<ApplicationStatus, number> = {
      pending: 1,
      rejected: 2,
      approved: 3,
      weighed: 4,
    };

    out = [...out].sort((a: any, b: any) => {
      const aVal = a ?? {};
      const bVal = b ?? {};

      if (sortField === 'created_at') {
        const aT = aVal.created_at ? Date.parse(aVal.created_at) : 0;
        const bT = bVal.created_at ? Date.parse(bVal.created_at) : 0;
        return (aT - bT) * dir;
      }
      if (sortField === 'athlete_name') {
        const an = String(aVal.athlete_name || '');
        const bn = String(bVal.athlete_name || '');
        return an.localeCompare(bn, 'ru') * dir;
      }
      if (sortField === 'category') {
        const ac = aVal.category_id ? getCategoryLabel(aVal.category_id) : '';
        const bc = bVal.category_id ? getCategoryLabel(bVal.category_id) : '';
        return ac.localeCompare(bc, 'ru') * dir;
      }
      if (sortField === 'status') {
        const as = statusRank[(aVal.status as ApplicationStatus) || 'pending'] || 0;
        const bs = statusRank[(bVal.status as ApplicationStatus) || 'pending'] || 0;
        return (as - bs) * dir;
      }
      if (sortField === 'weight') {
        const aw = Number(aVal.actual_weight ?? aVal.declared_weight ?? 0);
        const bw = Number(bVal.actual_weight ?? bVal.declared_weight ?? 0);
        return (aw - bw) * dir;
      }
      if (sortField === 'draw_number') {
        const ad = Number(aVal.draw_number ?? 0);
        const bd = Number(bVal.draw_number ?? 0);
        return (ad - bd) * dir;
      }
      return 0;
    });

    return out;
  }, [
    categoryFilter,
    currentTab,
    getCategoryLabel,
    mandateApps,
    pendingAndRejectedApps,
    searchText,
    sortDir,
    sortField,
    statusFilter,
  ]);

  if (isLoading) {
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth='lg' sx={{ mt: 4 }}>
      <Box display='flex' alignItems='center' mb={3}>
        <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant='h4'>Заявки: {competition?.name || 'Загрузка...'}</Typography>
      </Box>

      {competition?.categories && competition.categories.length > 0 && (
        <Box mb={4}>
          <Typography variant='h6' gutterBottom>
            Турнирные сетки по категориям
          </Typography>
          <Box display='flex' gap={1} flexWrap='wrap'>
            {competition.categories.map((cat) => {
              return (
                <Button
                  key={cat.id}
                  variant='outlined'
                  size='small'
                  onClick={() => navigate(`/brackets/${cat.id}`)}
                >
                  {cat.gender === 'male' ? 'М' : 'Ж'}, {cat.age_min}-{cat.age_max} л,{' '}
                  {formatWeightLabel(cat.weight_min, cat.weight_max)}
                </Button>
              );
            })}
          </Box>
        </Box>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label='application tabs'>
          <Tab label={`Заявки (${pendingAndRejectedApps.length})`} />
          <Tab label={`Мандатная комиссия (${mandateApps.length})`} />
        </Tabs>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems='center'>
          <Grid item xs={12} md={4}>
            <TextField
              label='Поиск'
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select
                value={statusFilter}
                label='Статус'
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value='all'>Все</MenuItem>
                {relevantStatuses.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s === 'pending'
                      ? 'Ожидает'
                      : s === 'rejected'
                        ? 'Отклонена'
                        : s === 'approved'
                          ? 'Одобрена'
                          : 'Взвешен'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Категория</InputLabel>
              <Select
                value={categoryFilter}
                label='Категория'
                onChange={(e) => setCategoryFilter(String(e.target.value) as any)}
              >
                <MenuItem value='all'>Все</MenuItem>
                {(competition?.categories || []).map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.gender === 'male' ? 'М' : 'Ж'}, {cat.age_min}-{cat.age_max} л,{' '}
                    {formatWeightLabel(cat.weight_min, cat.weight_max)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Сортировка</InputLabel>
              <Select
                value={`${sortField}:${sortDir}`}
                label='Сортировка'
                onChange={(e) => {
                  const [f, d] = String(e.target.value).split(':');
                  setSortField(f as any);
                  setSortDir(d as any);
                }}
              >
                <MenuItem value='created_at:desc'>По дате (сначала новые)</MenuItem>
                <MenuItem value='created_at:asc'>По дате (сначала старые)</MenuItem>
                <MenuItem value='athlete_name:asc'>ФИО (А–Я)</MenuItem>
                <MenuItem value='athlete_name:desc'>ФИО (Я–А)</MenuItem>
                <MenuItem value='category:asc'>Категория (А–Я)</MenuItem>
                <MenuItem value='category:desc'>Категория (Я–А)</MenuItem>
                <MenuItem value='status:asc'>Статус (по порядку)</MenuItem>
                <MenuItem value='status:desc'>Статус (обратно)</MenuItem>
                <MenuItem value='weight:asc'>Вес (↑)</MenuItem>
                <MenuItem value='weight:desc'>Вес (↓)</MenuItem>
                <MenuItem value='draw_number:asc'>Жеребьёвка (↑)</MenuItem>
                <MenuItem value='draw_number:desc'>Жеребьёвка (↓)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {currentTab === 1 ? (
            <Grid item xs={12} md={12} display='flex' justifyContent='flex-end' gap={1}>
              <Button
                variant='contained'
                onClick={() => {
                  setAddExistingOpen(true);
                  setAddExistingAthlete(null);
                  setAddExistingSearchText('');
                  setAddExistingSearchQuery('');
                }}
              >
                Добавить из пользователей
              </Button>
            </Grid>
          ) : null}
        </Grid>
      </Paper>

      {currentTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ФИО Спортсмена</TableCell>
                <TableCell>Категория</TableCell>
                <TableCell>Статус участия</TableCell>
                <TableCell align='right'>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleApps.map((app: any) => (
                <TableRow key={app.id}>
                  <TableCell>{app.athlete_name || 'Неизвестно'}</TableCell>
                  <TableCell>{getCategoryLabel(app.category_id)}</TableCell>
                  <TableCell>
                    <Chip
                      label={app.status === 'pending' ? 'Ожидает' : 'Отклонена'}
                      color={app.status === 'pending' ? 'warning' : 'error'}
                      size='small'
                    />
                  </TableCell>
                  <TableCell align='right'>
                    <Box display='flex' gap={1} justifyContent='flex-end'>
                      <Button
                        variant='outlined'
                        size='small'
                        startIcon={<VisibilityIcon />}
                        onClick={() => setSelectedAppId(app.id)}
                      >
                        Подробнее
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {visibleApps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align='center'>
                    Нет заявок
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {currentTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ФИО Спортсмена</TableCell>
                <TableCell>Категория</TableCell>
                <TableCell>Фактический вес</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell align='right'>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleApps.map((app: any) => (
                <TableRow key={app.id}>
                  <TableCell>{app.athlete_name || 'Неизвестно'}</TableCell>
                  <TableCell>{getCategoryLabel(app.category_id)}</TableCell>
                  <TableCell>{app.actual_weight ? `${app.actual_weight} кг` : '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={app.status === 'weighed' ? 'Взвешен' : 'Одобрена'}
                      color={app.status === 'weighed' ? 'success' : 'info'}
                      size='small'
                    />
                  </TableCell>
                  <TableCell align='right'>
                    <Box display='flex' gap={1} justifyContent='flex-end'>
                      <Button
                        variant='outlined'
                        size='small'
                        startIcon={<VisibilityIcon />}
                        onClick={() => setSelectedAppId(app.id)}
                      >
                        Мандатная
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {visibleApps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align='center'>
                    Нет заявок
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={addExistingOpen}
        onClose={() => setAddExistingOpen(false)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>Добавить из пользователей</DialogTitle>
        <DialogContent dividers>
          <Box display='flex' gap={2} alignItems='center' flexWrap='wrap' mb={2}>
            <TextField
              label='Поиск спортсмена (ФИО)'
              value={addExistingSearchText}
              onChange={(e) => setAddExistingSearchText(e.target.value)}
              sx={{ minWidth: 320 }}
            />
            <Button
              variant='contained'
              onClick={() => setAddExistingSearchQuery(addExistingSearchText.trim())}
            >
              Найти
            </Button>
          </Box>

          {athletesForAddLoading ? (
            <CircularProgress />
          ) : (
            <TableContainer component={Paper} variant='outlined'>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>ФИО</TableCell>
                    <TableCell>Пол</TableCell>
                    <TableCell>Дата рождения</TableCell>
                    <TableCell>Тренер</TableCell>
                    <TableCell align='right'>Выбор</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(athletesForAdd || []).map((a: any) => (
                    <TableRow
                      key={a.athlete_id}
                      selected={addExistingAthlete?.athlete_id === a.athlete_id}
                    >
                      <TableCell>{a.full_name || '—'}</TableCell>
                      <TableCell>{a.gender ? (a.gender === 'male' ? 'М' : 'Ж') : '—'}</TableCell>
                      <TableCell>{a.birth_date || '—'}</TableCell>
                      <TableCell>{a.coach_name || '—'}</TableCell>
                      <TableCell align='right'>
                        <Button
                          variant='text'
                          size='small'
                          onClick={() => setAddExistingAthlete(a)}
                        >
                          Выбрать
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!athletesForAdd?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} align='center'>
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box mt={2}>
            <Typography variant='subtitle2' sx={{ mb: 1 }}>
              Категория
            </Typography>
            {!addExistingAthlete ? (
              <Typography color='textSecondary'>Выберите спортсмена из списка.</Typography>
            ) : !addExistingAthlete.birth_date || !addExistingAthlete.gender ? (
              <Typography color='textSecondary'>
                У спортсмена не заполнены дата рождения и/или пол.
              </Typography>
            ) : eligibleCategoriesForAthlete.length === 0 ? (
              <Typography color='textSecondary'>Нет подходящих категорий.</Typography>
            ) : (
              <Box display='flex' flexWrap='wrap' gap={1}>
                {eligibleCategoriesForAthlete.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={`${cat.gender === 'male' ? 'М' : 'Ж'} | ${cat.age_min}-${cat.age_max} | ${formatWeightLabel(
                      cat.weight_min,
                      cat.weight_max,
                    )}`}
                    clickable
                    variant='outlined'
                    color='primary'
                    onClick={() => adminApplyFromExistingMutation.mutate(cat.id)}
                    disabled={adminApplyFromExistingMutation.isPending}
                  />
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddExistingOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно деталей заявки */}
      <Dialog open={!!selectedAppId} onClose={() => setSelectedAppId(null)} maxWidth='md' fullWidth>
        <DialogTitle>
          Детали заявки
          <IconButton
            onClick={() => setSelectedAppId(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {isLoadingDetails ? (
            <Box display='flex' justifyContent='center' p={3}>
              <CircularProgress />
            </Box>
          ) : selectedAppDetails ? (
            <Box display='flex' gap={3} flexDirection={{ xs: 'column', md: 'row' }}>
              <Box flex={1}>
                <Typography variant='h6' gutterBottom>
                  Информация о спортсмене
                </Typography>
                <Box display='flex' alignItems='center' justifyContent='space-between'>
                  <Typography>
                    <strong>ФИО:</strong> {selectedAppDetails.athlete_name || 'Не указано'}
                  </Typography>
                  <Box display='flex' alignItems='center' gap={1}>
                    <Typography variant='caption' color='textSecondary'>
                      Редактировать
                    </Typography>
                    <Switch checked={editProfile} onChange={(_, v) => setEditProfile(v)} />
                  </Box>
                </Box>
                <Typography>
                  <strong>Телефон:</strong> {selectedAppDetails.athlete_phone || 'Не указан'}
                </Typography>
                <Typography>
                  <strong>Email:</strong> {selectedAppDetails.athlete_email || 'Не указан'}
                </Typography>
                <Typography>
                  <strong>Тренер:</strong> {selectedAppDetails.coach_name || 'Не указан'}
                </Typography>
                <Typography>
                  <strong>Город/село:</strong> {selectedAppDetails.athlete_city || 'Не указано'}
                </Typography>

                {editProfile ? (
                  <Box mt={2} display='flex' flexDirection='column' gap={2}>
                    <TextField
                      label='ФИО'
                      value={editForm.full_name}
                      onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label='Город'
                      value={editForm.city}
                      onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label='Регион (location_id)'
                      value={editForm.location_id}
                      onChange={(e) => setEditForm((p) => ({ ...p, location_id: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label='ФИО тренера'
                      value={editForm.coach_name}
                      onChange={(e) => setEditForm((p) => ({ ...p, coach_name: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      type='date'
                      label='Дата рождения'
                      InputLabelProps={{ shrink: true }}
                      value={editForm.birth_date}
                      onChange={(e) => setEditForm((p) => ({ ...p, birth_date: e.target.value }))}
                      fullWidth
                    />
                    <FormControl fullWidth>
                      <InputLabel>Разряд / звание</InputLabel>
                      <Select
                        value={editForm.rank}
                        label='Разряд / звание'
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, rank: String(e.target.value) }))
                        }
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
                    <Box>
                      <Button variant='outlined' component='label' fullWidth>
                        Загрузить фото 3×4
                        <input
                          type='file'
                          hidden
                          accept='image/*'
                          onChange={handleEditPhotoUpload}
                        />
                      </Button>
                      {editForm.photo_url ? (
                        <Box mt={1}>
                          <img
                            src={
                              editForm.photo_url.includes('documents/')
                                ? supabase.storage.from('avatars').getPublicUrl(editForm.photo_url)
                                    .data.publicUrl
                                : editForm.photo_url
                            }
                            alt='Фото 3x4'
                            style={{ width: '100%', maxHeight: '240px', objectFit: 'contain' }}
                          />
                        </Box>
                      ) : null}
                    </Box>
                    {updateAthleteProfileMutation.error ? (
                      <Typography color='error'>
                        {updateAthleteProfileMutation.error instanceof Error
                          ? updateAthleteProfileMutation.error.message
                          : 'Ошибка'}
                      </Typography>
                    ) : null}
                    <Button
                      variant='contained'
                      onClick={() => updateAthleteProfileMutation.mutate()}
                      disabled={updateAthleteProfileMutation.isPending}
                    >
                      Сохранить профиль спортсмена
                    </Button>
                  </Box>
                ) : null}

                <Divider sx={{ my: 2 }} />

                <Typography variant='h6' gutterBottom>
                  Фото 3×4
                </Typography>
                {selectedAppDetails.passport?.photo_url ? (
                  <Box mt={1} mb={1}>
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
                        selectedAppDetails.passport.photo_url.startsWith('http')
                          ? selectedAppDetails.passport.photo_url
                          : selectedAppDetails.passport.photo_url.includes('documents/')
                            ? supabase.storage
                                .from('avatars')
                                .getPublicUrl(selectedAppDetails.passport.photo_url).data.publicUrl
                            : selectedAppDetails.passport.photo_url.startsWith(
                                  '/applications/photo/',
                                )
                              ? `${import.meta.env.VITE_API_URL}/api/v1${selectedAppDetails.passport.photo_url}`
                              : `${import.meta.env.VITE_API_URL}/api/v1/tg-file/${selectedAppDetails.passport.photo_url}`
                      }
                      alt='Фото 3x4'
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageLoaded(true)}
                      sx={{
                        width: '100%',
                        maxHeight: '300px',
                        objectFit: 'contain',
                        display: imageLoaded ? 'block' : 'none',
                        borderRadius: '4px',
                        border: '1px solid #eee',
                      }}
                    />
                  </Box>
                ) : (
                  <Typography color='text.secondary'>Фото не загружено</Typography>
                )}
              </Box>

              <Box flex={1}>
                {currentTab === 0 ? (
                  <>
                    <Typography variant='h6' gutterBottom>
                      Данные заявки
                    </Typography>
                    <Typography sx={{ mb: 2 }}>
                      <strong>Заявленная категория:</strong>{' '}
                      {selectedAppDetails.category_id
                        ? getCategoryLabel(selectedAppDetails.category_id)
                        : 'Не указана'}
                    </Typography>
                    <Box mt={2}>
                      <Typography component='span' sx={{ mr: 1 }}>
                        <strong>Текущий статус:</strong>
                      </Typography>
                      <Chip
                        label={
                          selectedAppDetails.status === 'pending'
                            ? 'Ожидает'
                            : selectedAppDetails.status === 'rejected'
                              ? 'Отклонена'
                              : 'Одобрена'
                        }
                        color={
                          selectedAppDetails.status === 'pending'
                            ? 'warning'
                            : selectedAppDetails.status === 'rejected'
                              ? 'error'
                              : 'success'
                        }
                      />
                    </Box>
                  </>
                ) : (
                  <>
                    <Typography variant='h6' gutterBottom>
                      Данные заявки (взвешивание)
                    </Typography>
                    <Typography sx={{ mb: 2 }}>
                      <strong>Заявленная категория:</strong>{' '}
                      {selectedAppDetails.category_id
                        ? getCategoryLabel(selectedAppDetails.category_id)
                        : 'Не указана'}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant='subtitle1' gutterBottom>
                      Итоги мандатной комиссии
                    </Typography>

                    <Box display='flex' gap={2} mb={2} flexDirection='column'>
                      <TextField
                        label='Фактический вес (кг)'
                        type='number'
                        size='small'
                        value={actualWeight}
                        onChange={(e) => setActualWeight(e.target.value)}
                        InputProps={{ inputProps: { min: 0, step: 0.1 } }}
                        fullWidth
                      />

                      <FormControl fullWidth size='small'>
                        <InputLabel>Итоговая категория</InputLabel>
                        <Select
                          value={selectedCategoryId}
                          label='Итоговая категория'
                          onChange={(e) => setSelectedCategoryId(e.target.value)}
                        >
                          {competition?.categories?.map((cat) => {
                            let weightLabel = '';
                            if (cat.weight_max === 999) {
                              weightLabel = `${Math.floor(cat.weight_min)}+ кг`;
                            } else {
                              weightLabel = cat.weight_max
                                ? `до ${cat.weight_max} кг`
                                : `свыше ${cat.weight_min} кг`;
                            }
                            return (
                              <MenuItem key={cat.id} value={cat.id}>
                                {cat.gender === 'male' ? 'М' : 'Ж'}, {cat.age_min}-{cat.age_max} л,{' '}
                                {weightLabel}
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    </Box>

                    <Box mt={2}>
                      <Typography component='span' sx={{ mr: 1 }}>
                        <strong>Текущий статус:</strong>
                      </Typography>
                      <Chip
                        label={
                          selectedAppDetails.status === 'weighed'
                            ? 'Взвешен'
                            : selectedAppDetails.status === 'approved'
                              ? 'Ожидает взвешивания'
                              : 'Другой'
                        }
                        color={
                          selectedAppDetails.status === 'weighed'
                            ? 'success'
                            : selectedAppDetails.status === 'approved'
                              ? 'warning'
                              : 'default'
                        }
                      />
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          ) : (
            <Typography>Не удалось загрузить данные</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setSelectedAppId(null)}>Закрыть</Button>

          <Box display='flex' gap={1}>
            {currentTab === 0 && selectedAppDetails?.status === 'pending' && (
              <>
                <Button
                  variant='contained'
                  color='success'
                  startIcon={<CheckIcon />}
                  onClick={() =>
                    updateApplicationMutation.mutate({
                      appId: selectedAppDetails.id,
                      status: 'approved',
                    })
                  }
                  disabled={updateApplicationMutation.isPending}
                >
                  Одобрить участие
                </Button>
                <Button
                  variant='outlined'
                  color='error'
                  startIcon={<CloseIcon />}
                  onClick={() =>
                    updateApplicationMutation.mutate({
                      appId: selectedAppDetails.id,
                      status: 'rejected',
                    })
                  }
                  disabled={updateApplicationMutation.isPending}
                >
                  Отклонить
                </Button>
              </>
            )}

            {currentTab === 1 && selectedAppDetails?.status !== 'weighed' && (
              <>
                <Button
                  variant='contained'
                  color='success'
                  startIcon={<CheckIcon />}
                  onClick={() =>
                    updateApplicationMutation.mutate({
                      appId: selectedAppDetails.id,
                      status: 'weighed',
                      categoryId: selectedCategoryId || undefined,
                      weight: actualWeight ? parseFloat(actualWeight) : null,
                    })
                  }
                  disabled={updateApplicationMutation.isPending}
                >
                  Сохранить взвешивание
                </Button>
                <Button
                  variant='outlined'
                  color='error'
                  startIcon={<CloseIcon />}
                  onClick={() =>
                    updateApplicationMutation.mutate({
                      appId: selectedAppDetails.id,
                      status: 'rejected',
                    })
                  }
                  disabled={updateApplicationMutation.isPending}
                >
                  Отказ / Не допущен
                </Button>
              </>
            )}
          </Box>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ApplicationList;
