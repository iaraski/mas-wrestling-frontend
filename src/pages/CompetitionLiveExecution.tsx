import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DownloadIcon from '@mui/icons-material/Download';
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
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  athlete_red_team?: string;
  athlete_blue_team?: string;
  bracket_type: 'round_robin' | 'double_elim';
  round_index: number;
  stage: string | null;
  is_final?: boolean;
  is_tiebreak?: boolean;
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
  categories: Array<{ id: string; label: string; day?: string | null }>;
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
    days?: string[];
    selected_day?: string | null;
    selected_day_index?: number | null;
    finals_mat?: number | null;
    has_bouts: boolean;
    has_started: boolean;
    is_finished?: boolean;
    total_bouts?: number;
    done_bouts?: number;
    remaining_bouts?: number;
    results_path?: string;
  };
  mats: LiveMat[];
};

type GenerateLiveResponse = {
  status: string;
  competition_id: string;
  mats_count: number;
  categories: number;
  bouts_created: number;
  generated_at: string;
};

type CompetitionResults = {
  competition: {
    id: string;
    name: string;
    is_finished: boolean;
  };
  totals: {
    total_bouts: number;
    done_bouts: number;
    remaining_bouts: number;
  };
  champions: Array<{
    category_id: string;
    category_label: string;
    athlete_id: string;
    name: string;
  }>;
  categories: Array<{
    category_id: string;
    label: string;
    bracket_type: string | null;
    total_bouts: number;
    done_bouts: number;
    is_finished: boolean;
    winners: Array<{
      place: number;
      athlete_id: string;
      name: string;
      weight?: number | null;
      team?: string | null;
      win_points?: number;
      loss_points?: number;
      diff_points?: number;
    }>;
  }>;
};

export default function CompetitionLiveExecution() {
  const { compId } = useParams<{ compId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [forceLiveView, setForceLiveView] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);
  const [currentMat, setCurrentMat] = useState(1);
  const [expandedRoundKeys, setExpandedRoundKeys] = useState<Record<string, boolean>>({});
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForce, setGenerateForce] = useState(false);
  const [generateRebalance, setGenerateRebalance] = useState(false);
  const [generateFinalsMat, setGenerateFinalsMat] = useState<number | ''>('');
  const [generateMatsEnabled, setGenerateMatsEnabled] = useState<boolean[]>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAthleteId, setWithdrawAthleteId] = useState<string | null>(null);
  const [withdrawAthleteLabel, setWithdrawAthleteLabel] = useState<string>('');
  const [withdrawReason, setWithdrawReason] = useState<'medical' | 'no_show'>('medical');
  const resultsRefetchTimerRef = useRef<number | null>(null);
  const resultsCommitTimerRef = useRef<number | null>(null);
  const liveRefetchTimerRef = useRef<number | null>(null);
  const latestResultsRef = useRef<CompetitionResults | null>(null);
  const [stableResults, setStableResults] = useState<CompetitionResults | null>(null);
  const formatWeight = (w?: number | null) =>
    typeof w === 'number' && Number.isFinite(w) ? w.toFixed(2).replace(/\.?0+$/, '') : '—';

  const liveStateQueryKey = useMemo(
    () => ['live_state', compId, selectedDayIndex] as const,
    [compId, selectedDayIndex],
  );

  const liveQuery = useQuery<LiveState>({
    queryKey: liveStateQueryKey,
    queryFn: () => liveService.getLiveState(compId!, { day_index: selectedDayIndex }),
    enabled: !!compId && selectedDayIndex > 0,
    refetchOnWindowFocus: false,
  });

  const mats = useMemo(() => liveQuery.data?.mats || [], [liveQuery.data?.mats]);
  const matsCount = liveQuery.data?.competition?.mats_count || 1;
  const hasStarted = liveQuery.data?.competition?.has_started || false;
  const hasBouts = liveQuery.data?.competition?.has_bouts || false;
  const isFinished = liveQuery.data?.competition?.is_finished || false;
  const days = useMemo(
    () => liveQuery.data?.competition?.days || [],
    [liveQuery.data?.competition?.days],
  );

  const showResultsView = isFinished ? !forceLiveView : resultsOpen;

  const resultsQuery = useQuery<CompetitionResults>({
    queryKey: ['competition_results', compId],
    queryFn: () => liveService.getCompetitionResults(compId!),
    enabled: !!compId,
    refetchOnWindowFocus: false,
    refetchInterval: showResultsView ? 5_000 : false,
    refetchIntervalInBackground: showResultsView,
  });

  useEffect(() => {
    latestResultsRef.current = resultsQuery.data || null;
  }, [resultsQuery.data]);

  useEffect(() => {
    setStableResults(null);
    if (resultsCommitTimerRef.current) {
      window.clearTimeout(resultsCommitTimerRef.current);
      resultsCommitTimerRef.current = null;
    }
  }, [compId]);

  useEffect(() => {
    if (!showResultsView) return;
    if (!compId) return;
    queryClient.refetchQueries({ queryKey: ['competition_results', compId] });
  }, [compId, queryClient, showResultsView]);

  useEffect(() => {
    if (!showResultsView) return;
    if (!stableResults && resultsQuery.data) {
      setStableResults(resultsQuery.data);
    }
  }, [resultsQuery.data, showResultsView, stableResults]);

  useEffect(() => {
    if (!showResultsView) return;
    if (!latestResultsRef.current) return;
    if (resultsCommitTimerRef.current) {
      window.clearTimeout(resultsCommitTimerRef.current);
    }
    resultsCommitTimerRef.current = window.setTimeout(() => {
      setStableResults(latestResultsRef.current);
      resultsCommitTimerRef.current = null;
    }, 600);
  }, [resultsQuery.data, showResultsView]);

  const scheduleResultsRefetch = useCallback(() => {
    if (!showResultsView || !compId) return;
    if (resultsRefetchTimerRef.current) {
      window.clearTimeout(resultsRefetchTimerRef.current);
    }
    resultsRefetchTimerRef.current = window.setTimeout(() => {
      queryClient.refetchQueries({ queryKey: ['competition_results', compId] });
      resultsRefetchTimerRef.current = null;
    }, 700);
  }, [compId, queryClient, showResultsView]);

  const scheduleLiveRefetch = useCallback(() => {
    if (!compId) return;
    if (liveRefetchTimerRef.current) {
      window.clearTimeout(liveRefetchTimerRef.current);
    }
    liveRefetchTimerRef.current = window.setTimeout(() => {
      queryClient.refetchQueries({ queryKey: liveStateQueryKey });
      liveRefetchTimerRef.current = null;
    }, 450);
  }, [compId, queryClient, liveStateQueryKey]);

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
          scheduleLiveRefetch();
          scheduleResultsRefetch();
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
          scheduleLiveRefetch();
          scheduleResultsRefetch();
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
          scheduleLiveRefetch();
          scheduleResultsRefetch();
        },
      )
      .subscribe();

    return () => {
      if (resultsRefetchTimerRef.current) {
        window.clearTimeout(resultsRefetchTimerRef.current);
        resultsRefetchTimerRef.current = null;
      }
      if (resultsCommitTimerRef.current) {
        window.clearTimeout(resultsCommitTimerRef.current);
        resultsCommitTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [
    compId,
    queryClient,
    scheduleLiveRefetch,
    scheduleResultsRefetch,
    showResultsView,
    liveStateQueryKey,
  ]);

  const generateMutation = useMutation({
    mutationFn: async (): Promise<GenerateLiveResponse> => {
      const active = generateMatsEnabled
        .map((v, idx) => (v ? idx + 1 : null))
        .filter((v): v is number => typeof v === 'number');
      const finalsMat = generateFinalsMat === '' ? null : Number(generateFinalsMat);
      return liveService.generateLiveBouts(compId!, generateForce, generateRebalance, {
        active_mats: active,
        finals_mat: finalsMat,
        day_index: selectedDayIndex || null,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
      setGenerateOpen(false);
      if (!data?.bouts_created) {
        setActionError(
          'Live сгенерирован, но поединки не созданы. Проверь, что участники имеют статус «Взвешен» (weighed) и в категории минимум 2 спортсмена.',
        );
      }
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Не удалось сгенерировать Live.';
      setActionError(String(msg));
    },
  });

  const moveCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, toMat }: { categoryId: string; toMat: number }) => {
      return liveService.moveCategory(compId!, categoryId, toMat);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Не удалось переместить категорию.';
      setActionError(String(msg));
    },
  });

  const reorderMatCategoriesMutation = useMutation({
    mutationFn: async ({
      matNumber,
      categoryIds,
    }: {
      matNumber: number;
      categoryIds: string[];
    }) => {
      return liveService.reorderMatCategories(compId!, matNumber, categoryIds);
    },
    onMutate: async ({ matNumber, categoryIds }) => {
      await queryClient.cancelQueries({ queryKey: liveStateQueryKey });
      const previous = queryClient.getQueryData<LiveState>(liveStateQueryKey);
      if (!previous) return { previous };

      const next: LiveState = {
        ...previous,
        mats: previous.mats.map((m) => {
          if (m.mat_number !== matNumber) return m;
          const byId = new Map(m.categories.map((c) => [c.id, c] as const));
          const ordered = categoryIds
            .map((id) => byId.get(id))
            .filter(Boolean) as LiveMat['categories'];
          const rest = m.categories.filter((c) => !categoryIds.includes(c.id));
          return { ...m, categories: [...ordered, ...rest] };
        }),
      };

      queryClient.setQueryData(liveStateQueryKey, next);
      return { previous };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(liveStateQueryKey, ctx.previous);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Не удалось изменить порядок категорий.';
      setActionError(String(msg));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
    },
  });

  const downloadCategoryCsv = async (categoryId: string, label: string) => {
    if (!compId) return;
    const safe = String(label || 'category')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const filename = `${safe || categoryId}.csv`;
    const blob = await liveService.exportCategoryCsv(compId, categoryId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const withdrawMutation = useMutation({
    mutationFn: async ({
      athleteId,
      reason,
    }: {
      athleteId: string;
      reason: 'medical' | 'no_show';
    }) => {
      return liveService.withdrawAthlete(compId!, athleteId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
      scheduleLiveRefetch();
      setWithdrawOpen(false);
      setWithdrawAthleteId(null);
      setWithdrawAthleteLabel('');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Не удалось снять спортсмена с соревнований.';
      setActionError(String(msg));
    },
  });

  const startMutation = useMutation({
    mutationFn: async (boutId: string) => {
      return liveService.startBout(boutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
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
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail || err?.response?.data?.message || 'Не удалось завершить бой.';
      setActionError(String(msg));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (boutId: string) => {
      return liveService.cancelBout(boutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail || err?.response?.data?.message || 'Не удалось сбросить бой.';
      setActionError(String(msg));
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ toBoutId, lastCount }: { toBoutId?: string; lastCount?: number }) => {
      return liveService.rollbackMat(compId!, currentMat, toBoutId, lastCount ?? 1);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || '';
      const msg =
        detail === 'Stop the running bout before rollback'
          ? 'Сначала сбросьте текущий поединок (кнопка «Сбросить» или завершите бой), затем повторите откат.'
          : detail || 'Не удалось откатить поединки.';
      setActionError(String(msg));
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      return liveService.stopCompetition(compId!, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: liveStateQueryKey });
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

  useEffect(() => {
    const idx = Number(selectedDayIndex || 1);
    if (days.length <= 0) return;
    if (idx < 1 || idx > days.length) {
      setSelectedDayIndex(1);
    }
  }, [days, selectedDayIndex]);

  useEffect(() => {
    setGenerateMatsEnabled((prev) => {
      if (prev.length === matsCount) return prev;
      return Array.from({ length: matsCount }, () => true);
    });
  }, [matsCount]);

  const currentMatState = useMemo(
    () => mats.find((m) => m.mat_number === currentMat) || null,
    [mats, currentMat],
  );
  const hasRunningBout = Boolean(currentMatState?.current_bout?.status === 'running');

  const isByeBout = (bout: LiveBout) =>
    bout.athlete_red_id === bout.athlete_blue_id &&
    (bout.stage === 'bye' || Boolean(bout.stage && bout.stage.startsWith('bye')));

  const boutNames = (bout: LiveBout) => {
    const a = bout.athlete_red_name || bout.athlete_red_id;
    const b = bout.athlete_blue_name || bout.athlete_blue_id;
    const ta = bout.athlete_red_team || '';
    const tb = bout.athlete_blue_team || '';
    const aLabel = ta ? `${a} (${ta})` : `${a}`;
    const bLabel = tb ? `${b} (${tb})` : `${b}`;
    if (isByeBout(bout)) return `${aLabel}`;
    return `${aLabel} vs ${bLabel}`;
  };

  const boutScore = (bout: LiveBout) => {
    const red = bout.red_wins ?? 0;
    const blue = bout.blue_wins ?? 0;
    const to = bout.wins_to ?? 1;
    return `${red}:${blue} (до ${to})`;
  };

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

  const queueRounds = useMemo(() => {
    if (!currentMatState) return [];
    const groupRank = (bout: LiveBout) => {
      if (bout.bracket_type !== 'double_elim') return 0;
      const s = String(bout.stage || '').toLowerCase();
      if (s.startsWith('lb') || s.startsWith('bye_lb')) return 0;
      if (s === 'wb' || s.startsWith('bye_wb') || s === 'bye') return 1;
      if (s.startsWith('final') || s === 'semifinal') return 2;
      return 3;
    };

    const activeRoundGroupKeys = new Set<string>();
    for (const b of currentMatState.queue || []) {
      if (!b || b.status === 'cancelled' || b.status === 'done') continue;
      if (isByeBout(b)) continue;
      if (!b.category_id) continue;
      activeRoundGroupKeys.add(`${b.category_id}:${b.round_index || 0}:${groupRank(b)}`);
    }

    const queue = (currentMatState.queue || []).filter((b) => {
      if (!b) return false;
      if (b.status === 'cancelled') return false;
      if (b.status !== 'done') return true;
      if (!isByeBout(b)) return false;
      if (!b.category_id) return false;
      const k = `${b.category_id}:${b.round_index || 0}:${groupRank(b)}`;
      return activeRoundGroupKeys.has(k);
    });
    const sorted = [...queue].sort((a, b) => {
      const ra = a.round_index || 0;
      const rb = b.round_index || 0;
      if (ra !== rb) return ra - rb;
      const ga = groupRank(a);
      const gb = groupRank(b);
      if (ga !== gb) return ga - gb;
      const ba = isByeBout(a) ? 1 : 0;
      const bb = isByeBout(b) ? 1 : 0;
      if (ba !== bb) return ba - bb;
      return (a.order_in_mat || 0) - (b.order_in_mat || 0);
    });

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

  const baseCategoryOrder = useMemo(() => {
    const fromLeft = (currentMatState?.categories || []).map((c) => c.id).filter((x) => x);
    if (fromLeft.length) return fromLeft;
    if (!currentMatState) return [];
    const active = (currentMatState.queue || []).filter(
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

  if (showResultsView) {
    if (!stableResults && resultsQuery.isLoading) {
      return (
        <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
          <Box display='flex' justifyContent='center' mt={4}>
            <CircularProgress />
          </Box>
        </Container>
      );
    }

    if (!stableResults && (resultsQuery.isError || !resultsQuery.data)) {
      return (
        <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
          <Box display='flex' justifyContent='space-between' alignItems='center' mb={2} gap={2}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/competitions/${compId}`)}
            >
              Назад
            </Button>
            <Button variant='outlined' onClick={() => resultsQuery.refetch()}>
              Обновить
            </Button>
          </Box>
          <Typography color='error'>Не удалось загрузить итоги соревнования.</Typography>
        </Container>
      );
    }

    const results = stableResults || resultsQuery.data!;
    const finishedCategories = (results.categories || []).filter((c) => c.is_finished);

    return (
      <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
        <Box display='flex' justifyContent='space-between' alignItems='center' mb={2} gap={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/competitions/${compId}`)}>
            Назад
          </Button>
          {isFinished ? (
            <Button variant='contained' onClick={() => setForceLiveView(true)}>
              Вернуться в Live
            </Button>
          ) : (
            <Button variant='contained' onClick={() => setResultsOpen(false)}>
              Вернуться в Live
            </Button>
          )}
          <Button variant='outlined' onClick={() => resultsQuery.refetch()}>
            {resultsQuery.isFetching ? 'Обновление...' : 'Обновить'}
          </Button>
        </Box>

        <Typography variant='h4' gutterBottom>
          Итоги — {results.competition.name}
        </Typography>

        <Typography variant='subtitle2' color='textSecondary' gutterBottom>
          Поединков: {results.totals.done_bouts}/{results.totals.total_bouts}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' gutterBottom>
                Призёры по категориям
              </Typography>
              {finishedCategories.length === 0 ? (
                <Typography color='textSecondary'>Пока нет завершённых категорий.</Typography>
              ) : (
                <Box display='flex' flexDirection='column' gap={2}>
                  {finishedCategories.map((cat) => (
                    <Box key={cat.category_id}>
                      <Typography variant='subtitle1'>{cat.label || cat.category_id}</Typography>
                      {cat.winners?.length ? (
                        <Box sx={{ overflowX: 'auto' }}>
                          <Table size='small' sx={{ mt: 1, minWidth: 760 }}>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ width: 70 }}>Место</TableCell>
                                <TableCell>ФИО</TableCell>
                                <TableCell sx={{ width: 110 }}>Вес</TableCell>
                                <TableCell>Команда</TableCell>
                                <TableCell sx={{ width: 150 }}>Победы</TableCell>
                                <TableCell sx={{ width: 160 }}>Поражения</TableCell>
                                <TableCell sx={{ width: 110 }}>Разница</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {cat.winners.map((w) => (
                                <TableRow key={`${cat.category_id}:${w.place}:${w.athlete_id}`}>
                                  <TableCell>{w.place}</TableCell>
                                  <TableCell>{w.name || '—'}</TableCell>
                                  <TableCell>{`${formatWeight(w.weight)} кг`}</TableCell>
                                  <TableCell>{w.team || '—'}</TableCell>
                                  <TableCell>{w.win_points ?? 0}</TableCell>
                                  <TableCell>{w.loss_points ?? 0}</TableCell>
                                  <TableCell>{w.diff_points ?? 0}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      ) : (
                        <Typography color='textSecondary'>Нет данных.</Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {!isFinished ? (
          <Box mt={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' gutterBottom>
                Категории в процессе
              </Typography>
              {(results.categories || []).filter((c) => !c.is_finished).length === 0 ? (
                <Typography color='textSecondary'>Нет.</Typography>
              ) : (
                <List dense>
                  {(results.categories || [])
                    .filter((c) => !c.is_finished)
                    .map((c) => (
                      <ListItem key={c.category_id} disableGutters>
                        <ListItemText
                          primary={c.label || c.category_id}
                          secondary={`Поединков: ${c.done_bouts}/${c.total_bouts}`}
                        />
                      </ListItem>
                    ))}
                </List>
              )}
            </Paper>
          </Box>
        ) : null}
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
          variant='outlined'
          onClick={() => {
            if (isFinished) setForceLiveView(false);
            else setResultsOpen(true);
          }}
          disabled={!hasBouts}
        >
          Показать итоги
        </Button>
        <Button
          variant='contained'
          color='warning'
          onClick={() => {
            setGenerateForce(hasStarted);
            setGenerateRebalance(false);
            setGenerateOpen(true);
          }}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать Live'}
        </Button>
        <Button
          variant='contained'
          color='error'
          onClick={() => {
            setGenerateForce(true);
            setGenerateRebalance(true);
            setGenerateOpen(true);
          }}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Перераспределение...' : 'Перераспределить помосты'}
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

      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Генерация Live</DialogTitle>
        <DialogContent dividers>
          <Box display='flex' flexDirection='column' gap={2}>
            {hasStarted ? (
              <Alert severity='warning'>
                Соревнование уже начато. Для пересоздания поединков нужно включить
                «Перегенерировать».
              </Alert>
            ) : null}
            <FormControlLabel
              control={
                <Checkbox checked={generateForce} onChange={(_, v) => setGenerateForce(v)} />
              }
              label='Перегенерировать (удалит текущие поединки)'
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={generateRebalance}
                  onChange={(_, v) => setGenerateRebalance(v)}
                />
              }
              label='Перераспределить категории по помостам'
            />

            <FormControl fullWidth>
              <InputLabel>Помост для финалов</InputLabel>
              <Select
                value={generateFinalsMat}
                label='Помост для финалов'
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setGenerateFinalsMat(val as any);
                }}
              >
                <MenuItem value=''>Не выбран</MenuItem>
                {Array.from({ length: matsCount }, (_, i) => i + 1).map((m) => (
                  <MenuItem key={m} value={m}>
                    Помост {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant='subtitle2' gutterBottom>
                Использовать помосты для автоматического распределения
              </Typography>
              <Box display='flex' flexWrap='wrap' gap={1}>
                {Array.from({ length: matsCount }, (_, i) => i + 1).map((m, idx) => {
                  const finals = generateFinalsMat !== '' && Number(generateFinalsMat) === m;
                  const checked = Boolean(generateMatsEnabled[idx]) && !finals;
                  return (
                    <FormControlLabel
                      key={m}
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={(_, v) =>
                            setGenerateMatsEnabled((prev) => {
                              const next = [...prev];
                              next[idx] = v;
                              return next;
                            })
                          }
                          disabled={finals}
                        />
                      }
                      label={`Помост ${m}`}
                    />
                  );
                })}
              </Box>
              <Typography variant='caption' color='textSecondary'>
                Неиспользуемые помосты останутся пустыми. Категории можно переносить между помостами
                в любой момент.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)}>Отмена</Button>
          <Button
            variant='contained'
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || (hasStarted && !generateForce)}
          >
            {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Снять спортсмена</DialogTitle>
        <DialogContent dividers>
          <Box display='flex' flexDirection='column' gap={2}>
            <Typography variant='subtitle2'>
              {withdrawAthleteLabel ? withdrawAthleteLabel : 'Выберите спортсмена'}
            </Typography>
            <FormControl>
              <FormLabel>Причина</FormLabel>
              <RadioGroup
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value as any)}
              >
                <FormControlLabel
                  value='medical'
                  control={<Radio />}
                  label='Медицинские показания'
                />
                <FormControlLabel value='no_show' control={<Radio />} label='Неявка' />
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawOpen(false)}>Отмена</Button>
          <Button
            variant='contained'
            color='error'
            onClick={() => {
              if (!withdrawAthleteId) return;
              const ok = window.confirm(
                withdrawReason === 'no_show'
                  ? 'Отметить неявку? Спортсмен полностью снимается с соревнований и не участвует дальше.'
                  : 'Снять по медицинским? Спортсмен не участвует дальше, но может быть награждён.',
              );
              if (!ok) return;
              withdrawMutation.mutate({ athleteId: withdrawAthleteId, reason: withdrawReason });
            }}
            disabled={!withdrawAthleteId || withdrawMutation.isPending}
          >
            {withdrawMutation.isPending ? 'Снятие...' : 'Снять'}
          </Button>
        </DialogActions>
      </Dialog>
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

      {days.length > 1 ? (
        <Box mb={2} display='flex' justifyContent='flex-end'>
          <FormControl size='small' sx={{ minWidth: 220 }}>
            <InputLabel>День</InputLabel>
            <Select
              value={selectedDayIndex || 1}
              label='День'
              onChange={(e) => setSelectedDayIndex(Number(e.target.value))}
            >
              {days.map((d, idx) => (
                <MenuItem key={d} value={idx + 1}>
                  День {idx + 1} • {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title='Выше'>
                        <span>
                          <IconButton
                            size='small'
                            onClick={() => {
                              const nextCats = [...currentMatState.categories];
                              const t = nextCats[idx - 1];
                              nextCats[idx - 1] = nextCats[idx];
                              nextCats[idx] = t;
                              reorderMatCategoriesMutation.mutate({
                                matNumber: currentMat,
                                categoryIds: nextCats.map((x) => x.id),
                              });
                            }}
                            disabled={
                              !hasBouts ||
                              idx === 0 ||
                              reorderMatCategoriesMutation.isPending ||
                              moveCategoryMutation.isPending
                            }
                          >
                            <ArrowUpwardIcon fontSize='small' />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title='Ниже'>
                        <span>
                          <IconButton
                            size='small'
                            onClick={() => {
                              const nextCats = [...currentMatState.categories];
                              const t = nextCats[idx + 1];
                              nextCats[idx + 1] = nextCats[idx];
                              nextCats[idx] = t;
                              reorderMatCategoriesMutation.mutate({
                                matNumber: currentMat,
                                categoryIds: nextCats.map((x) => x.id),
                              });
                            }}
                            disabled={
                              !hasBouts ||
                              idx >= currentMatState.categories.length - 1 ||
                              reorderMatCategoriesMutation.isPending ||
                              moveCategoryMutation.isPending
                            }
                          >
                            <ArrowDownwardIcon fontSize='small' />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Typography sx={{ flex: 1 }}>{c.label}</Typography>
                      <Tooltip title='Выгрузить CSV'>
                        <IconButton
                          size='small'
                          onClick={() => downloadCategoryCsv(c.id, c.label)}
                          disabled={!hasBouts}
                        >
                          <DownloadIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                      <FormControl size='small' sx={{ minWidth: 120 }}>
                        <InputLabel>Помост</InputLabel>
                        <Select
                          value={currentMat}
                          label='Помост'
                          onChange={(e) =>
                            moveCategoryMutation.mutate({
                              categoryId: c.id,
                              toMat: Number(e.target.value),
                            })
                          }
                          disabled={
                            moveCategoryMutation.isPending || reorderMatCategoriesMutation.isPending
                          }
                        >
                          {Array.from({ length: matsCount }, (_, i) => i + 1).map((m) => (
                            <MenuItem key={m} value={m}>
                              {m}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
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
                      Сейчас • {getBoutContext(currentMatState.current_bout)}
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
                          <Button
                            variant='outlined'
                            color='warning'
                            onClick={() => {
                              const ok = window.confirm(
                                'Сбросить этот поединок? Очки и победитель будут очищены, и бой можно будет начать заново.',
                              );
                              if (ok) cancelMutation.mutate(currentMatState.current_bout!.id);
                            }}
                            disabled={cancelMutation.isPending}
                          >
                            Сбросить
                          </Button>
                          <Button
                            variant='outlined'
                            color='error'
                            onClick={() => {
                              setWithdrawReason('medical');
                              setWithdrawAthleteId(currentMatState.current_bout!.athlete_red_id);
                              setWithdrawAthleteLabel(
                                `Спортсмен: ${currentMatState.current_bout!.athlete_red_name || currentMatState.current_bout!.athlete_red_id}`,
                              );
                              setWithdrawOpen(true);
                            }}
                          >
                            Снять (красный)
                          </Button>
                          <Button
                            variant='outlined'
                            color='error'
                            onClick={() => {
                              setWithdrawReason('medical');
                              setWithdrawAthleteId(currentMatState.current_bout!.athlete_blue_id);
                              setWithdrawAthleteLabel(
                                `Спортсмен: ${currentMatState.current_bout!.athlete_blue_name || currentMatState.current_bout!.athlete_blue_id}`,
                              );
                              setWithdrawOpen(true);
                            }}
                          >
                            Снять (синий)
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
                      Следующий • {getBoutContext(currentMatState.next_bout)}
                    </Typography>
                    <Typography variant='h6'>{boutNames(currentMatState.next_bout)}</Typography>
                    <Box display='flex' gap={1} mt={2} flexWrap='wrap'>
                      {!currentMatState.current_bout ? (
                        <Button
                          variant='contained'
                          onClick={() => startMutation.mutate(currentMatState.next_bout!.id)}
                          disabled={startMutation.isPending}
                        >
                          Начать
                        </Button>
                      ) : null}
                      <Button
                        variant='outlined'
                        color='error'
                        onClick={() => {
                          setWithdrawReason('medical');
                          setWithdrawAthleteId(currentMatState.next_bout!.athlete_red_id);
                          setWithdrawAthleteLabel(
                            `Спортсмен: ${currentMatState.next_bout!.athlete_red_name || currentMatState.next_bout!.athlete_red_id}`,
                          );
                          setWithdrawOpen(true);
                        }}
                      >
                        Снять (красный)
                      </Button>
                      <Button
                        variant='outlined'
                        color='error'
                        onClick={() => {
                          setWithdrawReason('medical');
                          setWithdrawAthleteId(currentMatState.next_bout!.athlete_blue_id);
                          setWithdrawAthleteLabel(
                            `Спортсмен: ${currentMatState.next_bout!.athlete_blue_name || currentMatState.next_bout!.athlete_blue_id}`,
                          );
                          setWithdrawOpen(true);
                        }}
                      >
                        Снять (синий)
                      </Button>
                    </Box>
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
                    for (const b of r.bouts) {
                      const cat = b.category_id;
                      if (!catMap.has(cat)) {
                        catMap.set(cat, []);
                      }
                      catMap.get(cat)!.push(b);
                    }

                    const preferred = baseCategoryOrder.length
                      ? baseCategoryOrder
                      : (currentMatState?.categories || []).map((c) => c.id);
                    const unknownCats = Array.from(catMap.keys()).filter(
                      (cid) => !preferred.includes(cid),
                    );
                    const catOrder = [
                      ...preferred.filter((cid) => catMap.has(cid)),
                      ...unknownCats,
                    ];

                    const stageGroupRank = (bout: LiveBout) => {
                      if (bout.bracket_type !== 'double_elim') return 1;
                      const s = String(bout.stage || '').toLowerCase();
                      if (s.startsWith('lb') || s.startsWith('bye_lb')) return 0;
                      if (s === 'wb' || s.startsWith('bye_wb') || s === 'bye') return 1;
                      if (s.startsWith('final') || s === 'semifinal') return 2;
                      return 3;
                    };

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
                            const bouts = [...(catMap.get(catId) || [])]
                              .sort(
                                (a, b) =>
                                  stageGroupRank(a) - stageGroupRank(b) ||
                                  (isByeBout(a) ? 1 : 0) - (isByeBout(b) ? 1 : 0) ||
                                  (a.order_in_mat || 0) - (b.order_in_mat || 0) ||
                                  String(a.id || '').localeCompare(String(b.id || '')),
                              )
                              .slice(0, 20);
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
                                  {bouts.map((b) => {
                                    const grp =
                                      b.bracket_type === 'double_elim'
                                        ? (b.stage || '').toLowerCase()
                                        : '';
                                    let grpLabel = '';
                                    if (grp === 'wb' || grp.startsWith('bye_wb') || grp === 'bye')
                                      grpLabel = 'Группа А';
                                    else if (grp.startsWith('lb') || grp.startsWith('bye_lb'))
                                      grpLabel = 'Группа Б';
                                    else if (grp.startsWith('final') || grp === 'semifinal')
                                      grpLabel = 'Финалы';
                                    if (b.is_final)
                                      grpLabel = grpLabel ? `${grpLabel} • Финал` : 'Финал';
                                    if (b.is_tiebreak)
                                      grpLabel = grpLabel ? `${grpLabel} • Стыковой` : 'Стыковой';

                                    return (
                                      <Box
                                        key={b.id}
                                        display='flex'
                                        justifyContent='space-between'
                                        py={0.75}
                                      >
                                        <Typography sx={{ pr: 1 }}>{boutNames(b)}</Typography>
                                        <Typography variant='caption' color='textSecondary'>
                                          {grpLabel ? `${grpLabel} • ` : ''}
                                          {isByeBout(b) ? 'свободен' : b.status}
                                        </Typography>
                                      </Box>
                                    );
                                  })}
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
              {hasRunningBout ? (
                <Alert severity='warning' sx={{ mb: 1 }}>
                  Откат недоступен пока идёт поединок. Сначала сбросьте текущий поединок (кнопка
                  «Сбросить» или завершите бой), затем повторите откат.
                </Alert>
              ) : null}
              <Box mb={1}>
                <Button
                  size='small'
                  variant='outlined'
                  color='warning'
                  onClick={() => {
                    const ok = window.confirm(
                      'Откатить все результаты на этом ковре (к самому первому)?',
                    );
                    if (ok) rollbackMutation.mutate({ lastCount: 0 });
                  }}
                  disabled={rollbackMutation.isPending || hasRunningBout}
                >
                  Откатить всё
                </Button>
                {hasRunningBout && currentMatState?.current_bout?.id ? (
                  <Button
                    size='small'
                    variant='text'
                    color='warning'
                    sx={{ ml: 1 }}
                    onClick={() => {
                      const ok = window.confirm(
                        'Сбросить текущий поединок? Очки и победитель будут очищены, и бой можно будет начать заново.',
                      );
                      if (ok) cancelMutation.mutate(currentMatState.current_bout!.id);
                    }}
                    disabled={cancelMutation.isPending}
                  >
                    Сбросить бой
                  </Button>
                ) : null}
              </Box>
              {!currentMatState.history || currentMatState.history.length === 0 ? (
                <Typography color='textSecondary'>Пока пусто.</Typography>
              ) : (
                currentMatState.history
                  .filter((b) => !isByeBout(b))
                  .slice(0, 20)
                  .map((b) => {
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
                        <Box display='flex' alignItems='center' gap={1}>
                          <Typography variant='caption' color='textSecondary'>
                            Победитель: {winner}
                            {score}
                          </Typography>
                          <Button
                            size='small'
                            variant='text'
                            color='warning'
                            onClick={() => {
                              const ok = window.confirm(
                                'Сбросить этот поединок? Результаты будут очищены, связанные последующие поединки будут пересчитаны.',
                              );
                              if (ok) cancelMutation.mutate(b.id);
                            }}
                            disabled={cancelMutation.isPending || hasRunningBout}
                          >
                            Откатить
                          </Button>
                        </Box>
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
