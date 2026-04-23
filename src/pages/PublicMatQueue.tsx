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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { liveService } from '../services/api';

type LiveBout = {
  id: string;
  category_id: string;
  bracket_type?: 'round_robin' | 'double_elim';
  athlete_red_name?: string;
  athlete_blue_name?: string;
  athlete_red_team?: string;
  athlete_blue_team?: string;
  round_index: number;
  stage: string | null;
  is_final?: boolean;
  is_tiebreak?: boolean;
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
  notices?: Array<{
    kind: 'finals_moved';
    category_id: string;
    label: string;
    to_mat: number;
    athlete_red_name: string;
    athlete_blue_name: string;
  }>;
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
    selected_day?: string | null;
  };
  mats: LiveMat[];
};

function BoutLine({ bout, context }: { bout: LiveBout; context: string }) {
  const a = bout.athlete_red_name || '—';
  const b = bout.athlete_blue_name || '—';
  const ta = bout.athlete_red_team || '';
  const tb = bout.athlete_blue_team || '';
  const aLabel = ta ? `${a} (${ta})` : a;
  const bLabel = tb ? `${b} (${tb})` : b;
  const s = String(bout.stage || '').toLowerCase();
  const isBye = (s === 'bye' || s.startsWith('bye')) && (!bout.athlete_blue_name || a === b);
  const title = isBye ? aLabel : `${aLabel} vs ${bLabel}`;
  const red = bout.red_wins;
  const blue = bout.blue_wins;
  const to = bout.wins_to ?? 1;
  const score = red !== undefined && blue !== undefined ? `${red}:${blue} (до ${to})` : null;
  const statusLabel =
    bout.status === 'running'
      ? 'идёт'
      : bout.status === 'next'
        ? 'следующий'
        : bout.status === 'queued'
          ? 'в очереди'
          : bout.status === 'done'
            ? 'завершён'
            : 'отменён';

  return (
    <Box>
      <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
      <Typography variant='body2' color='text.secondary'>
        {context}
        {score ? ` • ${score}` : ''}
        {bout.status ? ` • ${statusLabel}` : ''}
      </Typography>
    </Box>
  );
}

function MatOverview({
  mat,
  categoryLabelMap,
}: {
  mat: LiveMat;
  categoryLabelMap: Map<string, string>;
}) {
  const current = mat.current_bout;
  const next = mat.next_bout;
  const getBoutContext = (bout: LiveBout) => {
    const catLabel = categoryLabelMap.get(bout.category_id) || '';
    const parts = [catLabel, `Круг ${bout.round_index}`];
    if (bout.bracket_type === 'double_elim') {
      if (bout.is_final) parts.push('Финал');
      if (bout.is_tiebreak) parts.push('Стыковой');
      const s = (bout.stage || '').toLowerCase();
      if (s === 'wb' || s.startsWith('bye_wb') || s === 'bye') {
        parts.push('Группа А');
      } else if (s.startsWith('lb') || s.startsWith('bye_lb')) {
        parts.push('Группа Б');
      } else if (s.startsWith('final') || s === 'semifinal') {
        parts.push('Финалы');
      }
    }
    return parts.filter(Boolean).join(' • ');
  };

  return (
    <Card>
      <CardContent>
        <Typography variant='h6' sx={{ fontWeight: 800 }} gutterBottom>
          Помост {mat.mat_number}
        </Typography>

        <Box display='grid' gap={2}>
          {mat.notices && mat.notices.length > 0 ? (
            <Box display='grid' gap={1}>
              {mat.notices.map((n, idx) => (
                <Typography key={`${n.kind}-${idx}`} variant='body2' color='text.secondary'>
                  Финал категории «{n.label}» перенесён на помост {n.to_mat}: {n.athlete_red_name}{' '}
                  vs {n.athlete_blue_name}
                </Typography>
              ))}
            </Box>
          ) : null}
          <Box>
            <Typography sx={{ fontWeight: 700 }} gutterBottom>
              Сейчас
            </Typography>
            {current ? (
              <BoutLine bout={current} context={getBoutContext(current)} />
            ) : (
              <Typography color='text.secondary'>Сейчас нет активного боя.</Typography>
            )}
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700 }} gutterBottom>
              Следующий
            </Typography>
            {next ? (
              <BoutLine bout={next} context={getBoutContext(next)} />
            ) : (
              <Typography color='text.secondary'>Следующего боя нет.</Typography>
            )}
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700 }} gutterBottom>
              Очередь
            </Typography>
            {mat.queue.length === 0 ? (
              <Typography color='text.secondary'>Очередь пустая.</Typography>
            ) : (
              <Box display='grid' gap={1.5}>
                {[...mat.queue]
                  .sort((a, b) => (a.order_in_mat || 0) - (b.order_in_mat || 0))
                  .slice(0, 10)
                  .map((b, idx) => (
                    <Box key={b.id}>
                      <Typography variant='body2' color='text.secondary'>
                        #{idx + 1}
                      </Typography>
                      <BoutLine bout={b} context={getBoutContext(b)} />
                    </Box>
                  ))}
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function PublicMatQueue() {
  const { compId } = useParams<{ compId: string }>();
  const [currentMat, setCurrentMat] = useState(1);
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));

  const liveQuery = useQuery<LiveState>({
    queryKey: ['public_live_state', compId],
    queryFn: () => liveService.getLiveState(compId!),
    enabled: !!compId,
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const mats = useMemo(() => liveQuery.data?.mats || [], [liveQuery.data?.mats]);
  const matsCount = liveQuery.data?.competition?.mats_count || 1;
  const competitionName = liveQuery.data?.competition?.name || 'Очередь';
  const selectedDay = liveQuery.data?.competition?.selected_day || null;

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

  const getBoutContext = (bout: LiveBout) => {
    const catLabel = categoryLabelMap.get(bout.category_id) || '';
    const parts = [catLabel, `Круг ${bout.round_index}`];
    if (bout.bracket_type === 'double_elim') {
      if (bout.is_final) parts.push('Финал');
      if (bout.is_tiebreak) parts.push('Стыковой');
      const s = (bout.stage || '').toLowerCase();
      if (s === 'wb' || s.startsWith('bye_wb') || s === 'bye') {
        parts.push('Группа А');
      } else if (s.startsWith('lb') || s.startsWith('bye_lb')) {
        parts.push('Группа Б');
      } else if (s.startsWith('final') || s === 'semifinal') {
        parts.push('Финалы');
      }
    }
    return parts.filter(Boolean).join(' • ');
  };

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
          {selectedDay ? (
            <Typography variant='body2' color='text.secondary'>
              День: {selectedDay}
            </Typography>
          ) : null}
          {!isLargeScreen && (
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
          )}
        </Box>
      </AppBar>

      <Container maxWidth={isLargeScreen ? 'xl' : 'md'} sx={{ mt: 3, mb: 5 }}>
        {mats.length === 0 ? (
          <Typography>Нет данных.</Typography>
        ) : isLargeScreen ? (
          <Box
            display='grid'
            gap={2}
            sx={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              alignItems: 'start',
            }}
          >
            {mats
              .slice()
              .sort((a, b) => a.mat_number - b.mat_number)
              .map((m) => (
                <MatOverview key={m.mat_number} mat={m} categoryLabelMap={categoryLabelMap} />
              ))}
          </Box>
        ) : !currentMatState ? (
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
                    context={getBoutContext(currentMatState.current_bout)}
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
                    context={getBoutContext(currentMatState.next_bout)}
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
                          <BoutLine bout={b} context={getBoutContext(b)} />
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
