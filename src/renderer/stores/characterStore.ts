import { makeAutoObservable, runInAction } from 'mobx';
import { Character, CharacterData } from './domain/character';
import { electronService } from '../electron.service';
const { logger, ipcRenderer } = electronService;

// Mobx store for Items
export default class CharacterStore {
  characters: Character[] = [];
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchCharacters() {
    logger.info('Fetching characters for CharacterStore');
    this.isLoading = true;
    const characters = await ipcRenderer.invoke('get-characters');
    logger.info(`Found ${characters.length} characters in the backend.`);
    this.createCharacters(characters);
  }

  createCharacters(charactersData: CharacterData[]) {
    logger.info(`Setting up ${charactersData.length} characters in the frontend.`);
    this.isLoading = true;
    runInAction(() => {
      for(const characterData of charactersData) {
        this.createCharacter(characterData);
      }

      this.isLoading = false;
    });
  }

  createCharacter(characterData: CharacterData) {
    const existingCharacter = this.characters.find(character => character.name === characterData.name);
    if(existingCharacter) {
      existingCharacter.update(characterData);
    } else {
      const character = new Character(this, characterData);
      this.characters.push(character);
    }
  }
}
