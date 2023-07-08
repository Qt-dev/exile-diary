import { computed, makeAutoObservable, runInAction } from 'mobx';
import { electronService } from '../electron.service';
import { Run } from './domain/run';
import moment from 'moment';
const { logger } = electronService;

// Mobx store for maps
export default class RunStore {
  runs: Run[] = [];
  isLoading = true;
  size = Number.MAX_SAFE_INTEGER;
  maxSize = Number.MAX_SAFE_INTEGER; // This can be changed in the future
  currentRun: Run;

  constructor() {
    makeAutoObservable(this);
    this.loadRuns(this.size);
    this.currentRun = new Run(this, {name: "Unknown"});
    electronService.ipcRenderer.on('refresh-runs', () => this.loadRuns(this.size));
    electronService.ipcRenderer.on('current-run:started', (event, json) => this.registerCurrentRun(json));
    electronService.ipcRenderer.on('current-run:info', (event, json) => this.updateCurrentRun(json));
  }

  loadRuns(size = this.maxSize) {
    logger.info(`Loading runs from the server with size: ${size}`);
    this.isLoading = true;
    electronService.ipcRenderer.invoke('load-runs', { size }).then((runs) => {
      runInAction(() => {
        logger.info(`Runs fetched from the server. Found ${runs.length} runs.`);
        const ids = this.runs
          .sort((first, second) => (first.runId > second.runId ? -1 : 1))
          .map((r) => r.runId);
        ids.forEach((id, i) => {
          if (!runs.find((m) => m.id === id)) {
            this.runs.splice(i, 1);
          }
        });
        runs.forEach((json) => this.updateRunFromServer(json));
        if (this.runs.length > this.maxSize - 1) {
          this.runs.splice(this.maxSize, this.runs.length - this.maxSize);
        }
        this.isLoading = false;
        logger.info(`Got ${this.runs.length} runs from the server.`);
      });
    });
  }

  async loadRun(runId: string) {
    return electronService.ipcRenderer.invoke('load-run', { runId }).then((json) => {
      return runInAction(() => {
        this.updateRunFromServer(json);
      });
    });
  }

  loadDetails(run: Run) {
    electronService.ipcRenderer.invoke('load-run-details', { runId: run.runId }).then((details) => {
      run.updateDetails(details);
    });
  }

  getSortedRuns(size = this.runs.length, page = 0) {
    const startingIndex = page * size;
    return this.runs
      .slice()
      .sort((first, second) => (first.runId > second.runId ? -1 : 1))
      .slice(startingIndex, startingIndex + size);
  }

  getPageCount(size) {
    return Math.ceil(this.runs.length / size);
  }

  @computed getFullDuration() : moment.Duration {
    return this.runs.reduce((acc, run) => acc.add(run.duration ?? 0), moment.duration(0, 'seconds'));
  }

  getNextRun(id: string) {
    const index = this.getSortedRuns(this.runs.length).findIndex((run) => run.id === id);
    return index < this.runs.length ? this.runs[index + 1] : null;
  }

  getPreviousRun(id: string) {
    const index = this.getSortedRuns(this.runs.length).findIndex((run) => run.id === id);
    return index > 0 ? this.runs[index - 1] : null;
  }

  updateRunFromServer(json) {
    let run = this.runs.find((m) => m.runId === json.id);
    if (!run) {
      run = new Run(this);
      this.runs.push(run);
    }
    run.updateFromJson(json);
  }

  registerCurrentRun(json) {
    this.currentRun = new Run(this, {name: json.area});
  }

  updateCurrentRun(json) {
    this.currentRun.updateFromJson(json);
  }
}
