import { computed, makeAutoObservable, runInAction } from 'mobx';
import { electronService } from '../electron.service';
import { Run } from './domain/run';

// Mobx store for maps
export default class RunStore {
  runs : Run[] = [];
  isLoading = true;

  constructor() {
      makeAutoObservable(this);
      this.loadRuns();
      electronService.ipcRenderer.on('refresh-runs', () => this.loadRuns());
  }

  loadRuns() {
    this.isLoading = true;
    electronService.ipcRenderer.invoke('load-runs').then((runs) => {
      runInAction(() => {
        const ids = this.runs.map(r => r.runId);
        ids.forEach((id, i) => {
          if(!runs.find((m) => m.id === id)) {
            this.runs.splice(i, 1);
          }
        });
        runs.forEach((json) => this.updateRunFromServer(json));
        this.isLoading = false;
      });
    });
  }

  @computed get sortedRuns() {
    return this.runs.slice().sort((first, second) => first.runId > second.runId ? -1 : 1);
  }

  updateRunFromServer(json) {
    let run = this.runs.find((m) => m.runId === json.id);
    if(!run) {
      run = new Run(this);
      this.runs.push(run);
    }
    run.updateFromJson(json);
  }
};