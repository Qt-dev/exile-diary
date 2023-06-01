import { makeAutoObservable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';

export type CharacterData = {
  id: string;
  name: string;
  level: number;
  class: string;
  league: string;
  active?: boolean;
};

export class Character {
  id = uuidv4();
  name: string;
  level: number;
  class: string;
  league: string;
  active?: boolean;
  store = null;

  constructor(store, characterData: CharacterData) {
    makeAutoObservable(this, {
      id: false,
      store: false,
    });
    this.store = store;
    this.name = characterData.name;
    this.level = characterData.level;
    this.class = characterData.class;
    this.league = characterData.league;
    this.active = characterData.active;
  }

  update(characterData: CharacterData) {
    this.level = characterData.level;
    this.class = characterData.class;
    this.league = characterData.league;
    this.active = characterData.active;
  }
}
