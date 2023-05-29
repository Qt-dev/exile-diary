import { computed, makeAutoObservable, runInAction } from 'mobx';
import { electronService } from '../electron.service';
import { Run } from './domain/run';
const { logger } = electronService;

// Mobx store for maps
export default class RunStore {
  runs: Run[] = [];
  isLoading = true;
  size = 10;
  maxSize = 100; // This can be changed in the future

  constructor() {
    makeAutoObservable(this);
    this.loadRuns(this.size);
    electronService.ipcRenderer.on('refresh-runs', () => this.loadRuns(this.size));
  }

  setSize(size: number) {
    this.size = size;
    if (this.runs.length < size) {
      this.loadRuns(size);
    }
  }

  loadRuns(size = 10) {
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
      });
    });
  }

  async loadRun(runId: number) {
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

  @computed get sortedRuns() {
    return this.runs
      .slice()
      .sort((first, second) => (first.runId > second.runId ? -1 : 1))
      .slice(0, this.size - 1);
  }

  updateRunFromServer(json) {
    let run = this.runs.find((m) => m.runId === json.id);
    if (!run) {
      run = new Run(this);
      this.runs.push(run);
    }
    run.updateFromJson(json);
  }
}
