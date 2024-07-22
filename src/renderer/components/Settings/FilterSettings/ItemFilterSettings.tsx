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

const ContainerComponent = ({ children, isFolder, disabled, callback }) => {
  if (isFolder) {
    return <div className="ItemFilter-Settings__List-Item-Container">{children}</div>;
  } else {
    return (
      <ListItemButton dense onClick={callback} disabled={disabled}>
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
  const rowClasses = classNames({
    'ItemFilter-Settings__List-Item': true,
  });
  const [ignored, setIgnored] = React.useState(settings[filterCat.id]?.ignore ?? false);
  const Icon = require(`../../../assets/img/itemtypeicons/${filterCat.id}.png`);
  const toggleEnabled = async (e) => {
    saveSettingsCallback(filterCat.id, { ignore: !ignored });
    setIgnored(!ignored);
  };

  return (
    <>
      <ListItem
        key={filterCat.id}
        sx={{
          backgroundColor: 'initial',
          height: '2.5em',
          width: `100%`,
        }}
        disablePadding
        className={rowClasses}
      >
        <ContainerComponent callback={toggleEnabled} isFolder={false} disabled={false}>
          <ListItemIcon sx={{ minWidth: 0 }} className="Stash-Settings__Item-Icon">
            <img className="Stash-Settings__Item-Icon__Image" src={Icon} alt={filterCat.hint} />
            <Checkbox
              size="small"
              edge="start"
              checked={ignored}
              sx={{
                // color: pink[800],
                '&.Mui-checked': {
                  color: '#fff',
                },
              }}
            />
          </ListItemIcon>

          <ListItemText>{filterCat.desc}</ListItemText>
        </ContainerComponent>
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
          Ignore items per category (<span className="Text--Error">WARNING</span>: This part only applies to future loot)
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
