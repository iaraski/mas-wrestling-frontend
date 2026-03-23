import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { competitionService } from '../services/api';

import PeopleIcon from '@mui/icons-material/People';
import { useNavigate } from 'react-router-dom';

type Competition = {
  id: string;
  name: string;
  scale: 'world' | 'country' | 'region';
  type: 'open' | 'restricted';
  start_date: string;
  mandate_start_date: string;
  mandate_end_date: string;
  location_name?: string | null;
  city?: string | null;
  street?: string | null;
  house?: string | null;
};

const CompetitionListPage = () => {
  const navigate = useNavigate();
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: competitionService.getCompetitions,
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading)
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );

  return (
    <Container maxWidth='lg' sx={{ mt: 4 }}>
      <Box display='flex' justifyContent='space-between' alignItems='center' mb={4}>
        <Typography variant='h4' component='h1'>
          Соревнования
        </Typography>
        <Box display='flex' gap={2}>
          <Button variant='outlined' startIcon={<PeopleIcon />} onClick={() => navigate('/users')}>
            Администрирование
          </Button>
          <Button
            variant='contained'
            startIcon={<AddIcon />}
            color='primary'
            onClick={() => navigate('/competitions/create')}
          >
            Создать
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {competitions?.map((comp: Competition) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={comp.id}>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  {comp.name}
                </Typography>
                <Box mb={2}>
                  <Chip
                    label={
                      comp.scale === 'world'
                        ? 'Мировой'
                        : comp.scale === 'country'
                          ? 'Национальный'
                          : 'Региональный'
                    }
                    size='small'
                    color='secondary'
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={comp.type === 'open' ? 'Открытый' : 'Закрытый'}
                    size='small'
                    variant='outlined'
                  />
                </Box>
                <Typography variant='body2' color='text.secondary'>
                  Начало: {formatDate(comp.start_date)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Мандатная комиссия: {formatDate(comp.mandate_start_date)} -{' '}
                  {formatDate(comp.mandate_end_date)}
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                  <b>Место:</b> {comp.location_name || '—'}
                  {comp.city ? `, г. ${comp.city}` : ''}
                </Typography>
                {(comp.street || comp.house) && (
                  <Typography variant='body2' color='text.secondary'>
                    {comp.street ? `${comp.street}` : ''}
                    {comp.house ? `, д. ${comp.house}` : ''}
                  </Typography>
                )}
                <Box mt={2} display='flex' gap={1}>
                  <Button
                    size='small'
                    variant='outlined'
                    onClick={() => navigate(`/competitions/${comp.id}/applications`)}
                  >
                    Заявки
                  </Button>
                  <Button
                    size='small'
                    variant='outlined'
                    onClick={() => navigate(`/competitions/${comp.id}`)}
                  >
                    Подробнее
                  </Button>
                  <Button
                    size='small'
                    color='secondary'
                    variant='outlined'
                    onClick={() => navigate(`/competitions/${comp.id}/edit`)}
                  >
                    Ред.
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default CompetitionListPage;
