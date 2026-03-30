import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventIcon from '@mui/icons-material/Event';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { competitionService } from '../services/api';

type Category = {
  id: string;
  gender: string;
  age_min: number;
  age_max: number;
  weight_min: number;
  weight_max?: number | null;
  competition_day?: string;
  mandate_day?: string;
};

type Competition = {
  id: string;
  name: string;
  preview_url?: string;
  scale: string;
  type: string;
  start_date: string;
  end_date: string;
  mandate_start_date: string;
  mandate_end_date: string;
  location_name?: string;
  city?: string;
  street?: string;
  house?: string;
  categories: Category[];
};

const CompetitionDetails = () => {
  const { compId } = useParams<{ compId: string }>();
  const navigate = useNavigate();

  const {
    data: competition,
    isLoading,
    error,
  } = useQuery<Competition>({
    queryKey: ['competition', compId],
    queryFn: () => competitionService.getCompetitionDetails(compId!),
    enabled: !!compId,
  });

  if (isLoading)
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );

  if (error || !competition)
    return (
      <Container sx={{ mt: 4 }}>
        <Typography color='error'>Ошибка загрузки соревнования</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Назад
        </Button>
      </Container>
    );

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        К списку
      </Button>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant='h4' gutterBottom>
              {competition.name}
            </Typography>
            <Box display='flex' gap={1} mb={2}>
              <Chip label={competition.scale} color='primary' size='small' />
              <Chip label={competition.type} variant='outlined' size='small' />
            </Box>

            <Box display='flex' alignItems='center' gap={1} mb={1}>
              <EventIcon color='action' />
              <Typography>
                <b>Даты проведения:</b> {formatDate(competition.start_date)} -{' '}
                {formatDate(competition.end_date)}
              </Typography>
            </Box>
            <Box display='flex' alignItems='center' gap={1} mb={1}>
              <EventIcon color='action' />
              <Typography>
                <b>Мандатная комиссия:</b> {formatDate(competition.mandate_start_date)} -{' '}
                {formatDate(competition.mandate_end_date)}
              </Typography>
            </Box>
            <Box display='flex' alignItems='center' gap={1}>
              <LocationOnIcon color='action' />
              <Typography>
                {competition.location_name || '—'}
                {competition.city ? `, г. ${competition.city}` : ''}
                {competition.street ? `, ${competition.street}` : ''}
                {competition.house ? `, д. ${competition.house}` : ''}
              </Typography>
            </Box>
          </Grid>
          <Grid
            item xs={12} md={4}
            display='flex'
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-end'
            gap={1}
          >
            {competition.preview_url ? (
              <Box
                component='img'
                src={competition.preview_url}
                alt='preview'
                sx={{ width: '100%', maxWidth: 240, borderRadius: 1, mb: 1 }}
              />
            ) : null}
            <Button
              variant='contained'
              fullWidth
              sx={{ maxWidth: 200 }}
              onClick={() => navigate(`/competitions/${competition.id}/applications`)}
            >
              Заявки
            </Button>
            <Button
              variant='contained'
              color='secondary'
              fullWidth
              sx={{ maxWidth: 200 }}
              onClick={() => navigate(`/competitions/${competition.id}/execution`)}
            >
              Проведение
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant='h5' gutterBottom>
        Категории
      </Typography>
      <Paper elevation={1}>
        <List>
          {competition.categories.map((cat, index) => (
            <div key={cat.id}>
              <ListItem
                secondaryAction={
                  <Button
                    variant='outlined'
                    size='small'
                    onClick={() => navigate(`/brackets/${cat.id}`)}
                  >
                    Сетка
                  </Button>
                }
              >
                <ListItemText
                  primary={`${cat.gender === 'male' ? 'Мужчины' : 'Женщины'}, ${cat.age_min}-${cat.age_max} лет`}
                  secondary={`Вес: ${cat.weight_max ? `до ${cat.weight_max} кг` : `свыше ${cat.weight_min} кг`} | Выступление: ${formatDate(cat.competition_day)}`}
                />
              </ListItem>
              {index < competition.categories.length - 1 && <Divider />}
            </div>
          ))}
        </List>
      </Paper>
    </Container>
  );
};

export default CompetitionDetails;
