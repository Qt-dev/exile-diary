import { makeAutoObservable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import dayjs, { Dayjs } from 'dayjs';

type Message = {
  text: string;
  type: string;
  link?: string;
};

export type LogData = {
  id: string;
  timestamp: string;
  messages: Message[];
  link: string;
};

export class Log {
  id = null;
  messages: Message[] = [];
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
    this.link = logData.link;
  }
}
