import React, { useEffect } from 'react';
import { useParams, useLoaderData } from 'react-router';
import { useNavigate } from 'react-router-dom';
import { Divider } from '@mui/material';
import { observer } from 'mobx-react-lite';
import classNames from 'classnames';
import moment from 'moment';
import './Run.css';
import { Run as RunType } from '../stores/domain/run';
import RunEventIcons from '../components/RunEvent/RunEventIcons';
import RunEvent from '../components/RunEvent/RunEvent';

type RunLoaderData = {
  run: RunType;
};

const Run = ({ store }) => {
  const navigate = useNavigate();
  const { runId } = useParams();
  const { run } = useLoaderData() as RunLoaderData;

  useEffect(() => {
    if (!runId || !run) {
      navigate('/');
    }
    store.loadDetails(run);
  }, [runId, run, navigate, store]);

  // const handleMapChange = (event: SelectChangeEvent) => {
  //   navigate(`/run/${event.target.value}`);
  // };
  const duration = run.duration ? moment.utc(run.duration.asMilliseconds()).format('mm:ss') : '-';
  const xp = run.xp >= 0 ? `+${run.xp.toLocaleString('en')}` : run.xp.toLocaleString('en');
  const getXpClassname = (xp: number) => {
    return classNames({
      'Run__XP--Positive': xp > 0,
      'Run__XP--Negative': xp <= 0,
    });
  };

  return (
    <div className="Run">
      {/* <MapNavigation map={maps.find((map) => map.id === runId)} maps={maps}/> */}
      <Divider className="Separator" />
      <div className="Run__Header">
        <div className="Run__Header__Left">
          <div className="Run__Header__Name Text--Legendary">{run.name}</div>
          <div className="Run__Header__Level Text--Legendary">
            Monster level: {run.level} (Tier: {run.tier ? run.tier : '??'})
          </div>
          <div className="Run__Header__League Text--Legendary">{run.league} League</div>
        </div>
        <div className="Run__Header__Block">
          <div className="Run__Header__Block__Title">Item Quantity</div>
          <div className="Run__Header__Block__Value Text--Magic">
            {run.iiq ? `${run.iiq}%` : '-'}
          </div>
        </div>
        <div className="Run__Header__Block">
          <div className="Run__Header__Block__Title">Item Rarity</div>
          <div className="Run__Header__Block__Value Text--Magic">
            {run.iir ? `${run.iir}%` : '-'}
          </div>
        </div>
        <div className="Run__Header__Block">
          <div className="Run__Header__Block__Title">Monster Pack Size</div>
          <div className="Run__Header__Block__Value Text--Magic">
            {run.iir ? `${run.iir}%` : '-'}
          </div>
        </div>
        <div className="Run__Header__Block">
          <div className="Run__Header__Block__Title">Time</div>
          <div className="Run__Header__Block__Value Text--Magic">{duration}</div>
        </div>
      </div>
      <Divider className="Separator" />
      <div className="Run__XP">
        XP: <span className="Text--Rare">{run.initialxp?.toLocaleString('en')}</span>{' '}
        <span className={getXpClassname(run.xp)}>{xp}</span> -{' '}
        <span>{run.xpPerHour.toLocaleString('en', { maximumFractionDigits: 0 })}/hr</span>
      </div>
      <div className="Run__Kills">
        <span className="Text--Rare">{run.kills}</span> monsters slain
      </div>
      <Divider className="Separator" />
      <RunEventIcons info={run.runInfo} />
      <Divider className="Separator" />
      <div className="Run__Events">
        {run.events.map((event, i) => (
          <RunEvent
            key={`Event-${i}`}
            event={event}
            runInfo={run.runInfo}
            previousEvent={i > 0 ? run.events[i - 1] : null}
          />
        ))}
      </div>
      <Divider className="Separator" />
    </div>
  );
};

export default observer(Run);
