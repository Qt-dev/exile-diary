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
const { logger } = electronService;


const DataSearchForm = ({ searchFunction, availableMaps }) => {
  const now = dayjs();
  const [from, setFrom] = React.useState<Dayjs | null>(dayjs().subtract(1, 'days'));
  const [to, setTo] = React.useState<Dayjs | null>(dayjs());
  const [minLootValue, setMinLootValue] = React.useState(0);
  const [minMapValue, setMinMapValue] = React.useState(0);
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
              maxDateTime={to}
              onChange={(newValue) => setFrom(newValue)}/>
        </LocalizationProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DateTimePicker
              label="To"
              value={to}
              maxDateTime={now}
              onChange={(newValue) => setTo(newValue)}/>
        </LocalizationProvider>
            
        <FormControl variant="outlined" size="medium">
          <TextField
            label="Only items worth more than"
            id="min-loot-value"
            value={minLootValue}
            type='number'
            onChange={(e) => { if(parseInt(e.target.value) > 0) setMinLootValue(parseInt(e.target.value)); }}
          />
        </FormControl>

        <FormControl variant="outlined" size="medium">
          <TextField
            label="Only maps with profit above"
            id="min-map-value"
            value={minMapValue}
            type='number'
            onChange={(e) => { if(parseInt(e.target.value) > 0) setMinMapValue(parseInt(e.target.value)); }}
          />
        </FormControl>

        <FormControl variant="outlined" size="medium">
          <TextField
            label="Maps that contain items named"
            id="needed-item-name"
            value={neededItemName}
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setNeededItemName(e.target.value) }
          />
        </FormControl>
      </Stack>
      <FormControl variant="outlined" size="medium">
        <InputLabel id="selected-maps-label">Selected Maps</InputLabel>
        <Select
          labelId="selected-maps-label"
          label="Selected Maps"
          id="selected-maps"
          multiple
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

      <ButtonGroup className="DataSearchForm__Buttons" variant="contained" aria-label="outlined primary button group" >
        <Button type="submit">Search</Button>
      </ButtonGroup>
    </Stack>
  </form>
  );
};

export default DataSearchForm;