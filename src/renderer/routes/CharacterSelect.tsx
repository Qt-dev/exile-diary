import React from 'react';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Logo from '../assets/img/icons/png/128x128.png';
import { useLoaderData, useNavigate } from 'react-router-dom';
import './CharacterSelect.css';
import { electronService } from '../electron.service';
const { logger, ipcRenderer } = electronService;

const CharacterSelect = () => {
  const navigate = useNavigate();
  const { characters } = useLoaderData() as any;
  const [ character, setCharacter] = React.useState(characters.find((character) => character.current));
  const [ isSaving, setIsSaving ] = React.useState(false);
  const handleChange = (event: SelectChangeEvent<{ value: any }>) => {
    setCharacter(characters.find((character) => character.name = event.target.value));
  };

  const saveCharacter = async () => {
    logger.info('Saving active character from Login');
    await setIsSaving(true);
    const data = {
      activeProfile: {
        characterName: character.name,
        league: character.league,
        valid: true,
      }
    };
  
    await ipcRenderer.invoke('save-settings', { settings: data });
    
    navigate('/settings', { replace: true });
  };

  return (
    <div className="Character-Select">
      <img src={Logo} alt="Exile Diary Logo" className="Login__Logo" />
      <div className='Character-Select__Title'>
        Exile Diary <span className="Text--Legendary">Reborn</span>
      </div>
      <FormControl className="Character-Select__Form">
        <FormControl size="small">
          <Select id="character" value={character.name} onChange={handleChange}>
            {characters.map((character: any) => (
              <MenuItem key={character.name} value={character.name}>
                {character.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>Pick a character to track</FormHelperText>
        </FormControl>

        <Button
          variant="contained"
          color="primary"
          onClick={saveCharacter}
          disabled={isSaving}
          >
          Validate
        </Button>
      </FormControl>
    </div>
  );
};

export default CharacterSelect;