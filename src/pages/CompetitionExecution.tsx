import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

type Bout = {
  id: string;
  category_id: string;
  mat_number: number;
  bout_order: number;
  round_name: string;
  bracket_type: string;
  red_athlete_id: string | null;
  blue_athlete_id: string | null;
  winner_id: string | null;
  red_score: number;
  blue_score: number;
  status: 'pending' | 'active' | 'completed';
  red_athlete?: { id: string; athlete_name: string };
  blue_athlete?: { id: string; athlete_name: string };
  category?: {
    gender: string;
    age_min: number;
    age_max: number;
    weight_min: number;
    weight_max: number;
  };
};

export default function CompetitionExecution() {
  const { compId } = useParams<{ compId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentMat, setCurrentMat] = useState(1);

  // Fetch bouts
  const { data: bouts, isLoading } = useQuery<Bout[]>({
    queryKey: ['bouts', compId],
    queryFn: async () => {
      const res = await api.get(`/bouts/competition/${compId}`);
      return res.data;
    },
    enabled: !!compId,
  });

  // Generate brackets mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/bouts/competition/${compId}/generate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bouts', compId] });
    },
  });

  const updateBoutMutation = useMutation({
    mutationFn: async ({ boutId, data }: { boutId: string; data: Partial<Bout> }) => {
      await api.patch(`/bouts/${boutId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bouts', compId] });
    },
  });

  if (isLoading) {
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  const hasBouts = bouts && bouts.length > 0;

  // Calculate how many mats we have based on the data
  const mats = hasBouts
    ? Array.from(new Set(bouts.map((b) => b.mat_number))).sort((a, b) => a - b)
    : [];

  const handleGenerate = () => {
    if (confirm('Внимание! Это действие удалит текущие сетки и сгенерирует новые. Продолжить?')) {
      generateMutation.mutate();
    }
  };

  const handleScoreChange = (boutId: string, field: 'red_score' | 'blue_score', value: string) => {
    const num = parseInt(value, 10) || 0;
    updateBoutMutation.mutate({ boutId, data: { [field]: num } });
  };

  const setWinner = (bout: Bout, winnerId: string | null) => {
    updateBoutMutation.mutate({
      boutId: bout.id,
      data: {
        winner_id: winnerId,
        status: 'completed',
      },
    });
  };

  const startBout = (boutId: string) => {
    updateBoutMutation.mutate({ boutId, data: { status: 'active' } });
  };

  return (
    <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
      <Box display='flex' justifyContent='space-between' alignItems='center' mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/competitions/${compId}`)}>
          Назад
        </Button>
        <Button
          variant='contained'
          color='warning'
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать сетки'}
        </Button>
      </Box>

      <Typography variant='h4' gutterBottom>
        Проведение соревнований
      </Typography>

      {!hasBouts ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant='h6' color='textSecondary'>
            Сетки еще не сформированы.
          </Typography>
          <Typography variant='body2' color='textSecondary' sx={{ mb: 2 }}>
            Убедитесь, что участники прошли мандатную комиссию, и нажмите кнопку генерации.
          </Typography>
        </Paper>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={currentMat} onChange={(_, val) => setCurrentMat(val)}>
              {mats.map((mat) => (
                <Tab key={mat} label={`Помост ${mat}`} value={mat} />
              ))}
            </Tabs>
          </Box>

          <Box>
            {bouts
              .filter((b) => b.mat_number === currentMat)
              .sort((a, b) => a.bout_order - b.bout_order)
              .map((bout) => (
                <Card
                  key={bout.id}
                  sx={{
                    mb: 2,
                    borderLeft:
                      bout.status === 'active'
                        ? '4px solid #4caf50'
                        : bout.status === 'completed'
                          ? '4px solid #9e9e9e'
                          : '4px solid #2196f3',
                    opacity: bout.status === 'completed' ? 0.7 : 1,
                  }}
                >
                  <CardContent>
                    <Box display='flex' justifyContent='space-between' alignItems='center' mb={2}>
                      <Typography variant='subtitle2' color='textSecondary'>
                        Поединок #{bout.bout_order} • {bout.round_name}
                      </Typography>
                      <Chip
                        label={
                          bout.status === 'active'
                            ? 'Идет схватка'
                            : bout.status === 'completed'
                              ? 'Завершен'
                              : 'Ожидание'
                        }
                        color={
                          bout.status === 'active'
                            ? 'success'
                            : bout.status === 'completed'
                              ? 'default'
                              : 'primary'
                        }
                        size='small'
                      />
                    </Box>

                    <Grid container spacing={2} alignItems='center'>
                      {/* Red Athlete */}
                      <Grid item xs={12} md={5}>
                        <Paper sx={{ p: 2, bgcolor: '#ffebee', textAlign: 'center' }}>
                          <Typography variant='h6' color='error'>
                            {bout.red_athlete?.athlete_name || 'Ожидание победителя...'}
                          </Typography>
                          {bout.status !== 'pending' && bout.red_athlete && (
                            <Box mt={2}>
                              <TextField
                                type='number'
                                label='Очки (Красный)'
                                size='small'
                                value={bout.red_score}
                                onChange={(e) =>
                                  handleScoreChange(bout.id, 'red_score', e.target.value)
                                }
                                disabled={bout.status === 'completed'}
                              />
                            </Box>
                          )}
                          {bout.status === 'active' && bout.red_athlete && (
                            <Button
                              variant='contained'
                              color='error'
                              size='small'
                              sx={{ mt: 1 }}
                              onClick={() => setWinner(bout, bout.red_athlete_id)}
                            >
                              Победитель
                            </Button>
                          )}
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={2} sx={{ textAlign: 'center' }}>
                        <Typography variant='h5' color='textSecondary'>
                          VS
                        </Typography>
                      </Grid>

                      {/* Blue Athlete */}
                      <Grid item xs={12} md={5}>
                        <Paper sx={{ p: 2, bgcolor: '#e3f2fd', textAlign: 'center' }}>
                          <Typography variant='h6' color='primary'>
                            {bout.blue_athlete?.athlete_name || 'Ожидание победителя...'}
                          </Typography>
                          {bout.status !== 'pending' && bout.blue_athlete && (
                            <Box mt={2}>
                              <TextField
                                type='number'
                                label='Очки (Синий)'
                                size='small'
                                value={bout.blue_score}
                                onChange={(e) =>
                                  handleScoreChange(bout.id, 'blue_score', e.target.value)
                                }
                                disabled={bout.status === 'completed'}
                              />
                            </Box>
                          )}
                          {bout.status === 'active' && bout.blue_athlete && (
                            <Button
                              variant='contained'
                              color='primary'
                              size='small'
                              sx={{ mt: 1 }}
                              onClick={() => setWinner(bout, bout.blue_athlete_id)}
                            >
                              Победитель
                            </Button>
                          )}
                        </Paper>
                      </Grid>
                    </Grid>

                    {bout.status === 'pending' && bout.red_athlete_id && bout.blue_athlete_id && (
                      <Box mt={2} display='flex' justifyContent='center'>
                        <Button
                          variant='contained'
                          color='success'
                          onClick={() => startBout(bout.id)}
                        >
                          Начать схватку
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
          </Box>
        </>
      )}
    </Container>
  );
}
