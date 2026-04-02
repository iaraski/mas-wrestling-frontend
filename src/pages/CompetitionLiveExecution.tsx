import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { liveService } from '../services/api';

type LiveBout = {
  id: string;
  category_id: string;
  athlete_red_id: string;
  athlete_blue_id: string;
  athlete_red_name?: string;
  athlete_blue_name?: string;
  bracket_type: 'round_robin' | 'double_elim';
  round_index: number;
  stage: string | null;
  status: 'queued' | 'next' | 'running' | 'done' | 'cancelled';
  winner_athlete_id: string | null;
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
  history?: LiveBout[];
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

export default function CompetitionLiveExecution() {
  const { compId } = useParams<{ compId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentMat, setCurrentMat] = useState(1);
  const [expandedRoundKeys, setExpandedRoundKeys] = useState<Record<string, boolean>>({});
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const liveQuery = useQuery<LiveState>({
    queryKey: ['live_state', compId],
    queryFn: () => liveService.getLiveState(compId!),
    enabled: !!compId,
    refetchOnWindowFocus: false,
  });

  const mats = liveQuery.data?.mats || [];
  const matsCount = liveQuery.data?.competition?.mats_count || 1;
  const hasStarted = liveQuery.data?.competition?.has_started || false;
  const hasBouts = liveQuery.data?.competition?.has_bouts || false;

  useEffect(() => {
    if (!compId) return;

    const channel = supabase
      .channel(`live:${compId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competition_bouts',
          filter: `competition_id=eq.${compId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live_state', compId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competition_mats',
          filter: `competition_id=eq.${compId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live_state', compId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competition_category_assignments',
          filter: `competition_id=eq.${compId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live_state', compId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [compId, queryClient]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      return liveService.generateLiveBouts(compId!, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_state', compId] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Не удалось сгенерировать Live.';
      setActionError(String(msg));
    },
  });

  const rebalanceMutation = useMutation({
    mutationFn: async () => {
      return liveService.generateLiveBouts(compId!, true, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_state', compId] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Не удалось перераспределить помосты.';
      setActionError(String(msg));
    },
  });

  const startMutation = useMutation({
    mutationFn: async (boutId: string) => {
      return liveService.startBout(boutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_state', compId] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Нельзя начать этот бой сейчас.';
      setActionError(String(msg));
    },
  });

  const finishMutation = useMutation({
    mutationFn: async ({
      boutId,
      winnerAthleteId,
    }: {
      boutId: string;
      winnerAthleteId: string;
    }) => {
      return liveService.finishBout(boutId, winnerAthleteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_state', compId] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail || err?.response?.data?.message || 'Не удалось завершить бой.';
      setActionError(String(msg));
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      return liveService.stopCompetition(compId!, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live_state', compId] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Не удалось прекратить соревнование.';
      setActionError(String(msg));
    },
  });

  useEffect(() => {
    if (currentMat < 1 || currentMat > matsCount) {
      setCurrentMat(1);
    }
  }, [currentMat, matsCount]);

  const currentMatState = useMemo(
    () => mats.find((m) => m.mat_number === currentMat) || null,
    [mats, currentMat],
  );

  const boutNames = (bout: LiveBout) => {
    const a = bout.athlete_red_name || bout.athlete_red_id;
    const b = bout.athlete_blue_name || bout.athlete_blue_id;
    return `${a} vs ${b}`;
  };

  const boutScore = (bout: LiveBout) => {
    const red = bout.red_wins ?? 0;
    const blue = bout.blue_wins ?? 0;
    const to = bout.wins_to ?? 1;
    return `${red}:${blue} (до ${to})`;
  };

  const categoryLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    currentMatState?.categories.forEach((c) => map.set(c.id, c.label));
    return map;
  }, [currentMatState]);

  const queueRounds = useMemo(() => {
    if (!currentMatState) return [];
    const queue = currentMatState.queue.filter(
      (b) => b.status !== 'done' && b.status !== 'cancelled',
    );
    const sorted = [...queue].sort((a, b) => (a.order_in_mat || 0) - (b.order_in_mat || 0));

    const roundMap = new Map<
      string,
      { key: string; label: string; order: number; bouts: LiveBout[] }
    >();
    for (const b of sorted) {
      const key = `round:${b.round_index}`;
      const label = `Круг ${b.round_index}`;
      const order = b.round_index;
      const existing = roundMap.get(key);
      if (existing) {
        existing.bouts.push(b);
      } else {
        roundMap.set(key, { key, label, order, bouts: [b] });
      }
    }

    return Array.from(roundMap.values()).sort((a, b) => a.order - b.order);
  }, [currentMatState]);

  const categoryOrderForBouts = (bouts: LiveBout[]) => {
    const catOrder: string[] = [];
    const seen = new Set<string>();
    for (const b of bouts) {
      const cat = b.category_id;
      if (!seen.has(cat)) {
        seen.add(cat);
        catOrder.push(cat);
      }
    }
    return catOrder;
  };

  useEffect(() => {
    if (queueRounds.length === 0) return;
    if (Object.keys(expandedRoundKeys).length > 0 || Object.keys(expandedCategoryKeys).length > 0)
      return;

    const firstRound = queueRounds[0];
    const catOrder = categoryOrderForBouts(firstRound.bouts);
    const topCats = catOrder.slice(0, 2);

    setExpandedRoundKeys({ [firstRound.key]: true });
    const catState: Record<string, boolean> = {};
    for (const catId of topCats) {
      catState[`${firstRound.key}:${catId}`] = true;
    }
    setExpandedCategoryKeys(catState);
  }, [queueRounds, expandedRoundKeys, expandedCategoryKeys]);

  if (liveQuery.isLoading) {
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (liveQuery.isError || !liveQuery.data) {
    return (
      <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
        <Typography color='error'>Не удалось загрузить live-состояние соревнования.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
      <Box display='flex' justifyContent='space-between' alignItems='center' mb={2} gap={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/competitions/${compId}`)}>
          Назад
        </Button>
        <Button
          variant='contained'
          color='warning'
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || hasStarted}
        >
          {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать Live'}
        </Button>
        <Button
          variant='contained'
          color='error'
          onClick={() => rebalanceMutation.mutate()}
          disabled={rebalanceMutation.isPending || hasStarted}
        >
          {rebalanceMutation.isPending ? 'Перераспределение...' : 'Перераспределить помосты'}
        </Button>
        <Button
          variant='outlined'
          color='error'
          onClick={() => {
            if (!hasBouts && !hasStarted) return;
            const ok = window.confirm('Прекратить соревнование и удалить все поединки?');
            if (ok) stopMutation.mutate();
          }}
          disabled={stopMutation.isPending || (!hasBouts && !hasStarted)}
        >
          {stopMutation.isPending ? 'Остановка...' : 'Прекратить'}
        </Button>
      </Box>

      <Typography variant='h4' gutterBottom>
        Проведение (Live) — {liveQuery.data.competition.name}
      </Typography>
      {actionError ? (
        <Box mb={2}>
          <Alert severity='warning' onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        </Box>
      ) : null}
      {currentMatState?.current_round != null ? (
        <Typography variant='subtitle2' color='textSecondary' gutterBottom>
          Текущий круг (помост {currentMat}): {currentMatState.current_round}
        </Typography>
      ) : null}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentMat} onChange={(_, val) => setCurrentMat(val)}>
          {Array.from({ length: matsCount }, (_, i) => i + 1).map((mat) => (
            <Tab key={mat} label={`Помост ${mat}`} value={mat} />
          ))}
        </Tabs>
      </Box>

      {!currentMatState ? (
        <Paper sx={{ p: 3 }}>
          <Typography>Нет данных по помосту.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' gutterBottom>
                Категории на помосте
              </Typography>
              {currentMatState.categories.length === 0 ? (
                <Typography color='textSecondary'>Пока не назначены.</Typography>
              ) : (
                currentMatState.categories.map((c, idx) => (
                  <Box key={c.id}>
                    <Typography>{c.label}</Typography>
                    {idx < currentMatState.categories.length - 1 ? (
                      <Divider sx={{ my: 1 }} />
                    ) : null}
                  </Box>
                ))
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' gutterBottom>
                Сейчас / Следующий
              </Typography>

              {currentMatState.current_bout ? (
                <Card sx={{ mb: 2, borderLeft: '4px solid #4caf50' }}>
                  <CardContent>
                    <Typography variant='subtitle2' color='textSecondary'>
                      Сейчас
                    </Typography>
                    <Typography variant='h6'>{boutNames(currentMatState.current_bout)}</Typography>
                    <Typography variant='subtitle2' color='textSecondary'>
                      {boutScore(currentMatState.current_bout)}
                    </Typography>
                    <Box display='flex' gap={1} mt={2} flexWrap='wrap'>
                      {currentMatState.current_bout.status !== 'running' ? (
                        <Button
                          variant='contained'
                          onClick={() => startMutation.mutate(currentMatState.current_bout!.id)}
                          disabled={startMutation.isPending}
                        >
                          Начать
                        </Button>
                      ) : null}
                      {currentMatState.current_bout.status === 'running' ? (
                        <>
                          <Button
                            variant='contained'
                            color='error'
                            onClick={() =>
                              finishMutation.mutate({
                                boutId: currentMatState.current_bout!.id,
                                winnerAthleteId: currentMatState.current_bout!.athlete_red_id,
                              })
                            }
                            disabled={finishMutation.isPending}
                          >
                            Победа (красный)
                          </Button>
                          <Button
                            variant='contained'
                            color='primary'
                            onClick={() =>
                              finishMutation.mutate({
                                boutId: currentMatState.current_bout!.id,
                                winnerAthleteId: currentMatState.current_bout!.athlete_blue_id,
                              })
                            }
                            disabled={finishMutation.isPending}
                          >
                            Победа (синий)
                          </Button>
                        </>
                      ) : null}
                    </Box>
                  </CardContent>
                </Card>
              ) : (
                <Typography color='textSecondary' sx={{ mb: 2 }}>
                  Сейчас нет активного боя.
                </Typography>
              )}

              {currentMatState.next_bout ? (
                <Card sx={{ mb: 2, borderLeft: '4px solid #2196f3' }}>
                  <CardContent>
                    <Typography variant='subtitle2' color='textSecondary'>
                      Следующий
                    </Typography>
                    <Typography variant='h6'>{boutNames(currentMatState.next_bout)}</Typography>
                  </CardContent>
                </Card>
              ) : (
                <Typography color='textSecondary'>Следующего боя нет.</Typography>
              )}

              <Typography variant='h6' gutterBottom sx={{ mt: 2 }}>
                Очередь
              </Typography>
              {queueRounds.length === 0 ? (
                <Typography color='textSecondary'>Очередь пустая.</Typography>
              ) : (
                <Box>
                  {queueRounds.slice(0, 5).map((r, rIdx) => {
                    const catMap = new Map<string, LiveBout[]>();
                    const catOrder: string[] = [];
                    for (const b of r.bouts) {
                      const cat = b.category_id;
                      if (!catMap.has(cat)) {
                        catMap.set(cat, []);
                        catOrder.push(cat);
                      }
                      catMap.get(cat)!.push(b);
                    }

                    const roundExpanded = expandedRoundKeys[r.key] ?? rIdx === 0;

                    return (
                      <Accordion
                        key={r.key}
                        expanded={roundExpanded}
                        onChange={(_, isExpanded) =>
                          setExpandedRoundKeys((prev) => ({ ...prev, [r.key]: isExpanded }))
                        }
                        disableGutters
                        sx={{ mb: 1 }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant='subtitle1'>{r.label}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          {catOrder.map((catId, catIdx) => {
                            const catLabel =
                              categoryLabelMap.get(catId) || `Категория ${catId.slice(0, 6)}`;
                            const bouts = (catMap.get(catId) || []).slice(0, 20);
                            const catKey = `${r.key}:${catId}`;
                            const alwaysOpen = rIdx === 0 && catIdx < 2;
                            const catExpanded = expandedCategoryKeys[catKey] ?? alwaysOpen;

                            return (
                              <Accordion
                                key={catKey}
                                expanded={catExpanded}
                                onChange={(_, isExpanded) =>
                                  setExpandedCategoryKeys((prev) => ({
                                    ...prev,
                                    [catKey]: isExpanded,
                                  }))
                                }
                                disableGutters
                                sx={{ mb: 1, borderLeft: '3px solid #e0e0e0', pl: 1 }}
                              >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                  <Typography variant='subtitle2'>{catLabel}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                  {bouts.map((b) => (
                                    <Box
                                      key={b.id}
                                      display='flex'
                                      justifyContent='space-between'
                                      py={0.75}
                                    >
                                      <Typography sx={{ pr: 1 }}>{boutNames(b)}</Typography>
                                      <Typography variant='caption' color='textSecondary'>
                                        {b.status}
                                      </Typography>
                                    </Box>
                                  ))}
                                </AccordionDetails>
                              </Accordion>
                            );
                          })}
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
              )}

              <Typography variant='h6' gutterBottom sx={{ mt: 3 }}>
                История
              </Typography>
              {!currentMatState.history || currentMatState.history.length === 0 ? (
                <Typography color='textSecondary'>Пока пусто.</Typography>
              ) : (
                currentMatState.history.slice(0, 20).map((b) => {
                  const winner =
                    b.winner_athlete_id === b.athlete_red_id
                      ? b.athlete_red_name || b.athlete_red_id
                      : b.athlete_blue_name || b.athlete_blue_id;
                  const score =
                    b.red_wins !== undefined && b.blue_wins !== undefined
                      ? ` • счёт ${b.red_wins}:${b.blue_wins}`
                      : '';
                  return (
                    <Box
                      key={`hist-${b.id}`}
                      display='flex'
                      justifyContent='space-between'
                      py={0.75}
                    >
                      <Typography sx={{ pr: 1 }}>{boutNames(b)}</Typography>
                      <Typography variant='caption' color='textSecondary'>
                        Победитель: {winner}
                        {score}
                      </Typography>
                    </Box>
                  );
                })
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}
