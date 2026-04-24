import axios from 'axios';
import { supabase } from '../lib/supabase';

const decodeBase64UrlJson = (value: string): any => {
  const base64 = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
  const decoded = atob(base64);
  return JSON.parse(decoded);
};

const getJwtExpSeconds = (token: string): number | null => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = decodeBase64UrlJson(parts[1]);
    const exp = payload?.exp;
    const n = Number(exp);
    if (!Number.isFinite(n)) return null;
    return n;
  } catch {
    return null;
  }
};

const isJwtExpired = (token: string, skewSeconds = 15): boolean => {
  const exp = getJwtExpSeconds(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= exp - Math.max(0, skewSeconds);
};

const api = axios.create({
  baseURL: `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}/api/v1`,
});

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('auth_access_token');
  if (token && !isJwtExpired(token)) {
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }
  if (token && isJwtExpired(token)) {
    try {
      localStorage.removeItem('auth_access_token');
      localStorage.removeItem('last_role');
    } catch (e) {
      void e;
    }
    window.dispatchEvent(new Event('auth_token_cleared'));
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config as any;
    if (status === 401 && originalRequest && !originalRequest.__retry401) {
      originalRequest.__retry401 = true;
      try {
        localStorage.removeItem('auth_access_token');
        localStorage.removeItem('last_role');
      } catch (e) {
        void e;
      }
      window.dispatchEvent(new Event('auth_token_cleared'));

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api.request(originalRequest);
      }
    }
    return Promise.reject(error);
  },
);

type CompetitionCreatePayload = {
  name: string;
  description?: string;
  preview_url?: string;
  scale: 'world' | 'country' | 'region';
  type: 'open' | 'restricted';
  location_id?: string;
  city?: string;
  street?: string;
  house?: string;
  mandate_date: string | null;
  start_date: string | null;
  end_date: string | null;
  mats_count: number;
  categories: Array<{
    gender: 'male' | 'female';
    age_min: number;
    age_max: number;
    weight_min: number;
    weight_max: number;
  }>;
  secretaries?: string[];
};

type ApplicationUpdatePayload = {
  status: 'pending' | 'approved' | 'rejected' | 'weighed';
  comment?: string | null;
  category_id?: string | null;
  actual_weight?: number | null;
};

export const competitionService = {
  getCompetitions: async () => {
    const response = await api.get('/competitions/');
    return response.data;
  },
  createCompetition: async (data: CompetitionCreatePayload) => {
    const response = await api.post('/competitions/', data);
    return response.data;
  },
  updateCompetition: async (id: string, data: Partial<CompetitionCreatePayload>) => {
    const response = await api.patch(`/competitions/${id}/`, data);
    return response.data;
  },
  getCompetitionDetails: async (id: string) => {
    const response = await api.get(`/competitions/${id}`);
    return response.data;
  },
  uploadCompetitionPreview: async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post(`/competitions/${id}/preview`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { preview_url: string };
  },
};

export const applicationService = {
  getApplications: async (competitionId?: string) => {
    const params = competitionId ? { competition_id: competitionId } : {};
    const response = await api.get('/applications/', { params });
    return response.data;
  },
  getApplicationDetails: async (id: string) => {
    const response = await api.get(`/applications/${id}`);
    return response.data;
  },
  uploadPassportPhoto: async (applicationId: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    const response = await api.post(`/applications/${applicationId}/passport/photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { ok: boolean; photo_url: string };
  },
  updateApplication: async (id: string, data: ApplicationUpdatePayload) => {
    const response = await api.patch(`/applications/${id}/`, data);
    return response.data;
  },
  verifyPassport: async (passportId: string, isVerified: boolean) => {
    const response = await api.patch(`/applications/passport/${passportId}/verify`, {
      is_verified: isVerified,
    });
    return response.data;
  },
  adminCreateAthleteAndApplication: async (payload: {
    category_id: string;
    full_name: string;
    city: string;
    location_id: string;
    coach_name: string;
    birth_date: string;
    gender?: string | null;
    series?: string | null;
    number?: string | null;
    issued_by?: string | null;
    issue_date?: string | null;
    rank: string;
    photo_url: string;
    passport_scan_url?: string | null;
    declared_weight?: number | null;
    actual_weight?: number | null;
  }) => {
    const response = await api.post('/applications/admin-create', payload);
    return response.data;
  },
  adminUpdateAthleteProfile: async (
    applicationId: string,
    payload: {
      full_name: string;
      phone?: string | null;
      email?: string | null;
      city: string;
      location_id: string;
      coach_name: string;
      birth_date: string;
      gender?: string | null;
      series?: string | null;
      number?: string | null;
      issued_by?: string | null;
      issue_date?: string | null;
      rank: string;
      photo_url: string;
      passport_scan_url?: string | null;
    },
  ) => {
    const response = await api.put(`/applications/${applicationId}/athlete-profile`, payload);
    return response.data;
  },
  adminApplyAthleteToCategory: async (payload: { athlete_id: string; category_id: string }) => {
    const response = await api.post('/applications/admin-apply', payload);
    return response.data;
  },
};

export const userService = {
  getRoles: async () => {
    const response = await api.get('/users/roles');
    return response.data;
  },
  searchUsers: async (query: string) => {
    const response = await api.get('/users/search', { params: { query } });
    return response.data;
  },
  assignRoles: async (userId: string, roleCodes: string[], locationId?: string) => {
    const response = await api.post(`/users/${userId}/roles`, {
      role_codes: roleCodes,
      location_id: locationId,
    });
    return response.data;
  },
  getAdmins: async () => {
    const response = await api.get('/users/admins');
    return response.data;
  },
  getSecretaries: async (locationId?: string) => {
    const params = locationId ? { location_id: locationId } : {};
    const response = await api.get('/users/secretaries', { params });
    return response.data;
  },
  createAdmin: async (payload: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role_codes: string[];
    location_id?: string;
  }) => {
    const response = await api.post('/users/admin-create', payload);
    return response.data;
  },
  deleteUser: async (userId: string) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },
  getAthletes: async (query?: string) => {
    const params = query ? { query } : {};
    const response = await api.get('/users/athletes', { params });
    return response.data as Array<{
      athlete_id: string;
      user_id: string;
      full_name?: string | null;
      phone?: string | null;
      city?: string | null;
      location_id?: string | null;
      email?: string | null;
      coach_name?: string | null;
      birth_date?: string | null;
      gender?: string | null;
      rank?: string | null;
      photo_url?: string | null;
    }>;
  },
  getAthleteDetails: async (athleteId: string) => {
    const response = await api.get(`/users/athletes/${athleteId}`);
    return response.data as {
      athlete_id: string;
      user_id: string;
      full_name?: string | null;
      phone?: string | null;
      city?: string | null;
      location_id?: string | null;
      coach_name?: string | null;
      birth_date?: string | null;
      gender?: string | null;
      rank?: string | null;
      photo_url?: string | null;
      stage?: string | null;
      locked: boolean;
    };
  },
  updateAthleteDetails: async (
    athleteId: string,
    payload: {
      full_name?: string | null;
      phone?: string | null;
      city?: string | null;
      location_id?: string | null;
      coach_name?: string | null;
      birth_date?: string | null;
      gender?: string | null;
      series?: string | null;
      number?: string | null;
      issued_by?: string | null;
      issue_date?: string | null;
      rank?: string | null;
      photo_url?: string | null;
      passport_scan_url?: string | null;
    },
  ) => {
    const response = await api.put(`/users/athletes/${athleteId}`, payload);
    return response.data;
  },
  setAthleteEditable: async (athleteId: string, editable: boolean) => {
    const response = await api.post(`/users/athletes/${athleteId}/editable`, { editable });
    return response.data as { ok: boolean; stage: string; locked: boolean };
  },
};

export const locationService = {
  getLocations: async (type?: string, parentId?: string) => {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    if (parentId) params.parent_id = parentId;
    const response = await api.get('/locations/', { params });
    return response.data;
  },
  getLocationPath: async (locationId: string) => {
    const response = await api.get('/locations/path', { params: { location_id: locationId } });
    return response.data as {
      country_id?: string | null;
      district_id?: string | null;
      region_id?: string | null;
    };
  },
};

export const liveService = {
  getLiveState: async (competitionId: string, opts?: { day_index?: number }) => {
    const response = await api.get(`/live/competitions/${competitionId}/state`, {
      params: opts?.day_index ? { day_index: opts.day_index } : undefined,
    });
    return response.data;
  },
  getCompetitionResults: async (competitionId: string) => {
    const response = await api.get(`/live/competitions/${competitionId}/results`);
    return response.data;
  },
  exportCategoryCsv: async (competitionId: string, categoryId: string) => {
    const response = await api.get(
      `/live/competitions/${competitionId}/categories/${categoryId}/export.csv`,
      { responseType: 'blob' },
    );
    return response.data as Blob;
  },
  generateLiveBouts: async (
    competitionId: string,
    forceRegenerate = false,
    rebalanceAssignments = false,
    options?: { active_mats?: number[]; finals_mat?: number | null; day_index?: number | null },
  ) => {
    const response = await api.post(`/live/competitions/${competitionId}/generate`, {
      force_regenerate: forceRegenerate,
      rebalance_assignments: rebalanceAssignments,
      active_mats: options?.active_mats,
      finals_mat: options?.finals_mat ?? undefined,
      day_index: options?.day_index ?? undefined,
    });
    return response.data;
  },
  startBout: async (boutId: string) => {
    const response = await api.post(`/live/bouts/${boutId}/start`);
    return response.data;
  },
  finishBout: async (boutId: string, winnerAthleteId: string) => {
    const response = await api.post(`/live/bouts/${boutId}/finish`, {
      winner_athlete_id: winnerAthleteId,
    });
    return response.data;
  },
  cancelBout: async (boutId: string) => {
    const response = await api.post(`/live/bouts/${boutId}/cancel`);
    return response.data;
  },
  rollbackMat: async (
    competitionId: string,
    matNumber: number,
    toBoutId?: string,
    lastCount = 1,
  ) => {
    const response = await api.post(`/live/competitions/${competitionId}/rollback`, {
      mat_number: matNumber,
      to_bout_id: toBoutId,
      last_count: lastCount,
    });
    return response.data;
  },
  moveCategory: async (competitionId: string, categoryId: string, toMatNumber: number) => {
    const response = await api.post(`/live/categories/${categoryId}/move`, {
      competition_id: competitionId,
      to_mat_number: toMatNumber,
    });
    return response.data;
  },
  stopCompetition: async (competitionId: string, clearAssignments = true) => {
    const response = await api.post(`/live/competitions/${competitionId}/stop`, {
      clear_assignments: clearAssignments,
    });
    return response.data;
  },
  withdrawAthlete: async (
    competitionId: string,
    athleteId: string,
    reason: 'medical' | 'no_show',
  ) => {
    const response = await api.post(`/live/competitions/${competitionId}/withdraw`, {
      athlete_id: athleteId,
      reason,
    });
    return response.data;
  },
};

export default api;
