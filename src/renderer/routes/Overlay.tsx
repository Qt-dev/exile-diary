import React, { ReactNode, useLayoutEffect, useEffect, useRef } from 'react';
import { electronService } from '../electron.service';
import './Overlay.css';
import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import classNames from 'classnames';
import useResizeObserver from '@react-hook/resize-observer';
import { observer } from 'mobx-react-lite';
import moment, { Moment } from 'moment';
const { logger, ipcRenderer } = electronService;
const defaultTimer = 3;


const OverlayContent = ({ run }) => {
  const tier = run.tier ? `T${run.tier}` : null;
  const level = run.level ? `lvl ${run.level}` : null;
  const lvlInfo = run.level ? <>({tier ? `${tier} - `: null} {level})</> : null;
  const iiq = run.iiq ? <>IIQ: <span className='Text--Default'>{run.iiq}%</span></> : null;
  const iir = run.iir ? <>IIR: <span className='Text--Default'>{run.iir}%</span></> : null;
  const packSize = run.packSize ? <>Pack Size: <span className='Text--Default'>{run.packSize}%</span></> : '';
  const output = <>Tracking <span className="Text--Rare">{run.name}</span> {lvlInfo}{ run.iiq || run.iir || run.packSize ? ' - ' : ''} {iiq} {iir} {packSize}</>
  return (
    <div className="Overlay__Content">
      <div className="Overlay__Content__Header">
        <div className="Overlay__Content__Line">
          {output}
        </div>
      </div>
    </div>
  );
};

type OverlayLineProps = {
  children: ReactNode;
  alwaysVisibleChildren?: ReactNode;
  time?: number;
  isOpen?: boolean;
}

const OverlayLine = ({ children, alwaysVisibleChildren, time = -1,  isOpen } : OverlayLineProps) => {
  const [ open, setOpen ] = React.useState((isOpen || time > 0) ?? false);

  useEffect(() => {
    setOpen((isOpen || time > 0) ?? false);
  }, [isOpen, time]);

  const lineClassNames = classNames({
    'Overlay__Line--Open': isOpen && time > -1,
    'Overlay__Line--Closed': !isOpen || time < 0,
    'Overlay__Line': true,
  });

  return (
    <div className={lineClassNames}>
      <div className="Overlay__Line__Always-Visible">
        {alwaysVisibleChildren}
      </div>
      {open && 
        <div className="Overlay__Line__Content">
          {children}
          <div className={`Overlay__Timer ${time > -1 ? 'Overlay__Timer--Active' : 'Overlay__Timer--InActive'}`}>{time}</div>
        </div>}
    </div>
  )
};


const useSize = (target) => {
  const [ size, setSize ] = React.useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    setSize(target.current.getBoundingClientRect());
  }, [target]);

  useResizeObserver(target, (entry) => setSize(entry.contentRect));
  
  return size;
}

const OverlayVisibilityToggleButton = ({handleButtonClick, open}) => {
  const iconClassNames = classNames({
    'Overlay__Icon--Open': open,
    'Overlay__Icon': true,
  });

  return (
    <IconButton
      className="Overlay__Open-Button"
      size="small"
      sx={{ margin: '0', borderRadius: 1, border: '1px solid #555' }}
      onClick={handleButtonClick}>
      <ChevronRightIcon
        className={iconClassNames}
        sx={{transition: 'all 0.2s ease-in-out', height: '0.7em', width: '0.7em'}}/>
    </IconButton>
  );
  
};

const Overlay = ({ store }) => {
  const [ open, setOpen ] = React.useState(false);
  const [ lastUpdate, setLastUpdate ] = React.useState<Moment>(store.currentRun.lastUpdate ?? moment());
  
  // Timer management
  const [ time, setTime ] = React.useState(defaultTimer);
  const intervalRef = useRef<NodeJS.Timer>();
  const decreaseTimer = () => {
    setTime((prevTime) => {
      if(prevTime <= 0) {
        clearInterval(intervalRef.current);
        return -1;
      } else {
        return prevTime - 1;
      }
    })
  };
  useEffect(() => {
    if(time > 0) {
      intervalRef.current = setInterval(decreaseTimer, 1000);
    }
    return () => {
      clearInterval(intervalRef.current)
    };
  }, [time]);
  
  
  // Sizing Management
  const ref = useRef<HTMLDivElement>(null);
  const updateSize = ({ width, height }) => {
    if(!width || !height) return;
    ipcRenderer.send('overlay:resize', { width: parseInt(width.toFixed(0)) + 1, height: parseInt(height.toFixed(0)) + 1});
  };
  
  const size = useSize(ref);
  updateSize(size);
  
  const handleButtonClick = () => {
    setOpen(!open);
  };
  
  const boxClassNames = classNames({
    'Overlay__Box--Open': open,
    'Overlay__Box': true,
    'Box': true,
  });
  
  // Reset the timer if the run has changed
  useEffect(() => {
    if(store.currentRun.lastUpdate !== lastUpdate) {
      setLastUpdate(store.currentRun.lastUpdate);
      setTime(defaultTimer);
    }
  }, [ store.currentRun.lastUpdate ]);
  
  return (
    <div className='Overlay'
    ref={ref}
    >
      <div className={boxClassNames}
        >
          <OverlayLine
            time={time}
            isOpen={open && time > -1}
            alwaysVisibleChildren={
              <OverlayVisibilityToggleButton
                handleButtonClick={handleButtonClick}
                open={open} />
            }>
            <OverlayContent run={store.currentRun}/>
          </OverlayLine>
      </div>
    </div>
  );
};

export default observer(Overlay);
