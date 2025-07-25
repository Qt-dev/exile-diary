import React from 'react';
import './DataSearchForm.css';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Stack from '@mui/material/Stack';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';

import dayjs, { Dayjs } from 'dayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

const DataSearchForm = ({
  defaultSearchParams,
  searchFunction,
  availableMaps,
  possibleMods,
  shouldDisplayCharacterName,
  handleToggleDisplayCharacterName,
}) => {
  const [from, setFrom] = React.useState<Dayjs | null>(
    dayjs(defaultSearchParams?.from) ?? dayjs().subtract(1, 'days')
  );
  const [to, setTo] = React.useState<Dayjs | null>(dayjs(defaultSearchParams?.to) ?? dayjs());
  const [minLootValue, setMinLootValue] = React.useState(defaultSearchParams?.minLootValue ?? 0);
  const [minMapValue, setMinMapValue] = React.useState(defaultSearchParams?.minMapValue ?? 0);
  const [minIIQ, setMinIIQ] = React.useState(defaultSearchParams?.iiq?.min ?? 0);
  const [maxIIQ, setMaxIIQ] = React.useState(defaultSearchParams?.iiq?.max ?? 99999);
  const [minIIR, setMinIIR] = React.useState(defaultSearchParams?.iir?.min ?? 0);
  const [maxIIR, setMaxIIR] = React.useState(defaultSearchParams?.iir?.max ?? 99999);
  const [minPackSize, setMinPackSize] = React.useState(defaultSearchParams?.packSize?.min ?? 0);
  const [maxPackSize, setMaxPackSize] = React.useState(defaultSearchParams?.packSize?.max ?? 9999);
  const [minMapLevel, setMinMapLevel] = React.useState(defaultSearchParams?.mapLevel?.min ?? 0);
  const [maxMapLevel, setMaxMapLevel] = React.useState(defaultSearchParams?.mapLevel?.max ?? 90);
  const [minDeaths, setMinDeaths] = React.useState(defaultSearchParams?.deaths?.min ?? 0);
  const [maxDeaths, setMaxDeaths] = React.useState(defaultSearchParams?.deaths?.max ?? 6);
  const [neededItemName, setNeededItemName] = React.useState(
    defaultSearchParams?.neededItemName ?? ''
  );
  const [selectedMaps, setSelectedMaps] = React.useState<string[]>(
    defaultSearchParams?.selectedMaps ?? availableMaps.map(({ name }) => name)
  );
  const [selectedMods, setSelectedMods] = React.useState<string[]>(
    defaultSearchParams?.selectedMods ?? possibleMods.map(({ mod }) => mod)
  );

  const handleSelectMaps = (event, newValue) => {
    setSelectedMaps(typeof newValue === 'string' ? newValue.split(',') : newValue);
  };

  const handleSelectMods = (event, newValue) => {
    setSelectedMods(typeof newValue === 'string' ? newValue.split(',') : newValue);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchFunction({
      from: from?.toISOString(),
      to: to?.toISOString(),
      minLootValue,
      minMapValue,
      neededItemName,
      selectedMaps,
      selectedMods,
      iiq: { min: minIIQ, max: maxIIQ },
      iir: { min: minIIR, max: maxIIR },
      packSize: { min: minPackSize, max: maxPackSize },
      mapLevel: { min: minMapLevel, max: maxMapLevel },
      deaths: { min: minDeaths, max: maxDeaths },
    });
  };

  const handleReset = (e) => {
    setFrom(dayjs().subtract(1, 'days'));
    setTo(dayjs());
    setMinLootValue(0);
    setMinMapValue(0);
    setMinIIQ(0);
    setMaxIIQ(99999);
    setMinIIR(0);
    setMaxIIR(99999);
    setMinPackSize(0);
    setMaxPackSize(99999);
    setMinMapLevel(0);
    setMaxMapLevel(90);
    setMinDeaths(0);
    setMaxDeaths(6);
    setNeededItemName('');
    setSelectedMaps(availableMaps.map(({ name }) => name));
    setSelectedMods(possibleMods.map(({ mod }) => mod));
  };

  return (
    <form className="DataSearchForm Box" onSubmit={handleSearch} onReset={handleReset}>
      <h2 className="DataSearchForm__Header">Search Criteria</h2>
      <Stack direction="column" spacing={3} margin="1em">
        <Stack direction="row" spacing={3} justifyContent="center">
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="From"
              value={from}
              slotProps={{ textField: { size: 'small' } }}
              maxDateTime={to}
              onChange={(newValue) => setFrom(newValue)}
            />
          </LocalizationProvider>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
              label="To"
              value={to}
              slotProps={{ textField: { size: 'small' } }}
              onChange={(newValue) => setTo(newValue)}
            />
          </LocalizationProvider>
        </Stack>

        <Stack direction="row" spacing={3} sx={{ width: '100%' }} justifyContent="center">
          <Autocomplete
            multiple
            value={selectedMaps}
            onChange={handleSelectMaps}
            options={availableMaps.map(({ name }) => name)}
            renderInput={(params) => <TextField {...params} label="Selected Maps" size="small" />}
            limitTags={2}
          />
          <Autocomplete
            multiple
            value={selectedMods}
            onChange={handleSelectMods}
            options={possibleMods.map(({ mod }) => mod)}
            renderInput={(params) => <TextField {...params} label="Selected Mods" size="small" />}
            limitTags={2}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={3}
          justifyContent="center"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ marginBottom: '2em' }}
        >
          <Stack
            direction="column"
            alignItems="center"
            spacing={1}
            className="DataSearchForm__Field-Group"
          >
            <h3 className="DataSearchForm__Section-Title">IIQ</h3>
            <Stack direction="row" alignItems="center" spacing={3}>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Above"
                  id="min-iiq"
                  value={minIIQ}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMinIIQ(parseInt(e.target.value));
                  }}
                />
              </FormControl>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Below"
                  id="max-iiq"
                  value={maxIIQ}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMaxIIQ(parseInt(e.target.value));
                  }}
                />
              </FormControl>
            </Stack>
          </Stack>

          <Stack
            direction="column"
            alignItems="center"
            spacing={1}
            className="DataSearchForm__Field-Group"
          >
            <h3 className="DataSearchForm__Section-Title">IIR</h3>
            <Stack direction="row" alignItems="center" spacing={3}>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Above"
                  id="min-iir"
                  value={minIIR}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMinIIR(parseInt(e.target.value));
                  }}
                />
              </FormControl>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Below"
                  id="max-iir"
                  value={maxIIR}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMaxIIR(parseInt(e.target.value));
                  }}
                />
              </FormControl>
            </Stack>
          </Stack>

          <Stack
            direction="column"
            alignItems="center"
            spacing={1}
            className="DataSearchForm__Field-Group"
          >
            <h3 className="DataSearchForm__Section-Title">Pack Size</h3>
            <Stack direction="row" alignItems="center" spacing={3}>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Above"
                  id="min-pack-size"
                  value={minPackSize}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMinPackSize(parseInt(e.target.value));
                  }}
                />
              </FormControl>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Below"
                  id="max-pack-size"
                  value={maxPackSize}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMaxPackSize(parseInt(e.target.value));
                  }}
                />
              </FormControl>
            </Stack>
          </Stack>
          <Stack
            direction="column"
            alignItems="center"
            spacing={1}
            className="DataSearchForm__Field-Group"
          >
            <h3 className="DataSearchForm__Section-Title">Map Level</h3>
            <Stack direction="row" alignItems="center" spacing={3}>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Above"
                  id="min-map-level"
                  value={minMapLevel}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMinMapLevel(parseInt(e.target.value));
                  }}
                />
              </FormControl>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Below"
                  id="max-map-level"
                  value={maxMapLevel}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMaxMapLevel(parseInt(e.target.value));
                  }}
                />
              </FormControl>
            </Stack>
          </Stack>
          <Stack
            direction="column"
            alignItems="center"
            spacing={1}
            className="DataSearchForm__Field-Group"
          >
            <h3 className="DataSearchForm__Section-Title">Number of deaths</h3>
            <Stack direction="row" alignItems="center" spacing={3}>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Above"
                  id="min-deaths"
                  value={minDeaths}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMinDeaths(parseInt(e.target.value));
                  }}
                />
              </FormControl>
              <FormControl variant="outlined" size="small">
                <TextField
                  label="Below"
                  id="max-deaths"
                  value={maxDeaths}
                  size="small"
                  type="number"
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) setMaxDeaths(parseInt(e.target.value));
                  }}
                />
              </FormControl>
            </Stack>
          </Stack>
        </Stack>

        <Stack direction="column" spacing={2} alignItems="center">
          <h3 className="DataSearchForm__Section-Title">Additional Filters</h3>
          <Stack direction="row" spacing={3} justifyContent="center">
            <FormControl variant="outlined" size="small">
              <TextField
                label="Only items worth more than"
                id="min-loot-value"
                value={minLootValue}
                type="number"
                size="small"
                onChange={(e) => {
                  if (parseInt(e.target.value) > 0) setMinLootValue(parseInt(e.target.value));
                }}
              />
            </FormControl>

            <FormControl variant="outlined" size="small">
              <TextField
                label="Only maps with profit above"
                id="min-map-value"
                value={minMapValue}
                size="small"
                type="number"
                onChange={(e) => {
                  if (parseInt(e.target.value) > 0) setMinMapValue(parseInt(e.target.value));
                }}
              />
            </FormControl>

            <FormControl variant="outlined" size="small">
              <TextField
                label="Maps that contain items named"
                id="needed-item-name"
                size="small"
                value={neededItemName}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setNeededItemName(e.target.value)}
              />
            </FormControl>
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={shouldDisplayCharacterName}
                onChange={handleToggleDisplayCharacterName}
              />
            }
            label="Display my character name"
          />
        </Stack>

        <ButtonGroup
          className="DataSearchForm__Buttons"
          variant="contained"
          aria-label="outlined primary button group"
        >
          <Button type="submit">Search</Button>
          <Button type="reset" variant="outlined">
            Reset
          </Button>
        </ButtonGroup>
      </Stack>
    </form>
  );
};

export default DataSearchForm;
