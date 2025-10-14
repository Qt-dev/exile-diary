import React from 'react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import ItemFilterSettings from './ItemFilterSettings';
import PricingFilterSettings from './PricingFilterSettings';
import { electronService } from '../../../electron.service';
import './FilterSettings.css';
import '../SettingsCommon.css';
const { logger, ipcRenderer } = electronService;

const FilterSettings = ({ settings, revalidate }) => {
  const [filters, setFilter] = React.useState(settings.filters);

  // Track if there are unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    return JSON.stringify(filters) !== JSON.stringify(settings.filters);
  }, [filters, settings.filters]);

  const handleSaveSettings = async () => {
    logger.debug('Saving filters settings from UI');
    ipcRenderer.invoke('save-settings:filters', filters);
    revalidate();
  };

  const handleCancel = () => {
    // Reset filters to original settings values
    setFilter(settings.filters);
  };

  const handleUpdate = (settings) => {
    setFilter({
      ...filters,
      ...settings,
    });
  };
  return (
    <div className="Filter-Settings">
      <div className="Filter-Settings__Header">
        <h3>Item Filter Settings</h3>
        <p>
          Configure items you want the app to ignore. Ignored items will still be logged but will
          apparate separately and their values will not count.
          <br />
          Saving these settings will update all items ever logged for this character and refresh the
          UI to pick up any change.
        </p>
      </div>
      <PricingFilterSettings settings={filters} updateCallback={handleUpdate} />
      <ItemFilterSettings settings={filters} updateCallback={handleUpdate} />

      <div className="Filter-Settings__Button">
        <ButtonGroup variant="outlined" fullWidth aria-label="Settings Control Buttons">
          <Button
            variant={hasUnsavedChanges ? "contained" : "outlined"}
            onClick={handleSaveSettings}
            className={hasUnsavedChanges ? 'Settings__Save-Button--unsaved' : ''}
          >
            {hasUnsavedChanges ? 'Save Changes' : 'Save'}
          </Button>
          <Button onClick={handleCancel}>Cancel</Button>
        </ButtonGroup>
      </div>
    </div>
  );
};

export default FilterSettings;
