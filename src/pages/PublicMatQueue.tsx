import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
  const isByeBout = (bout: LiveBout) => {
    const s = String(bout.stage || '').toLowerCase();
    return (s === 'bye' || s.startsWith('bye')) && bout.athlete_red_name === bout.athlete_blue_name;
  };
  const stageGroupRank = (bout: LiveBout) => {
    if (bout.bracket_type !== 'double_elim') return 0;
    const s = String(bout.stage || '').toLowerCase();
    if (s.startsWith('lb') || s.startsWith('bye_lb')) return 0;
    if (s === 'wb' || s.startsWith('bye_wb') || s === 'bye') return 1;
    if (s.startsWith('final') || s === 'semifinal') return 2;
    return 3;
  };

  const baseCategoryOrder = useMemo(() => {
    const fromLeft = (mat.categories || []).map((c) => c.id).filter((x) => x);
    if (fromLeft.length) return fromLeft;
    const active = (mat.queue || []).filter(
      (b) => b.status !== 'cancelled' && b.status !== 'done' && !isByeBout(b),
    );
    if (active.length === 0) return [];
    const minRound = Math.min(...active.map((b) => Number(b.round_index || 0)));
    const firstRound = active
      .filter((b) => Number(b.round_index || 0) === minRound)
      .sort(
        (a, b) =>
          (a.order_in_mat || 0) - (b.order_in_mat || 0) ||
          String(a.id || '').localeCompare(String(b.id || '')),
      );
    const out: string[] = [];
    const seen = new Set<string>();
    for (const b of firstRound) {
      const cid = String(b.category_id || '');
      if (!cid || seen.has(cid)) continue;
      seen.add(cid);
      out.push(cid);
    }
    return out;
  }, [mat.categories, mat.queue]);

  const queueRounds = useMemo(() => {
    const activeRoundGroupKeys = new Set<string>();
    for (const b of mat.queue || []) {
      if (!b || b.status === 'cancelled' || b.status === 'done') continue;
      if (isByeBout(b)) continue;
      if (!b.category_id) continue;
      activeRoundGroupKeys.add(`${b.category_id}:${b.round_index || 0}:${stageGroupRank(b)}`);
    }

    const queue = (mat.queue || []).filter((b) => {
      if (!b) return false;
      if (b.status === 'cancelled') return false;
      if (b.status !== 'done') return true;
      if (!isByeBout(b)) return false;
      if (!b.category_id) return false;
      const k = `${b.category_id}:${b.round_index || 0}:${stageGroupRank(b)}`;
      return activeRoundGroupKeys.has(k);
    });

    const sorted = [...queue].sort((a, b) => {
      const ra = a.round_index || 0;
      const rb = b.round_index || 0;
      if (ra !== rb) return ra - rb;
      const ga = stageGroupRank(a);
      const gb = stageGroupRank(b);
      if (ga !== gb) return ga - gb;
      const ba = isByeBout(a) ? 1 : 0;
      const bb = isByeBout(b) ? 1 : 0;
      if (ba !== bb) return ba - bb;
      return (a.order_in_mat || 0) - (b.order_in_mat || 0);
    });

    const rounds = new Map<number, LiveBout[]>();
    for (const b of sorted) {
      const r = Number(b.round_index || 0);
      if (r <= 0) continue;
      rounds.set(r, [...(rounds.get(r) || []), b]);
    }
    return Array.from(rounds.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, bouts]) => {
        const byCat = new Map<string, LiveBout[]>();
        for (const b of bouts) {
          byCat.set(b.category_id, [...(byCat.get(b.category_id) || []), b]);
        }
        const preferred = baseCategoryOrder.length
          ? baseCategoryOrder
          : (mat.categories || []).map((c) => c.id);
        const unknownCats = Array.from(byCat.keys()).filter((cid) => !preferred.includes(cid));
        const cats = [...preferred.filter((cid) => byCat.has(cid)), ...unknownCats];
        return {
          round,
          categories: cats.map((cid) => ({
            categoryId: cid,
            label: categoryLabelMap.get(cid) || `Категория ${cid.slice(0, 6)}`,
            bouts: byCat.get(cid) || [],
          })),
        };
      });
  }, [mat.queue, mat.categories, baseCategoryOrder, categoryLabelMap]);

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
            {queueRounds.length === 0 ? (
              <Typography color='text.secondary'>Очередь пустая.</Typography>
            ) : (
              <Box>
                {queueRounds.map((r, rIdx) => (
                  <Accordion
                    key={`r-${r.round}`}
                    defaultExpanded={rIdx === 0}
                    disableGutters
                    sx={{ mb: 1 }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography sx={{ fontWeight: 700 }}>Круг {r.round}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {r.categories.map((c, cIdx) => (
                        <Accordion
                          key={`r-${r.round}-c-${c.categoryId}`}
                          defaultExpanded={rIdx === 0 && cIdx < 2}
                          disableGutters
                          sx={{ mb: 1, borderLeft: '3px solid #e0e0e0', pl: 1 }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>{c.label}</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box display='grid' gap={1.25}>
                              {c.bouts.map((b) => (
                                <BoutLine key={b.id} bout={b} context={getBoutContext(b)} />
                              ))}
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </AccordionDetails>
                  </Accordion>
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
  const [searchParams] = useSearchParams();
  const [currentMat, setCurrentMat] = useState(1);
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));

  const liveQuery = useQuery<LiveState>({
    queryKey: ['public_live_state', compId, searchParams.get('day') || null],
    queryFn: () => {
      const day = Number(searchParams.get('day') || 0);
      return liveService.getLiveState(
        compId!,
        Number.isFinite(day) && day > 0 ? { day_index: day } : undefined,
      );
    },
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
      <Box sx={{ mt: 4, px: 2 }}>
        <Typography color='error'>Не удалось загрузить очередь.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <AppBar position='sticky' color='default' elevation={1}>
        <Box sx={{ px: { xs: 1, md: 1.5 }, py: 1 }}>
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

      <Box sx={{ mt: 1, mb: 2, px: { xs: 0.25, md: 0.5 }, width: '100%' }}>
        {mats.length === 0 ? (
          <Typography>Нет данных.</Typography>
        ) : isLargeScreen ? (
          <Box
            display='grid'
            gap={1}
            sx={{
              gridTemplateColumns:
                matsCount >= 3
                  ? 'repeat(3, minmax(0, 1fr))'
                  : `repeat(${matsCount}, minmax(0, 1fr))`,
              alignItems: 'start',
              width: '100%',
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
      </Box>
    </Box>
  );
}
