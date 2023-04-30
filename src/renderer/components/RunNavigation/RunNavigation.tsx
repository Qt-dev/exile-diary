import React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Select, MenuItem, SelectChangeEvent, Divider, Link } from '@mui/material';

const RunNavigation = ({ map, maps }) => {
  const navigate = useNavigate();

  const { id } = map;

  const currentMapId = id ? parseInt(id, 10) : 0;

  const handleMapChange = (event: SelectChangeEvent) => {
    navigate(`/run/${event.target.value}`);
  };

  return (
    <div className="Map__Navigation">
      <Link
        component={RouterLink}
        to={`/run/${currentMapId - 1}`}
        className="Map__Navigation__Previous"
        underline="hover"
      >
        {'<<'} Map {currentMapId - 1}
      </Link>
      <Select
        id="Map__Selector"
        className="Map__Selector"
        onChange={handleMapChange}
        value={`${currentMapId}`}
        size="small"
        variant="outlined"
      >
        {maps.map((map) => {
          return <MenuItem value={map.id}>{map.name}</MenuItem>;
        })}
      </Select>
      <Link
        component={RouterLink}
        to={`/run/${currentMapId + 1}`}
        className="Map__Navigation__Next"
        underline="hover"
      >
        Map {currentMapId + 1} {'>>'}
      </Link>
    </div>
  );
};

export default RunNavigation;
