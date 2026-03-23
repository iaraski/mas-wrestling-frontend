import axios from 'axios';
import { supabase } from '../lib/supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

type CompetitionCreatePayload = {
  name: string;
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
};

export const locationService = {
  getLocations: async (type?: string, parentId?: string) => {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    if (parentId) params.parent_id = parentId;
    const response = await api.get('/locations/', { params });
    return response.data;
  },
};

export default api;
