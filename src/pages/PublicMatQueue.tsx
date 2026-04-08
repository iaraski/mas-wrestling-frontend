import {
  AppBar,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { liveService } from '../services/api';

type LiveBout = {
  id: string;
  category_id: string;
  athlete_red_name?: string;
  athlete_blue_name?: string;
  round_index: number;
  stage: string | null;
  status: 'queued' | 'next' | 'running' | 'done' | 'cancelled';
  mat_number: number;
  order_in_mat: number;
  red_wins?: number;
  blue_wins?: number;
  wins_to?: number;
};

type LiveMat = {
  mat_number: number;
  categories: Array<{ id: string; label: string }>;
  current_bout: LiveBout | null;
  next_bout: LiveBout | null;
  queue: LiveBout[];
  current_round?: number | null;
};

type LiveState = {
  competition: {
    id: string;
    name: string;
    mats_count: number;
    has_bouts: boolean;
    has_started: boolean;
  };
  mats: LiveMat[];
};

function BoutLine({ bout, categoryLabel }: { bout: LiveBout; categoryLabel: string }) {
  const left = bout.athlete_red_name || '—';
  const right = bout.athlete_blue_name || '—';
  const score =
    bout.red_wins !== undefined && bout.blue_wins !== undefined
      ? `${bout.red_wins}:${bout.blue_wins}${bout.wins_to ? ` (до ${bout.wins_to})` : ''}`
      : null;

  return (
    <Box>
      <Typography sx={{ fontWeight: 600 }}>
        {left} vs {right}
      </Typography>
      <Typography variant='body2' color='text.secondary'>
        {categoryLabel}
        {score ? ` • ${score}` : ''}
      </Typography>
    </Box>
  );
}

export default function PublicMatQueue() {
  const { compId } = useParams<{ compId: string }>();
  const [currentMat, setCurrentMat] = useState(1);

  const liveQuery = useQuery<LiveState>({
    queryKey: ['public_live_state', compId],
    queryFn: () => liveService.getLiveState(compId!),
    enabled: !!compId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const mats = useMemo(() => liveQuery.data?.mats || [], [liveQuery.data?.mats]);
  const matsCount = liveQuery.data?.competition?.mats_count || 1;
  const competitionName = liveQuery.data?.competition?.name || 'Очередь';

  const currentMatState = useMemo(() => {
    return mats.find((m) => m.mat_number === currentMat) || mats[0] || null;
  }, [currentMat, mats]);

  const categoryLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mats) {
      for (const c of m.categories || []) {
        map.set(c.id, c.label);
      }
    }
    return map;
  }, [mats]);

  if (liveQuery.isLoading) {
    return (
      <Box
        sx={{
          minHeight: '60vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (liveQuery.isError) {
    return (
      <Container maxWidth='md' sx={{ mt: 4 }}>
        <Typography color='error'>Не удалось загрузить очередь.</Typography>
      </Container>
    );
  }

  return (
    <Box>
      <AppBar position='sticky' color='default' elevation={1}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>{competitionName}</Typography>
          <Tabs
            value={currentMat}
            onChange={(_, v) => setCurrentMat(Number(v))}
            variant='scrollable'
            scrollButtons='auto'
          >
            {Array.from({ length: matsCount }, (_, i) => i + 1).map((m) => (
              <Tab key={m} value={m} label={`Помост ${m}`} />
            ))}
          </Tabs>
        </Box>
      </AppBar>

      <Container maxWidth='md' sx={{ mt: 3, mb: 5 }}>
        {!currentMatState ? (
          <Typography>Нет данных.</Typography>
        ) : (
          <Box display='grid' gap={2}>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Сейчас
                </Typography>
                {currentMatState.current_bout ? (
                  <BoutLine
                    bout={currentMatState.current_bout}
                    categoryLabel={
                      categoryLabelMap.get(currentMatState.current_bout.category_id) ||
                      `Категория ${currentMatState.current_bout.category_id.slice(0, 6)}`
                    }
                  />
                ) : (
                  <Typography color='text.secondary'>Сейчас нет активного боя.</Typography>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Следующий
                </Typography>
                {currentMatState.next_bout ? (
                  <BoutLine
                    bout={currentMatState.next_bout}
                    categoryLabel={
                      categoryLabelMap.get(currentMatState.next_bout.category_id) ||
                      `Категория ${currentMatState.next_bout.category_id.slice(0, 6)}`
                    }
                  />
                ) : (
                  <Typography color='text.secondary'>Следующего боя нет.</Typography>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Очередь
                </Typography>
                {currentMatState.queue.length === 0 ? (
                  <Typography color='text.secondary'>Очередь пустая.</Typography>
                ) : (
                  <Box display='grid' gap={1.5}>
                    {[...currentMatState.queue]
                      .sort((a, b) => (a.order_in_mat || 0) - (b.order_in_mat || 0))
                      .slice(0, 20)
                      .map((b, idx) => (
                        <Box key={b.id}>
                          <Typography variant='body2' color='text.secondary'>
                            #{idx + 1}
                          </Typography>
                          <BoutLine
                            bout={b}
                            categoryLabel={
                              categoryLabelMap.get(b.category_id) ||
                              `Категория ${b.category_id.slice(0, 6)}`
                            }
                          />
                        </Box>
                      ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        )}
      </Container>
    </Box>
  );
}
