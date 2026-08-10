import React from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';
import type { RunStrategy, Strategy } from '../../../shared/strategies';

type Props = {
  options: Strategy[];
  value: RunStrategy[];
  onChange: (strategies: Strategy[]) => void | Promise<void>;
  label?: string;
  compact?: boolean;
  multiple?: boolean;
  placeholder?: string;
};

export default function StrategySelector({
  options,
  value,
  onChange,
  label = 'Strategies',
  compact = false,
  multiple = true,
  placeholder,
}: Props) {
  const selected = options.filter((option) => value.some((item) => item.id === option.id));

  const handleChange = (_event: React.SyntheticEvent, next: Strategy[]) => {
    if (multiple) {
      void onChange(next);
      return;
    }
    // Single-select: picking a new option replaces the previous one; clearing removes it.
    const last = next[next.length - 1];
    void onChange(last ? [last] : []);
  };

  return (
    <Autocomplete
      multiple
      size='small'
      options={options}
      value={selected}
      onChange={handleChange}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, selectedOption) => option.id === selectedOption.id}
      renderValue={(tagValue, getItemProps) =>
        tagValue.map((option, index) => (
          <Chip
            {...getItemProps({ index })}
            key={option.id}
            label={option.name}
            size="small"
            sx={{ backgroundColor: option.color, color: '#fff' }}
          />
        ))
      }
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <span style={{ width: 12, height: 12, backgroundColor: option.color, marginRight: 8 }} />
          {option.name}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="standard"
          label={compact ? undefined : label}
          placeholder={selected.length > 0 ? undefined : (placeholder ?? 'No strategy selected')}
        />
      )}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      noOptionsText="Create a strategy first"
    />
  );
}
