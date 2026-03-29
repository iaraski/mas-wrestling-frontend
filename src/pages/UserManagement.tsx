import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { locationService, userService } from '../services/api';

type Role = {
  id: string;
  code: string;
};

type Location = {
  id: string;
  name: string;
  type: 'world' | 'country' | 'district' | 'region';
};

type UserProfile = {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  roles: string[];
  location_id?: string | null;
  location_name?: string | null;
};

type RoleScope = 'world' | 'country' | 'region' | 'founder' | 'none' | 'mixed';

const getScopeFromRoles = (roleCodes: string[]): RoleScope => {
  if (roleCodes.length === 0) return 'none';
  const scopes = new Set<RoleScope>();
  for (const code of roleCodes) {
    if (code === 'founder') scopes.add('founder');
    else if (code.startsWith('world_')) scopes.add('world');
    else if (code.startsWith('country_')) scopes.add('country');
    else if (code.startsWith('region_')) scopes.add('region');
    else scopes.add('none');
  }
  if (scopes.size === 1) return [...scopes][0];
  return 'mixed';
};

const UserManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPhone, setCreatePhone] = useState('');

  const [createCountryId, setCreateCountryId] = useState('');
  const [createDistrictId, setCreateDistrictId] = useState('');
  const [createRegionId, setCreateRegionId] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const roleScope = getScopeFromRoles(selectedRoles);
  const hasAdmin = selectedRoles.some((r) => r.includes('admin'));
  const hasSecretary = selectedRoles.some((r) => r.includes('secretary'));

  const { data: admins, isLoading: adminsLoading } = useQuery<UserProfile[]>({
    queryKey: ['admins'],
    queryFn: userService.getAdmins,
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: userService.getRoles,
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationService.getLocations(),
  });

  const { data: countries } = useQuery<Location[]>({
    queryKey: ['countries'],
    queryFn: () => locationService.getLocations('country'),
  });

  const { data: districts } = useQuery<Location[]>({
    queryKey: ['districts', createCountryId],
    queryFn: () => locationService.getLocations('district', createCountryId),
    enabled: !!createCountryId,
  });

  const { data: regions } = useQuery<Location[]>({
    queryKey: ['regions', createDistrictId],
    queryFn: () => locationService.getLocations('region', createDistrictId),
    enabled: !!createDistrictId,
  });

  const assignMutation = useMutation({
    mutationFn: ({
      userId,
      roleCodes,
      locationId,
    }: {
      userId: string;
      roleCodes: string[];
      locationId?: string;
    }) => userService.assignRoles(userId, roleCodes, locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setOpen(false);
      setDialogMode('create');
      setSelectedUser(null);
      setSelectedRoles([]);
      setSelectedLocation('');
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role_codes: string[];
      location_id?: string;
    }) => userService.createAdmin(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setOpen(false);
      setDialogMode('create');
      setSelectedUser(null);
      setSelectedRoles([]);
      setSelectedLocation('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateFullName('');
      setCreatePhone('');
      setCreateCountryId('');
      setCreateDistrictId('');
      setCreateRegionId('');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const detail =
          (err.response?.data as { detail?: string } | undefined)?.detail ??
          err.response?.statusText;
        alert(`Ошибка создания: ${status ?? '—'} ${detail ?? ''}`.trim());
        return;
      }
      alert('Ошибка создания: неизвестная ошибка');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => userService.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (err) => {
      alert('Ошибка удаления пользователя');
      console.error(err);
    },
  });

  const effectiveLocationId =
    dialogMode === 'edit'
      ? selectedLocation || undefined
      : roleScope === 'country'
        ? createCountryId || undefined
        : roleScope === 'region'
          ? createRegionId || undefined
          : undefined;

  const openCreateDialog = () => {
    setDialogMode('create');
    setSelectedUser(null);
    setSelectedRoles([]);
    setSelectedLocation('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateFullName('');
    setCreatePhone('');
    setCreateCountryId('');
    setCreateDistrictId('');
    setCreateRegionId('');
    setOpen(true);
  };

  const openDeleteDialog = (user: UserProfile) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.user_id);
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setDialogMode('edit');
    setSelectedUser(user);
    setSelectedRoles(user.roles || []);
    setSelectedLocation(user.location_id || '');
    setOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    assignMutation.mutate({
      userId: selectedUser.user_id,
      roleCodes: selectedRoles,
      locationId: selectedLocation || undefined,
    });
  };

  const handleCreateAdmin = () => {
    createMutation.mutate({
      email: createEmail.trim(),
      password: createPassword,
      full_name: createFullName.trim(),
      phone: createPhone.trim() || undefined,
      role_codes: selectedRoles,
      location_id: effectiveLocationId,
    });
  };

  if (adminsLoading)
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );

  return (
    <Container maxWidth='lg' sx={{ mt: 4 }}>
      <Box display='flex' justifyContent='space-between' alignItems='center' mb={4}>
        <Box display='flex' alignItems='center'>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant='h4'>Управление администраторами</Typography>
        </Box>
        <Button variant='contained' startIcon={<PersonAddIcon />} onClick={openCreateDialog}>
          Добавить админа
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ФИО</TableCell>
              <TableCell>Локация</TableCell>
              <TableCell>Email / Телефон</TableCell>
              <TableCell>Роли</TableCell>
              <TableCell align='right'>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {admins?.map((admin) => (
              <TableRow key={admin.user_id}>
                <TableCell>{admin.full_name}</TableCell>
                <TableCell>{admin.location_name || '—'}</TableCell>
                <TableCell>
                  {admin.email || 'Нет email'}
                  <br />
                  <Typography variant='caption' color='text.secondary'>
                    {admin.phone}
                  </Typography>
                </TableCell>
                <TableCell>
                  {admin.roles.map((r) => (
                    <Chip
                      key={r}
                      label={r}
                      size='small'
                      sx={{ mr: 0.5, mb: 0.5 }}
                      color='primary'
                      variant='outlined'
                    />
                  ))}
                </TableCell>
                <TableCell align='right'>
                  <IconButton onClick={() => openEditDialog(admin)} color='primary'>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => openDeleteDialog(admin)} color='error'>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Удаление пользователя</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить пользователя <b>{userToDelete?.full_name}</b>?
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            Это действие необратимо.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button
            onClick={handleConfirmDelete}
            color='error'
            variant='contained'
            disabled={deleteMutation.isPending}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setSelectedUser(null);
        }}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>
          {dialogMode === 'edit' ? 'Редактировать роли' : 'Создать администратора'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {dialogMode === 'create' && (
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label='Email'
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type='password'
                    label='Пароль'
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label='ФИО'
                    value={createFullName}
                    onChange={(e) => setCreateFullName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label='Телефон (опционально)'
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {dialogMode === 'edit' && selectedUser && (
            <Typography variant='subtitle1' gutterBottom>
              Пользователь: <b>{selectedUser.full_name}</b>
            </Typography>
          )}

          {dialogMode === 'edit' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Привязка к локации</InputLabel>
              <Select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                input={<OutlinedInput label='Привязка к локации' />}
              >
                <MenuItem value=''>
                  <em>Нет привязки</em>
                </MenuItem>
                {locations
                  ?.filter((loc) => loc.type === 'country' || loc.type === 'region')
                  .map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type === 'country' ? 'Страна' : 'Регион'})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Выберите роли</InputLabel>
            <Select
              multiple
              value={selectedRoles}
              onChange={(e) => setSelectedRoles(e.target.value as string[])}
              input={<OutlinedInput label='Выберите роли' />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
            >
              {roles?.map((role) => {
                const isCurrentRoleAdmin = role.code.includes('admin');
                const isCurrentRoleSecretary = role.code.includes('secretary');

                const scope = getScopeFromRoles([role.code]);
                const disabledByScope =
                  dialogMode === 'create' &&
                  roleScope !== 'none' &&
                  roleScope !== 'mixed' &&
                  scope !== 'none' &&
                  scope !== roleScope;

                const disabledByExclusivity =
                  (isCurrentRoleAdmin && hasSecretary) || (isCurrentRoleSecretary && hasAdmin);

                const disabled = disabledByScope || disabledByExclusivity || roleScope === 'mixed';

                return (
                  <MenuItem key={role.id} value={role.code} disabled={disabled}>
                    <Checkbox checked={selectedRoles.indexOf(role.code) > -1} />
                    <ListItemText primary={role.code} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          {dialogMode === 'create' && roleScope === 'country' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Страна</InputLabel>
              <Select
                value={createCountryId}
                onChange={(e) => {
                  setCreateCountryId(e.target.value);
                  setCreateDistrictId('');
                  setCreateRegionId('');
                }}
                input={<OutlinedInput label='Страна' />}
              >
                {countries?.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {dialogMode === 'create' && roleScope === 'region' && (
            <Box>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Страна</InputLabel>
                <Select
                  value={createCountryId}
                  onChange={(e) => {
                    setCreateCountryId(e.target.value);
                    setCreateDistrictId('');
                    setCreateRegionId('');
                  }}
                  input={<OutlinedInput label='Страна' />}
                >
                  {countries?.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mt: 2 }} disabled={!createCountryId}>
                <InputLabel>Округ</InputLabel>
                <Select
                  value={createDistrictId}
                  onChange={(e) => {
                    setCreateDistrictId(e.target.value);
                    setCreateRegionId('');
                  }}
                  input={<OutlinedInput label='Округ' />}
                >
                  {districts?.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mt: 2 }} disabled={!createDistrictId}>
                <InputLabel>Регион</InputLabel>
                <Select
                  value={createRegionId}
                  onChange={(e) => setCreateRegionId(e.target.value)}
                  input={<OutlinedInput label='Регион' />}
                >
                  {regions?.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {r.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {dialogMode === 'create' && roleScope === 'mixed' && (
            <Typography color='error' sx={{ mt: 2 }}>
              Роли разных уровней нельзя назначать вместе.
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setOpen(false);
              setSelectedUser(null);
            }}
          >
            Отмена
          </Button>

          {dialogMode === 'edit' && (
            <Button
              onClick={handleSaveEdit}
              variant='contained'
              disabled={!selectedUser || selectedRoles.length === 0 || assignMutation.isPending}
            >
              Сохранить
            </Button>
          )}

          {dialogMode === 'create' && (
            <Button
              onClick={handleCreateAdmin}
              variant='contained'
              disabled={
                createMutation.isPending ||
                selectedRoles.length === 0 ||
                roleScope === 'mixed' ||
                !createEmail.trim() ||
                !createPassword ||
                !createFullName.trim() ||
                ((roleScope === 'country' || roleScope === 'region') && !effectiveLocationId)
              }
            >
              Создать
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UserManagement;
