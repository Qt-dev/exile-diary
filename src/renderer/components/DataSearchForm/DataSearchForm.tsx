import React from 'react';
import './DataSearchForm.css';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Stack from '@mui/material/Stack';
import { electronService } from '../../electron.service';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';

import dayjs, { Dayjs } from 'dayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import { Divider } from '@mui/material';
const { logger } = electronService;


const DataSearchForm = ({ searchFunction, availableMaps }) => {
  const now = dayjs();
  const [from, setFrom] = React.useState<Dayjs | null>(dayjs().subtract(1, 'days'));
  const [to, setTo] = React.useState<Dayjs | null>(dayjs());
  const [minLootValue, setMinLootValue] = React.useState(0);
  const [minMapValue, setMinMapValue] = React.useState(0);
  const [minIIQ, setMinIIQ] = React.useState(0);
  const [maxIIQ, setMaxIIQ] = React.useState(99999);
  const [minIIR, setMinIIR] = React.useState(0);
  const [maxIIR, setMaxIIR] = React.useState(99999);
  const [minPackSize, setMinPackSize] = React.useState(0);
  const [maxPackSize, setMaxPackSize] = React.useState(99999);
  const [minMapLevel, setMinMapLevel] = React.useState(0);
  const [maxMapLevel, setMaxMapLevel] = React.useState(90);
  const [minDeaths, setMinDeaths] = React.useState(0);
  const [maxDeaths, setMaxDeaths] = React.useState(6);
  const [neededItemName, setNeededItemName] = React.useState('');
  const [selectedMaps, setSelectedMaps] = React.useState<string[]>([]);

  const handleSelectMaps = (event) => {
    const {
      target: { value },
    } = event;
    setSelectedMaps(
      typeof value === 'string' ? value.split(',') : value,
    );
  }

  const handleSearch = (e) => {
    e.preventDefault();
    searchFunction({
      from: from?.format('YYYYMMDDHHmmss'),
      to: to?.format('YYYYMMDDHHmmss'),
      minLootValue,
      minMapValue,
      neededItemName,
      selectedMaps,
      iiq: { min: minIIQ, max: maxIIQ },
      iir: { min: minIIR, max: maxIIR },
      packSize: { min: minPackSize, max: maxPackSize },
      mapLevel: { min: minMapLevel, max: maxMapLevel },
      deaths: { min: minDeaths, max: maxDeaths },
    });
  }

  return (
  <form className="DataSearchForm Box" onSubmit={handleSearch}>
    <h2 className="DataSearchForm__Header">Search Criteria</h2>
    <Stack direction="column" spacing={3} margin="1em">
    <Stack direction="row" spacing={3} justifyContent="center">
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DateTimePicker
              label="From"
              value={from}
              slotProps={{ textField: { size: 'small' } }}
              maxDateTime={to}
              onChange={(newValue) => setFrom(newValue)}/>
        </LocalizationProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DateTimePicker
              label="To"
              value={to}
              slotProps={{ textField: { size: 'small' } }}
              maxDateTime={now}
              onChange={(newValue) => setTo(newValue)}/>
        </LocalizationProvider>

      </Stack>

      <FormControl
        variant="outlined"
        size="small"
        >
        <InputLabel id="selected-maps-label">Selected Maps</InputLabel>
        <Select
          labelId="selected-maps-label"
          label="Selected Maps"
          id="selected-maps"
          multiple
          autoWidth
          value={selectedMaps}
          renderValue={(selectedMaps) => selectedMaps.join(', ')}
          onChange={handleSelectMaps}
        >
          {availableMaps.map(({ name }) => (
            <MenuItem
              key={name}
              value={name}
            >
              <Checkbox checked={selectedMaps.indexOf(name) > -1} />
              <ListItemText  primary={name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      <Stack direction="row" spacing={3} justifyContent="center" alignItems="center" flexWrap="wrap" useFlexGap sx={{marginBottom: '2em'}}>

        <Stack direction="column" alignItems='center' spacing={1} className="DataSearchForm__Field-Group">
          <h3 className="DataSearchForm__Section-Title">
            IIQ
          </h3>
          <Stack direction="row" alignItems='center' spacing={3}>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Above"
                id="min-iiq"
                value={minIIQ}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMinIIQ(parseInt(e.target.value)); }}
              />
            </FormControl>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Below"
                id="max-iiq"
                value={maxIIQ}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMaxIIQ(parseInt(e.target.value)); }}
              />
            </FormControl>
          </Stack>
        </Stack>
        
        <Stack direction="column" alignItems='center' spacing={1} className="DataSearchForm__Field-Group">
          <h3 className="DataSearchForm__Section-Title">
            IIR
          </h3>
          <Stack direction="row" alignItems='center' spacing={3}>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Above"
                id="min-iir"
                value={minIIR}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMinIIR(parseInt(e.target.value)); }}
              />
            </FormControl>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Below"
                id="max-iir"
                value={maxIIR}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMaxIIR(parseInt(e.target.value)); }}
              />
            </FormControl>
          </Stack>
        </Stack>

        <Stack direction="column" alignItems='center' spacing={1} className="DataSearchForm__Field-Group">
          <h3 className="DataSearchForm__Section-Title">
            Pack Size
          </h3>
          <Stack direction="row" alignItems='center' spacing={3}>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Above"
                id="min-pack-size"
                value={minPackSize}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMinPackSize(parseInt(e.target.value)); }}
              />
            </FormControl>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Below"
                id="max-pack-size"
                value={maxPackSize}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMaxPackSize(parseInt(e.target.value)); }}
              />
            </FormControl>
            </Stack>
        </Stack>
        <Stack direction="column" alignItems='center' spacing={1} className="DataSearchForm__Field-Group">
          <h3 className="DataSearchForm__Section-Title">
            Map Level
          </h3>
          <Stack direction="row" alignItems='center' spacing={3}>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Above"
                id="min-map-level"
                value={minMapLevel}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMinMapLevel(parseInt(e.target.value)); }}
              />
            </FormControl>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Below"
                id="max-map-level"
                value={maxMapLevel}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMaxMapLevel(parseInt(e.target.value)); }}
              />
            </FormControl>
          </Stack>
        </Stack>
        <Stack direction="column" alignItems='center' spacing={1} className="DataSearchForm__Field-Group">
          <h3 className="DataSearchForm__Section-Title">
            Number of deaths
          </h3>
          <Stack direction="row" alignItems='center' spacing={3}>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Above"
                id="min-deaths"
                value={minDeaths}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMinDeaths(parseInt(e.target.value)); }}
              />
            </FormControl>
            <FormControl variant="outlined" size="small">
              <TextField
                label="Below"
                id="max-deaths"
                value={maxDeaths}
                size="small"
                type='number'
                onChange={(e) => { if(parseInt(e.target.value) > 0) setMaxDeaths(parseInt(e.target.value)); }}
              />
            </FormControl>
          </Stack>
        </Stack>
      </Stack>

      <Stack direction="column" spacing={2} alignItems='center'>
        <h3 className="DataSearchForm__Section-Title">
            Additional Filters
        </h3>
        <Stack direction="row" spacing={3} justifyContent="center">
          <FormControl variant="outlined" size="small">
            <TextField
              label="Only items worth more than"
              id="min-loot-value"
              value={minLootValue}
              type='number'
              size="small"
              onChange={(e) => { if(parseInt(e.target.value) > 0) setMinLootValue(parseInt(e.target.value)); }}
            />
          </FormControl>

          <FormControl variant="outlined" size="small">
            <TextField
              label="Only maps with profit above"
              id="min-map-value"
              value={minMapValue}
              size="small"
              type='number'
              onChange={(e) => { if(parseInt(e.target.value) > 0) setMinMapValue(parseInt(e.target.value)); }}
            />
          </FormControl>

          <FormControl variant="outlined" size="small">
            <TextField
              label="Maps that contain items named"
              id="needed-item-name"
              size="small"
              value={neededItemName}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setNeededItemName(e.target.value) }
            />
          </FormControl>
        </Stack>
      </Stack>

      <ButtonGroup className="DataSearchForm__Buttons" variant="contained" aria-label="outlined primary button group" >
        <Button type="submit">Search</Button>
      </ButtonGroup>
    </Stack>
  </form>
  );
};

export default DataSearchForm;