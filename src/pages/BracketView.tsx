import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Grid,
  IconButton,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';

type BracketMatch = {
  round_number: number;
  match_number: number;
  athlete1_id?: string | null;
  athlete2_id?: string | null;
  winner_id?: string | null;
  athlete1_name?: string | null;
  athlete2_name?: string | null;
};

type Bracket = {
  type: 'round_robin' | 'single_elimination' | 'double_elimination';
  matches: BracketMatch[];
};

const BracketView = () => {
  const { catId } = useParams<{ catId: string }>();

  const {
    data: bracket,
    isLoading,
    error,
  } = useQuery<Bracket>({
    queryKey: ['bracket', catId],
    queryFn: async () => {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/brackets/${catId}`);
      return response.data;
    },
    enabled: !!catId,
  });

  if (isLoading)
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );
  if (error)
    return (
      <Container sx={{ mt: 4 }}>
        <Typography color='error'>
          Ошибка при загрузке сетки. Возможно, недостаточно одобренных заявок.
        </Typography>
      </Container>
    );

  return (
    <Container maxWidth='md' sx={{ mt: 4 }}>
      <Box display='flex' alignItems='center' mb={3}>
        <IconButton onClick={() => window.history.back()} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant='h4'>
          Турнирная сетка ({bracket?.type === 'round_robin' ? 'Круговая' : 'Олимпийская'})
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {bracket?.matches.map((match, index) => (
          <Grid size={{ xs: 12, sm: 6 }} key={index}>
            <Card variant='outlined'>
              <CardContent>
                <Typography variant='subtitle2' color='text.secondary'>
                  Матч #{match.match_number} (Раунд {match.round_number})
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Box display='flex' justifyContent='space-between' alignItems='center'>
                  <Typography
                    variant='body1'
                    fontWeight={match.winner_id === match.athlete1_id ? 'bold' : 'normal'}
                  >
                    {match.athlete1_name || 'TBD'}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    vs
                  </Typography>
                  <Typography
                    variant='body1'
                    fontWeight={match.winner_id === match.athlete2_id ? 'bold' : 'normal'}
                  >
                    {match.athlete2_name || 'TBD'}
                  </Typography>
                </Box>
                {match.winner_id && (
                  <Typography
                    variant='caption'
                    color='success.main'
                    sx={{ mt: 1, display: 'block' }}
                  >
                    Победитель:{' '}
                    {match.winner_id === match.athlete1_id
                      ? match.athlete1_name
                      : match.athlete2_name}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default BracketView;
