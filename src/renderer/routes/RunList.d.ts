import React from 'react';
import RunStore from '../stores/RunStore';

export interface RunListProps {
  /**
   * The number of maps to show.
   */
  NumbersOfMapsToShow?: number;
  /**
   * The store for the runs.
   */
  store: RunStore;
  /**
   * Whether the component should be boxed.
   */
  isBoxed?: boolean;
}

/**
 * A component that shows a list of runs.
 */
declare const RunList: React.FC<RunListProps>;

export default RunList;
