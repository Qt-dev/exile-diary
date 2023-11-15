import { computed, makeAutoObservable, runInAction } from 'mobx';
import { electronService } from '../electron.service';
import { Run } from './domain/run';
import dayjs from 'dayjs';
import { json2csv } from 'json-2-csv';
const { logger } = electronService;

// Mobx store for maps
export default class RunStore {
  runs: Run[] = [];
  isLoading = false;
  size = Number.MAX_SAFE_INTEGER;
  maxSize = Number.MAX_SAFE_INTEGER; // This can be changed in the future
  currentRun: Run;
  csv: string = '';

  constructor(shouldSetupFromBackend = true) {
    makeAutoObservable(this);
    this.currentRun = new Run(this, { name: 'Unknown' });
    if (shouldSetupFromBackend) {
      this.setupFromBackend();
    }
  }

  createRuns(runs) {
    this.isLoading = true;
    runInAction(async () => {
      this.runs = runs.map((run) => new Run(this, run));
      await this.generateCsv();
      this.isLoading = false;
    });
  }

  reset() {
    this.runs = [];
  }

  setupFromBackend() {
    this.loadRuns(this.size);
    this.currentRun = new Run(this, { name: 'Unknown' });
    electronService.ipcRenderer.on('refresh-runs', () => this.loadRuns(this.size));
    electronService.ipcRenderer.on('current-run:started', (event, json) =>
      this.registerCurrentRun(json)
    );
    electronService.ipcRenderer.on('current-run:info', (event, json) =>
      this.updateCurrentRun(json)
    );
  }

  loadRuns(size = this.maxSize) {
    if(size === this.maxSize) {
      logger.info(`Loading all runs from the server.`);
    } else {
      logger.info(`Loading runs from the server with size: ${size}`);
    }
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

  @computed getFullDuration(): plugin.Duration {
    return this.runs.reduce(
      (acc, run) => acc.add(run.duration?.asSeconds() ?? 0, 'seconds'),
      dayjs.duration(0, 'seconds')
    );
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
    this.currentRun = new Run(this, { name: json.area, level: json.level });
  }

  updateCurrentRun(json) {
    this.currentRun.updateFromJson(json);
  }

  @computed get stats(): any {
    const totalTime = this.getFullDuration();
    const averageTime = dayjs.duration(
      totalTime.asMilliseconds() > 0 ? totalTime.asMilliseconds() / this.runs.length : 0
    );
    const totalProfit = this.runs.reduce((acc, run) => acc + run.profit, 0);
    const averageProfit = this.runs.length > 0 ? totalProfit / this.runs.length : 0;

    return {
      count: this.runs.length,
      time: {
        total: totalTime,
        average: averageTime,
      },
      profit: {
        total: totalProfit.toFixed(2),
        average: averageProfit.toFixed(2),
      },
    };
  }

  @computed async generateCsv(): Promise<void> {
    const baseData = this.runs.map((run) => run.asJson);
    const csv = await json2csv(baseData, {});

    this.csv = csv;
  }
}
