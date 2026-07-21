import { makeAutoObservable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import dayjs, { Dayjs } from 'dayjs';
import { OverlayMessage } from '../../../shared/contracts/exileDiaryApi';

export type LogData = {
  id?: string;
  timestamp?: string;
  messages: OverlayMessage[];
  link?: string;
};

export class Log {
  id: string | null = null;
  messages: OverlayMessage[] = [];
  timestamp: Dayjs | null = null;
  link: string | null = null;
  store = null;

  constructor(store, logData: LogData) {
    makeAutoObservable(this, {
      id: false,
      store: false,
    });
    this.store = store;
    this.id = uuidv4();
    this.timestamp = dayjs(logData.timestamp) ?? dayjs();
    this.messages = logData.messages;
    this.link = logData.link ?? null;
  }
}
