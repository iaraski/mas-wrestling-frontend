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
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { applicationService, competitionService } from '../services/api';

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
  categories: CompetitionCategory[];
};

type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'weighed';

type Application = {
  id: string;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: selectedAppDetails, isLoading: isLoadingDetails } = useQuery<any>({
    queryKey: ['applicationDetails', selectedAppId],
    queryFn: () => applicationService.getApplicationDetails(selectedAppId!),
    enabled: !!selectedAppId,
  });

  // Reset image loader only when a different application is selected
  useEffect(() => {
    setImageLoaded(false);
  }, [selectedAppId]);

  useEffect(() => {
    if (selectedAppId && selectedAppDetails) {
      setActualWeight(selectedAppDetails.actual_weight?.toString() || '');
      setSelectedCategoryId(selectedAppDetails.category_id || '');
    }
  }, [selectedAppDetails, selectedAppId]);

  const verifyPassportMutation = useMutation({
    mutationFn: ({ passportId, isVerified }: { passportId: string; isVerified: boolean }) =>
      applicationService.verifyPassport(passportId, isVerified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicationDetails', selectedAppId] });
    },
  });

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

  if (isLoading)
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );

  const pendingAndRejectedApps =
    applications?.filter((app) => app.status === 'pending' || app.status === 'rejected') ?? [];
  const mandateApps =
    applications?.filter((app) => app.status === 'approved' || app.status === 'weighed') ?? [];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const getCategoryLabel = (catId: string) => {
    const cat = competition?.categories?.find((c) => c.id === catId);
    if (!cat) return 'Неизвестная категория';

    let weightLabel = '';
    if (cat.weight_max === 999) {
      weightLabel = `${Math.floor(cat.weight_min)}+ кг`;
    } else {
      weightLabel = cat.weight_max ? `до ${cat.weight_max} кг` : `свыше ${cat.weight_min} кг`;
    }

    return `${cat.gender === 'male' ? 'М' : 'Ж'}, ${cat.age_min}-${cat.age_max} л, ${weightLabel}`;
  };

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
              let weightLabel = '';
              if (cat.weight_max === 999) {
                weightLabel = `${Math.floor(cat.weight_min)}+ кг`;
              } else {
                weightLabel = cat.weight_max
                  ? `до ${cat.weight_max} кг`
                  : `свыше ${cat.weight_min} кг`;
              }

              return (
                <Button
                  key={cat.id}
                  variant='outlined'
                  size='small'
                  onClick={() => navigate(`/brackets/${cat.id}`)}
                >
                  {cat.gender === 'male' ? 'М' : 'Ж'}, {cat.age_min}-{cat.age_max} л, {weightLabel}
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
              {pendingAndRejectedApps.map((app: any) => (
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
              {pendingAndRejectedApps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align='center'>
                    Нет заявок, ожидающих подтверждения
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
                <TableCell>№ Жеребьевки</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell align='right'>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mandateApps.map((app: any) => (
                <TableRow key={app.id}>
                  <TableCell>{app.athlete_name || 'Неизвестно'}</TableCell>
                  <TableCell>{getCategoryLabel(app.category_id)}</TableCell>
                  <TableCell>{app.actual_weight ? `${app.actual_weight} кг` : '-'}</TableCell>
                  <TableCell>{app.draw_number ? `#${app.draw_number}` : '-'}</TableCell>
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
              {mandateApps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align='center'>
                    Нет одобренных заявок для мандатной комиссии
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
                <Typography>
                  <strong>ФИО:</strong> {selectedAppDetails.athlete_name || 'Не указано'}
                </Typography>
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

                <Divider sx={{ my: 2 }} />

                <Typography variant='h6' gutterBottom>
                  Паспортные данные
                </Typography>
                {selectedAppDetails.passport ? (
                  <Box>
                    <Typography>
                      <strong>Серия и номер:</strong> {selectedAppDetails.passport.series}{' '}
                      {selectedAppDetails.passport.number}
                    </Typography>
                    <Typography>
                      <strong>Кем выдан:</strong> {selectedAppDetails.passport.issued_by}
                    </Typography>
                    <Typography>
                      <strong>Дата выдачи:</strong> {selectedAppDetails.passport.issue_date}
                    </Typography>
                    <Typography>
                      <strong>Дата рождения:</strong> {selectedAppDetails.passport.birth_date}
                    </Typography>
                    <Typography>
                      <strong>Пол:</strong>{' '}
                      {selectedAppDetails.passport.gender === 'male' ? 'Мужской' : 'Женский'}
                    </Typography>
                    <Typography>
                      <strong>Разряд:</strong> {selectedAppDetails.passport.rank || 'Нет'}
                    </Typography>

                    {selectedAppDetails.passport?.photo_url && (
                      <Box mt={2} mb={2}>
                        <Typography variant='subtitle2' gutterBottom>
                          Фотография:
                        </Typography>
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
                          src={`${import.meta.env.VITE_API_URL}/api/v1/tg-file/${selectedAppDetails.passport.photo_url}`}
                          alt='Фото'
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
                    )}

                    {selectedAppDetails.passport?.passport_scan_url && (
                      <Box mt={2} mb={2}>
                        <Typography variant='subtitle2' gutterBottom>
                          Скан паспорта:
                        </Typography>
                        <Box
                          component='iframe'
                          src={`${import.meta.env.VITE_API_URL}/api/v1/tg-file/${selectedAppDetails.passport.passport_scan_url}`}
                          title='Скан паспорта'
                          sx={{
                            width: '100%',
                            height: '400px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                          }}
                        />
                        <Box mt={1}>
                          <Button
                            variant='outlined'
                            size='small'
                            onClick={() =>
                              window.open(
                                `${import.meta.env.VITE_API_URL}/api/v1/tg-file/${selectedAppDetails.passport.passport_scan_url}`,
                                '_blank',
                              )
                            }
                          >
                            Открыть в новой вкладке (на весь экран)
                          </Button>
                        </Box>
                      </Box>
                    )}

                    <Box mt={2} display='flex' alignItems='center'>
                      <Typography component='span' sx={{ mr: 1 }}>
                        <strong>Статус паспорта:</strong>
                      </Typography>
                      <Chip
                        label={
                          selectedAppDetails.passport.is_verified ? 'Подтвержден' : 'Не подтвержден'
                        }
                        color={selectedAppDetails.passport.is_verified ? 'success' : 'warning'}
                        size='small'
                        sx={{ mr: 2 }}
                      />
                      <Box display='flex' alignItems='center'>
                        <Switch
                          checked={!!selectedAppDetails.passport.is_verified}
                          onChange={(e) =>
                            verifyPassportMutation.mutate({
                              passportId: selectedAppDetails.passport.id,
                              isVerified: e.target.checked,
                            })
                          }
                          disabled={verifyPassportMutation.isPending}
                        />
                        <Typography variant='body2'>Подтвердить</Typography>
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Typography color='text.secondary'>Паспортные данные не заполнены</Typography>
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
