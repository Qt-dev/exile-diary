import React from 'react';
import { observer } from 'mobx-react-lite';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import classNames from 'classnames';
import './ItemFilterSettings.css';

import ListItemButton from '@mui/material/ListItemButton';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

const ContainerComponent = ({ children, isFolder, disabled, callback, onMouseOver, onMouseOut }) => {
  if (isFolder) {
    return <div className="ItemFilter-Settings__List-Item-Container">{children}</div>;
  } else {
    return (
      <ListItemButton sx={{ border: '0px solid #666' }} dense onClick={callback} disabled={disabled} onMouseOver={() => onMouseOver()} onMouseOut={() => onMouseOut() }>
        {children}
      </ListItemButton>
    );
  }
};

const itemFilterCategories = [
  {
    id: 'nonunique',
    desc: 'Non-unique equipment',
    hint: 'Normal, magic and rare gear (weapons, armour, jewellery)',
  },
  { id: 'unique', desc: 'Unique equipment', hint: 'Weapons, armour, jewellery, flasks and jewels' },
  { id: 'gem', desc: 'Skill Gems' },
  { id: 'map', desc: 'Maps', hint: 'Also includes unique maps' },
  {
    id: 'divcard',
    desc: 'Divination cards',
    // TODO: min value/stack options not implemented
    opts: {
      card: 'per Card',
      fullStack: 'per Full Stack',
    },
  },
  { id: 'oil', desc: 'Oils' },
  {
    id: 'fragment',
    desc: 'Fragments',
    hint: "Also includes Offering to the Goddess and Maven's Invitation",
  },
  { id: 'delve', desc: 'Fossils and resonators' },
  { id: 'catalyst', desc: 'Catalysts' },
  { id: 'essence', desc: 'Essences' },
  { id: 'incubator', desc: 'Incubators' },
  {
    id: 'currency',
    desc: 'Currency',
    hint: 'Includes all other currency items not specifically listed above',
  },
];

const ItemFilterRow = ({ filterCat, settings, saveSettingsCallback }) => {
  const [ignored, setIgnored] = React.useState(settings[filterCat.id]?.ignore ?? false);
  const [minValue, setMinValue] = React.useState(settings[filterCat.id]?.minimumValue ?? 0);
  const [hovered, setHovered] = React.useState(false);
  const rowClasses = classNames({
    'ItemFilter-Settings__List-Item': true,
    'ItemFilter-Settings__List-Item--hovered': hovered,
  });
  const Icon = require(`../../../assets/img/itemtypeicons/${filterCat.id}.png`);
  const toggleEnabled = async (e) => {
    saveSettingsCallback(filterCat.id, { ignore: !ignored, minimumValue: minValue });
    setIgnored(!ignored);
  };

  const saveMinValue = async (e) => {
    const newMinValue = parseInt(e.target.value);
    saveSettingsCallback(filterCat.id, { ignore: ignored, minimumValue: newMinValue });
    setMinValue(newMinValue);
  }

  return (
    <>
      <ListItem
        key={filterCat.id}
        sx={{
          width: `100%`,
          justifyContent: 'space-between',
        }}
        className={rowClasses}
        dense
      >
        <ListItemIcon sx={{ minWidth: '1em'}} >
          <img className="Stash-Settings__Item-Icon__Image" src={Icon} alt={filterCat.hint} />
        </ListItemIcon>
        <Stack direction="row" spacing={2}>
          <ListItemText>{filterCat.desc}</ListItemText>
        </Stack>
        <Stack direction="row" spacing={2} alignItems={'center'} >
          <ContainerComponent callback={toggleEnabled}
                              isFolder={false}
                              disabled={false}
                              onMouseOver={() => setHovered(true)}
                              onMouseOut={() => setHovered(false)}
                              >
            <Checkbox
              size="small"
              edge="start"
              checked={ignored}
              sx={{
                '&.Mui-checked': {
                  color: '#fff',
                },
              }}
              />
            <ListItemText>Ignore</ListItemText>
          </ContainerComponent>
          <TextField label="Min value" type="number" size="small" value={minValue} onChange={saveMinValue}/>
        </Stack>
      </ListItem>
    </>
  );
};
const ObservedItemFilterRow = observer(ItemFilterRow);
const generateEmptySettings = () => {
  const settings = {};
  itemFilterCategories.forEach((cat) => {
    settings[cat.id] = { ignore: false, minimumValue: 0 };
  });
  return settings;
}

const ItemFilterSettings = ({ settings, updateCallback }) => {
  settings.perCategory = {...generateEmptySettings(),  ...settings.perCategory };
  const saveSettings = (catId, newSetting) => {
    const newSettings = { ...settings };
    newSettings.perCategory[catId] = { ...newSettings.perCategory[catId], ...newSetting };
    updateCallback({ perCategory: newSettings.perCategory });
  }
  return (
    <Accordion className="ItemFilter-Settings">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <h4 className="ItemFilter-Settings__Header">
          Ignore items per category
        </h4>
      </AccordionSummary>
      <AccordionDetails>  
        <List className="ItemFilter-Settings__List">
          {itemFilterCategories.map((filterCat: any) => (
            <ObservedItemFilterRow
              filterCat={filterCat}
              key={filterCat.id}
              settings={settings.perCategory}
              saveSettingsCallback={saveSettings}
            />
          ))}
        </List>
      </AccordionDetails>
    </Accordion>
  );
};

export default observer(ItemFilterSettings);
