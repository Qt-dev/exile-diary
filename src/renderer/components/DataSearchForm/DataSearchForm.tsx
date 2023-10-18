import React from 'react';
import moment from 'moment';
import './DataSearchForm.css';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Stack from '@mui/material/Stack';
import { electronService } from '../../electron.service';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
const { logger } = electronService;


const DataSearchForm = ({ searchFunction }) => {
  const now = moment();
  const [from, setFrom] = React.useState(moment().subtract(1, 'days'));
  const [to, setTo] = React.useState(moment());
  const isFromError = (from > now);
  const isToError = (to > now);
  
  const dateMap = {
    'from': {
      variable: from,
      update: setFrom,
    },
    'to': {
      variable: to,
      update: setTo,
    }
  } 

  const handleDateChange = (date, attribute, value) => {
    logger.debug(`DataSearchForm.handleDateChange: ${date} - ${attribute} - ${value}`);
    const { variable , update } = dateMap[date];
    const newDate = moment(variable);
    newDate.set(attribute, value);
    if(newDate.isValid()) update(newDate);
  };

  const handleFromChange = (event) => {
    logger.debug(`DataSearchForm.handleFromChange: ${event.target.id} - ${event.target.value}`);
    const newFrom = moment(from);
    newFrom.set(event.target.id, event.target.value);
    if(newFrom.isValid()) setFrom(newFrom);
  };

  const handleToChange = (event) => {
    logger.debug(`DataSearchForm.handleToChange: ${event.target.id} - ${event.target.value}`);
    const newTo = moment(to);
    newTo.set(event.target.id, event.target.value);
    if(newTo.isValid()) setTo(newTo);
  }

  const handleSearch = (e) => {
    e.preventDefault();
    searchFunction({
      from: from.format('YYYYMMDDHHmmss'),
      to: to.format('YYYYMMDDHHmmss')
    });
  }

  return (
  <form className="DataSearchForm" onSubmit={handleSearch}>
    <Stack direction="row" spacing={3} justifyContent="center">
      <FormControl variant="filled" fullWidth >
        <Stack direction="row" spacing={3} justifyContent="center" alignItems="center">
          <div>FROM</div>
          <TextField
            sx={{width: '5em'}}
              label="Year"
              id="year"
              variant="filled"
              size="small"
              error={isFromError}
              helperText={isFromError ? "Invalid date" : ""}
              value={from.get('year')}
              type='number'
              onChange={(e) => handleDateChange('from', 'year', e.target.value)}
          />
          <TextField
            sx={{width: '5em'}}
            label="Month"
            id="month"
            variant="filled"
            size="small"
            error={isFromError}
            helperText={isFromError ? "Invalid date" : ""}
            value={from.get('month') + 1}
            type='number'
            onChange={(e) => { if(parseInt(e.target.value) < 12) handleDateChange('from', 'month', parseInt(e.target.value) - 1); }}
          />
          <TextField
            sx={{width: '5em'}}
            label="Day"
            id="date"
            variant="filled"
            size="small"
            error={isFromError}
            helperText={isFromError ? "Invalid day" : ""}
            value={from.get('date')}
            type='number'
            onChange={(e) => handleDateChange('from', 'date', e.target.value)}
          />
          <TextField
            sx={{width: '5em'}}
            label="Hour"
            id="hour"
            variant="filled"
            size="small"
            error={isFromError}
            helperText={isFromError ? "Invalid hour" : ""}
            value={from.get('hour')}
            type='number'
            onChange={(e) => { if(parseInt(e.target.value) < 24) handleDateChange('from', 'hour', e.target.value); }}
          />
          <TextField
            sx={{width: '5em'}}
            label="Minute"
            id="minute"
            variant="filled"
            size="small"
            error={isFromError}
            helperText={isFromError ? "Invalid minute" : ""}
            value={from.get('minute')}
            type='number'
            onChange={(e) => { if(parseInt(e.target.value) < 60) handleDateChange('from', 'minute', e.target.value); }}
          />
          <TextField
            sx={{width: '5em'}}
            label="Second"
            id="second"
            variant="filled"
            size="small"
            error={isFromError}
            helperText={isFromError ? "Invalid second" : ""}
            value={from.get('second')}
            type='number'
            onChange={(e) => { if(parseInt(e.target.value) < 60) handleDateChange('from', 'second', e.target.value) }}
          />
        </Stack>
      </FormControl>
      
      <FormControl variant="filled" fullWidth >
          <Stack direction="row" spacing={3} justifyContent="center" alignItems="center">
          <div>TO</div>
            <TextField
              sx={{width: '5em'}}
                label="Year"
                id="year"
                variant="filled"
                size="small"
                error={isToError}
                helperText={isToError ? "Invalid date" : ""}
                value={to.get('year')}
                type='number'
                onChange={(e) => handleDateChange('to', 'year', e.target.value)}

            />
            <TextField
              sx={{width: '5em'}}
              label="Month"
              id="month"
              variant="filled"
              size="small"
              error={isToError}
              helperText={isToError ? "Invalid date" : ""}
              value={to.get('month') + 1}
              type='number'
              onChange={(e) => { if(parseInt(e.target.value) < 12) handleDateChange('to', 'month', parseInt(e.target.value) - 1) }}
            />
            <TextField
              sx={{width: '5em'}}
              label="Day"
              id="date"
              variant="filled"
              size="small"
              error={isToError}
              helperText={isToError ? "Invalid Day" : ""}
              value={to.get('date')}
              type='number'
              onChange={(e) => handleDateChange('to', 'date', e.target.value)}
            />
            <TextField
              sx={{width: '5em'}}
              label="Hour"
              id="hour"
              variant="filled"
              size="small"
              error={isToError}
              helperText={isToError ? "Invalid hour" : ""}
              value={to.get('hour')}
              type='number'
              onChange={(e) => { if(parseInt(e.target.value) < 24) handleDateChange('to', 'hour', e.target.value); }}
            />
            <TextField
              sx={{width: '5em'}}
              label="Minute"
              id="minute"
              variant="filled"
              size="small"
              error={isToError}
              helperText={isToError ? "Invalid minute" : ""}
              value={to.get('minute')}
              type='number'
              onChange={(e) => { if(parseInt(e.target.value) < 60) handleDateChange('to', 'minute', e.target.value); }}
            />
            <TextField
              sx={{width: '5em'}}
              label="Second"
              id="second"
              variant="filled"
              size="small"
              error={isToError}
              helperText={isToError ? "Invalid second" : ""}
              value={to.get('second')}
              type='number'
              onChange={(e) => { if(parseInt(e.target.value) < 60) handleDateChange('to', 'second', e.target.value); }}
            />
          </Stack>
      </FormControl>
    </Stack>
      <ButtonGroup variant="contained" aria-label="outlined primary button group">
        <Button type="submit">Search</Button>
      </ButtonGroup>
    </form>
  );
};

export default DataSearchForm;