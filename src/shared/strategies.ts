export type Strategy = {
  id: number;
  name: string;
  description: string;
  color: string;
  costPerMap: number;
  assignmentCount?: number;
};

export type StrategyInput = {
  name: string;
  description: string;
  color: string;
  costPerMap: number;
};

export type RunStrategy = Pick<Strategy, 'id' | 'name' | 'color'>;

export type StrategyEconomics = {
  taggedRunCount: number;
  completedRunCount: number;
  incompleteRunCount: number;
  totalTimeSeconds: number;
  grossValue: number;
  totalCost: number;
  netValue: number;
  grossPerMap: number;
  netPerMap: number;
  grossPerHour: number;
  netPerHour: number;
};

export type StrategyStatsResult = {
  strategy: Strategy;
  economics: StrategyEconomics;
  stats: any;
};
