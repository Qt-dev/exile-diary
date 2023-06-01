import React from 'react';
import { useLoaderData } from 'react-router';
import { electronService } from '../../electron.service';
import { observer } from 'mobx-react-lite';
const { logger } = electronService;

const StashSettings = ({ store, settings }) => {
  const stashes = useLoaderData();
  // logger.info(stashes);
  return <div>StashSettings</div>;
}

export default observer(StashSettings);