import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { competitionService, locationService, userService } from '../services/api';

type Gender = 'male' | 'female';

type CompetitionCategoryForm = {
  id?: string;
  gender: Gender;
  age_min: number;
  age_max: number;
  weight_max: number;
  weight_min: number;
  competition_day: string;
  mandate_day: string;
};

type CategoryGroupForm = {
  gender: Gender;
  age_min: number;
  age_max: number;
  competition_day: string; // The specific day they compete
  mandate_day: string; // The specific day they have mandate commission
  weights: string[]; // Array of weight limits, e.g. ["60", "70", "80+"]
};

type CompetitionCreateFormValues = {
  name: string;
  description?: string;
  preview_url?: string;
  scale: 'world' | 'country' | 'region';
  type: 'open' | 'restricted';
  location_id: string;
  city: string;
  street: string;
  house: string;
  mandate_start_date: string;
  mandate_end_date: string;
  start_date: string;
  end_date: string;
  secretaries: string[];
  mats_count: number;
  category_groups: CategoryGroupForm[];
};

type Location = {
  id: string;
  name: string;
  type: 'world' | 'country' | 'district' | 'region';
};

type Secretary = {
  user_id: string;
  full_name?: string | null;
};

const CompetitionCreate = () => {
  const navigate = useNavigate();
  const { compId } = useParams<{ compId: string }>();
  const isEditMode = !!compId;
  const queryClient = useQueryClient();
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CompetitionCreateFormValues>({
    defaultValues: {
      name: '',
      description: '',
      preview_url: '',
      scale: 'region',
      type: 'open',
      location_id: '',
      city: '',
      street: '',
      house: '',
      mandate_start_date: '',
      mandate_end_date: '',
      start_date: '',
      end_date: '',
      secretaries: [] as string[],
      mats_count: 1,
      category_groups: [
        {
          gender: 'male',
          age_min: 18,
          age_max: 40,
          competition_day: '',
          mandate_day: '',
          weights: [],
        },
      ],
    },
  });

  const selectedScale = useWatch({ control, name: 'scale' });

  // Fetch data if edit mode
  const { data: existingCompetition, isLoading: isLoadingCompetition } = useQuery({
    queryKey: ['competition', compId],
    queryFn: () => competitionService.getCompetitionDetails(compId!),
    enabled: isEditMode,
  });

  // Separate states for the cascading dropdowns
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');

  useEffect(() => {
    if (isEditMode && existingCompetition) {
      // Set simple fields
      const formScale = existingCompetition.scale || 'country';
      const formLocationId = existingCompetition.location_id || '';

      reset({
        name: existingCompetition.name || '',
        description: existingCompetition.description || '',
        preview_url: existingCompetition.preview_url || '',
        scale: formScale,
        type: existingCompetition.type || 'open',
        location_id: formLocationId,
        city: existingCompetition.city || '',
        street: existingCompetition.street || '',
        house: existingCompetition.house || '',
        mats_count: existingCompetition.mats_count || 1,
        mandate_start_date: existingCompetition.mandate_start_date?.split('T')[0] || '',
        mandate_end_date: existingCompetition.mandate_end_date?.split('T')[0] || '',
        start_date: existingCompetition.start_date?.split('T')[0] || '',
        end_date: existingCompetition.end_date?.split('T')[0] || '',
        secretaries: existingCompetition.secretaries?.map((s: any) => s.user_id) || [],
      });

      // Reconstruct cascaded location IDs based on the fetched region or country
      if (formScale === 'country') {
        setSelectedCountryId(formLocationId);
      } else if (formScale === 'region') {
        setSelectedRegionId(formLocationId);
      }

      // Group categories back together for the form
      if (existingCompetition.categories) {
        const groupsMap = new Map<string, CategoryGroupForm>();

        existingCompetition.categories.forEach((cat: any) => {
          const compDay = cat.competition_day?.split('T')[0] || '';
          const mandDay = cat.mandate_day?.split('T')[0] || '';
          const key = `${cat.gender}-${cat.age_min}-${cat.age_max}-${compDay}-${mandDay}`;

          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              gender: cat.gender,
              age_min: cat.age_min,
              age_max: cat.age_max,
              competition_day: compDay,
              mandate_day: mandDay,
              weights: [],
            });
          }

          const weightStr =
            cat.weight_max === 999 || !cat.weight_max
              ? `${Math.floor(cat.weight_min)}+`
              : `${cat.weight_max}`;

          groupsMap.get(key)!.weights.push({
            id: cat.id,
            value: weightStr,
          } as any);
        });

        const weightsArray = Array.from(groupsMap.values()).map((g) => ({
          ...g,
          weights: g.weights.map((w: any) => w.value), // keep as string array for UI
          _ids: g.weights.map((w: any) => w.id), // store ids secretly
        }));

        // Replace the form fields safely. We must wait for the next tick to ensure
        // react-hook-form correctly registers the new array values
        setTimeout(() => {
          setValue('category_groups', weightsArray);
        }, 0);
      }
    }
  }, [existingCompetition, isEditMode, reset, setValue]);

  const { data: countries } = useQuery<Location[]>({
    queryKey: ['countries'],
    queryFn: () => locationService.getLocations('country'),
  });

  const { data: districts } = useQuery<Location[]>({
    queryKey: ['districts', selectedCountryId],
    queryFn: () => locationService.getLocations('district', selectedCountryId),
    enabled: !!selectedCountryId,
  });

  const { data: regions } = useQuery<Location[]>({
    queryKey: ['regions', selectedDistrictId],
    queryFn: () => locationService.getLocations('region', selectedDistrictId),
    enabled: !!selectedDistrictId,
  });

  // Calculate secretary scope based on scale and selected locations
  const secretaryScopeId = selectedScale === 'country' ? selectedCountryId : selectedRegionId;

  const { data: secretaries } = useQuery<Secretary[]>({
    queryKey: ['secretaries', secretaryScopeId],
    queryFn: () => userService.getSecretaries(secretaryScopeId),
    enabled: !!secretaryScopeId,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'category_groups',
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEditMode
        ? competitionService.updateCompetition(compId!, data)
        : competitionService.createCompetition(data),
  });

  const onSubmit = async (data: CompetitionCreateFormValues) => {
    console.log('[Frontend] Form raw data:', data);

    const finalCategories: CompetitionCategoryForm[] = [];

    data.category_groups.forEach((group) => {
      // Separate normal weights and "plus" weights (like "100+")
      const normalWeights: number[] = [];
      const plusWeights: number[] = [];

      (group.weights || []).forEach((wStr) => {
        // Handle comma-separated values if they were pasted or entered as one string
        const splitWeights = wStr.includes(',') ? wStr.split(',') : [wStr];

        splitWeights.forEach((val) => {
          const cleanVal = val.trim();
          if (!cleanVal) return;

          if (cleanVal.endsWith('+')) {
            const num = Number(cleanVal.replace('+', ''));
            if (!isNaN(num) && num > 0) plusWeights.push(num);
          } else {
            const num = Number(cleanVal);
            if (!isNaN(num) && num > 0) normalWeights.push(num);
          }
        });
      });

      // Sort normal weights ascending
      normalWeights.sort((a, b) => a - b);

      let prevWeight = 0;

      // Convert dates to ISO strings if they are set
      const compDayIso = group.competition_day
        ? new Date(group.competition_day).toISOString()
        : new Date().toISOString();
      const mandateDayIso = group.mandate_day
        ? new Date(group.mandate_day).toISOString()
        : new Date().toISOString();

      // Create categories for normal weights
      normalWeights.forEach((w, index) => {
        finalCategories.push({
          id: (group as any)._ids ? (group as any)._ids[index] : undefined,
          gender: group.gender,
          age_min: Number(group.age_min),
          age_max: Number(group.age_max),
          weight_min: prevWeight,
          weight_max: w,
          competition_day: compDayIso,
          mandate_day: mandateDayIso,
        });
        prevWeight = w;
      });

      // Handle "plus" weights
      plusWeights.forEach((plusW, index) => {
        finalCategories.push({
          id: (group as any)._ids ? (group as any)._ids[normalWeights.length + index] : undefined,
          gender: group.gender,
          age_min: Number(group.age_min),
          age_max: Number(group.age_max),
          weight_min: plusW,
          weight_max: 999, // 999 indicates no upper limit in the system
          competition_day: compDayIso,
          mandate_day: mandateDayIso,
        });
      });
    });

    try {
      // Конвертируем даты в ISO формат для FastAPI
      const formattedData = {
        ...data,
        categories: finalCategories, // Send flattened categories
        mandate_start_date: data.mandate_start_date
          ? new Date(data.mandate_start_date).toISOString()
          : null,
        mandate_end_date: data.mandate_end_date
          ? new Date(data.mandate_end_date).toISOString()
          : null,
        start_date: data.start_date ? new Date(data.start_date).toISOString() : null,
        end_date: data.end_date ? new Date(data.end_date).toISOString() : null,
      };

      // Remove temporary field
      // @ts-ignore
      delete formattedData.category_groups;

      console.log('[Frontend] Sending formatted data:', formattedData);
      const saved = await mutation.mutateAsync(formattedData as any);
      const savedId = isEditMode ? compId! : saved?.id;
      if (previewFile && savedId) {
        await competitionService.uploadCompetitionPreview(savedId, previewFile);
      }
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      navigate('/');
    } catch (err) {
      console.error('[Frontend] Error formatting dates:', err);
      alert('Ошибка в формате дат. Проверьте правильность заполнения.');
    }
  };

  if (isEditMode && isLoadingCompetition) {
    return (
      <Container maxWidth='md' sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Typography>Загрузка данных соревнования...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth='md' sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant='h4' gutterBottom>
          {isEditMode ? 'Редактировать соревнование' : 'Создать соревнование'}
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label='Название'
                {...register('name', { required: 'Обязательное поле' })}
                error={!!errors.name}
                helperText={errors.name?.message}
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label='Описание соревнования'
                {...register('description')}
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Button variant='outlined' component='label' fullWidth>
                {previewFile ? `Превью: ${previewFile.name}` : 'Загрузить превью (картинка)'}
                <input
                  hidden
                  type='file'
                  accept='image/*'
                  onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                />
              </Button>
              {isEditMode && existingCompetition?.preview_url ? (
                <Typography variant='body2' sx={{ mt: 1, wordBreak: 'break-all' }}>
                  Текущее превью: {existingCompetition.preview_url}
                </Typography>
              ) : null}
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name='scale'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label='Масштаб'
                    onChange={(e) => {
                      field.onChange(e);
                      // Reset downstream selections when scale changes if needed
                      // For now we keep them to avoid annoyance, or we could reset logic here
                    }}
                  >
                    <MenuItem value='world'>Мировой</MenuItem>
                    <MenuItem value='country'>Национальный</MenuItem>
                    <MenuItem value='region'>Региональный</MenuItem>
                  </TextField>
                )}
              />
            </Grid>

            {/* Cascading Location Selection */}
            <Grid item xs={12} sm={4}>
              <Autocomplete
                options={countries || []}
                getOptionLabel={(option) => option.name}
                value={countries?.find((c) => c.id === selectedCountryId) || null}
                onChange={(_, newValue) => {
                  setSelectedCountryId(newValue ? newValue.id : '');
                  setSelectedDistrictId('');
                  setSelectedRegionId('');
                  setValue('location_id', ''); // Clear form value
                }}
                renderInput={(params) => <TextField {...params} label='Страна' />}
                noOptionsText='Нет стран'
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Autocomplete
                options={districts || []}
                getOptionLabel={(option) => option.name}
                value={districts?.find((d) => d.id === selectedDistrictId) || null}
                onChange={(_, newValue) => {
                  setSelectedDistrictId(newValue ? newValue.id : '');
                  setSelectedRegionId('');
                  setValue('location_id', '');
                }}
                renderInput={(params) => <TextField {...params} label='Округ' />}
                disabled={!selectedCountryId}
                noOptionsText='Нет округов'
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Autocomplete
                options={regions || []}
                getOptionLabel={(option) => option.name}
                value={regions?.find((r) => r.id === selectedRegionId) || null}
                onChange={(_, newValue) => {
                  const newId = newValue ? newValue.id : '';
                  setSelectedRegionId(newId);
                  setValue('location_id', newId); // Set the form value to the region
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Регион'
                    error={!!errors.location_id}
                    helperText={errors.location_id ? 'Выберите регион' : ''}
                  />
                )}
                disabled={!selectedDistrictId}
                noOptionsText='Нет регионов'
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label='Город'
                {...register('city')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label='Улица'
                {...register('street')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label='Дом'
                {...register('house')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name='type'
                control={control}
                render={({ field }) => (
                  <TextField {...field} select fullWidth label='Тип'>
                    <MenuItem value='open'>Открытый</MenuItem>
                    <MenuItem value='restricted'>Закрытый (по отбору)</MenuItem>
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                type='date'
                label='Мандатная (Начало)'
                slotProps={{
                  inputLabel: { shrink: true },
                }}
                {...register('mandate_start_date', { required: 'Обязательное поле' })}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                type='date'
                label='Мандатная (Окончание)'
                slotProps={{
                  inputLabel: { shrink: true },
                }}
                {...register('mandate_end_date', { required: 'Обязательное поле' })}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                type='date'
                label='Соревнования (Начало)'
                slotProps={{
                  inputLabel: { shrink: true },
                }}
                {...register('start_date', { required: 'Обязательное поле' })}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                type='date'
                label='Соревнования (Окончание)'
                slotProps={{
                  inputLabel: { shrink: true },
                }}
                {...register('end_date', { required: 'Обязательное поле' })}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <Controller
                name='mats_count'
                control={control}
                rules={{ required: 'Количество помостов обязательно', min: 1 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label='Количество помостов'
                    type='number'
                    fullWidth
                    slotProps={{ htmlInput: { min: 1 } }}
                    error={!!errors.mats_count}
                    helperText={errors.mats_count?.message as string}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant='subtitle1' gutterBottom sx={{ mt: 2 }}>
                Выбор секретарей (
                {selectedScale === 'country' ? 'из выбранной страны' : 'из выбранного региона'})
              </Typography>
              <Controller
                name='secretaries'
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Autocomplete
                    multiple
                    options={secretaries || []}
                    getOptionLabel={(option) => option.full_name || 'Без имени'}
                    value={secretaries?.filter((s) => value.includes(s.user_id)) || []}
                    onChange={(_, newValue) => {
                      onChange(newValue.map((v) => v.user_id));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label='Секретари'
                        placeholder='Выберите секретарей'
                        fullWidth
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    )}
                    renderTags={(tagValue, getTagProps) =>
                      tagValue.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return <Chip key={key} label={option.full_name} {...tagProps} />;
                      })
                    }
                    disabled={!secretaryScopeId}
                    noOptionsText={
                      !secretaryScopeId
                        ? 'Сначала выберите локацию (страну или регион)'
                        : 'Нет доступных секретарей'
                    }
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Box display='flex' justifyContent='space-between' alignItems='center' mt={2} mb={1}>
                <Typography variant='h6'>Возрастные и весовые категории</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() =>
                    append({
                      gender: 'male',
                      age_min: 18,
                      age_max: 40,
                      competition_day: '',
                      mandate_day: '',
                      weights: [],
                    })
                  }
                >
                  Добавить группу
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />

              {fields.map((field, index) => (
                <Box
                  key={field.id}
                  sx={{ mb: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}
                >
                  <Grid container spacing={2} alignItems='flex-start'>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name={`category_groups.${index}.gender` as const}
                        control={control}
                        render={({ field }) => (
                          <TextField {...field} select fullWidth label='Пол' size='small'>
                            <MenuItem value='male'>М</MenuItem>
                            <MenuItem value='female'>Ж</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <TextField
                        fullWidth
                        type='number'
                        label='Возраст от'
                        size='small'
                        {...register(`category_groups.${index}.age_min` as const)}
                      />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <TextField
                        fullWidth
                        type='number'
                        label='Возраст до'
                        size='small'
                        {...register(`category_groups.${index}.age_max` as const)}
                      />
                    </Grid>

                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        type='date'
                        label='День мандатной комиссии'
                        size='small'
                        slotProps={{ inputLabel: { shrink: true } }}
                        {...register(`category_groups.${index}.mandate_day` as const, {
                          required: 'Выберите день мандатной комиссии',
                        })}
                      />
                    </Grid>

                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        type='date'
                        label='День выступления'
                        size='small'
                        slotProps={{ inputLabel: { shrink: true } }}
                        {...register(`category_groups.${index}.competition_day` as const, {
                          required: 'Выберите день выступления',
                        })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <IconButton onClick={() => remove(index)} color='error'>
                        <DeleteIcon />
                      </IconButton>
                    </Grid>

                    <Grid item xs={12} sm={12} sx={{ mt: 1 }}>
                      <Controller
                        name={`category_groups.${index}.weights` as const}
                        control={control}
                        render={({ field: { onChange: fieldOnChange, value, ref } }) => (
                          <Autocomplete
                            multiple
                            freeSolo
                            options={[]}
                            value={value || []}
                            onChange={(_, newValue) => {
                              const processed = newValue.map((item) => String(item).trim());
                              const uniqueWeights = Array.from(new Set(processed));
                              fieldOnChange(uniqueWeights);
                            }}
                            renderTags={(value: readonly string[], getTagProps) =>
                              value.map((option: string, index: number) => {
                                const { key, ...tagProps } = getTagProps({ index });
                                const label = option.endsWith('+')
                                  ? `${option} кг`
                                  : `до ${option} кг`;
                                return (
                                  <Chip variant='outlined' label={label} key={key} {...tagProps} />
                                );
                              })
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                inputRef={ref}
                                label='Весовые категории (введите и нажмите Enter)'
                                placeholder='Например: 60, 70, 80 или 80+'
                                size='small'
                                helperText='Введите верхнюю границу (например, 60) или категорию без лимита (например, 80+) и нажмите Enter'
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                  }
                                }}
                              />
                            )}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Grid>

            <Grid item xs={12}>
              <Box display='flex' gap={2} justifyContent='flex-end' mt={2}>
                <Button onClick={() => navigate('/competitions')}>Отмена</Button>
                <Button
                  type='submit'
                  variant='contained'
                  color='primary'
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? isEditMode
                      ? 'Сохранение...'
                      : 'Создание...'
                    : isEditMode
                      ? 'Сохранить изменения'
                      : 'Создать соревнование'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default CompetitionCreate;
