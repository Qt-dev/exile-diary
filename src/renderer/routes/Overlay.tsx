import React, { ReactNode, useLayoutEffect, useEffect, useRef } from 'react';
import { electronService } from '../electron.service';
import './Overlay.css';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import dayjs, { Dayjs } from 'dayjs';
import { classPerType } from '../components/LogBox/LogBox';
import Logo from '../logo.png';
import { Button } from '@mui/material';
import Price from '../components/Pricing/Price';
const { ipcRenderer, logger } = electronService;
const defaultTimer = 3;

const OverlayMapInfoLine = ({ run }) => {
  const tier = run.tier ? `T${run.tier}` : null;
  const level = run.level ? `lvl ${run.level}` : null;
  const lvlInfo = run.level ? (
    <>
      ({tier ? `${tier} - ` : null} {level})
    </>
  ) : null;
  const iiq = run.iiq ? (
    <>
      IIQ: <span className="Text--Default">{run.iiq}%</span>
    </>
  ) : null;
  const iir = run.iir ? (
    <>
      IIR: <span className="Text--Default">{run.iir}%</span>
    </>
  ) : null;
  const packSize = run.packSize ? (
    <>
      Pack Size: <span className="Text--Default">{run.packSize}%</span>
    </>
  ) : (
    ''
  );
  const mapInfo = (
    <div>
      Tracking <span className="Text--Rare">{run.name}</span> {lvlInfo}
      {run.iiq || run.iir || run.packSize ? ' - ' : ''} {iiq} {iir} {packSize}
    </div>
  );
  return <OverlayLineContent message={mapInfo} />;
};

const OverlayNotificationLine = ({ messages }) => {
  if (!messages) return null;
  const formattedMessages = messages.map(({ type, text, icon, price, divinePrice }) => {
    if (price || price === 0) {
      return [<span className={classPerType['currency']}><Price value={price} divinePrice={divinePrice} /></span>];
    } else if (icon) {
      return [<img src={icon} alt="icon" className={'Text--Icon'} />];
    } else if (type) {
      return [<span className={classPerType[type]}>{text}</span>];
    } else {
      return [<>{text}</>];
    }
  });
  return <OverlayLineContent message={formattedMessages} />;
};

const OverlayLineContent = ({ message }) => {
  return (
    <div className="Overlay__Content">
      <div className="Overlay__Content__Header">
        <div className="Overlay__Content__Line">{message}</div>
      </div>
    </div>
  );
};

type OverlayLineProps = {
  children: ReactNode;
  alwaysVisibleChildren?: ReactNode;
  latestMapTrackingMessage: ReactNode;
  time?: number;
  isOpen?: boolean;
  invisible?: boolean;
};

const OverlayLine = ({
  children,
  alwaysVisibleChildren,
  time = -1,
  isOpen,
  latestMapTrackingMessage,
  invisible,
}: OverlayLineProps) => {
  const [open, setOpen] = React.useState((isOpen || time > 0) ?? false);

  useEffect(() => {
    setOpen((isOpen || time > 0) ?? false);
  }, [isOpen, time]);

  const lineClassNames = classNames({
    'Overlay__Line--Invisible': !open && invisible,
    'Overlay__Line--Open': isOpen && time > -1,
    'Overlay__Line--Closed': !isOpen || time < 0,
    'Overlay__Line--Timer-Visible': time > -1,
    Overlay__Line: true,
  });

  return (
    <div className={lineClassNames}>
      <div className="Overlay__Line__Always-Visible">{alwaysVisibleChildren}</div>
      {open && (
        <>
          <div className="Overlay__Line__Content">
            {time > 1 ? latestMapTrackingMessage : children}
          </div>
          <div
            className={`Overlay__Timer ${
              time > -1 ? 'Overlay__Timer--Active' : 'Overlay__Timer--InActive'
            }`}
          >
            {time}
          </div>
        </>
      )}
    </div>
  );
};

const Overlay = ({ store }) => {
  const [open, setOpen] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<Dayjs>(store.currentRun.lastUpdate ?? dayjs());
  const [latestMessage, setLatestMessage] = React.useState<JSX.Element | null>(<div>---</div>);
  const [latestMapTrackingMessage, setLatestMapTrackingMessage] =
    React.useState<JSX.Element | null>(<div>---</div>);
  const [moveable, setMoveable] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const isSetup = useRef(false);

  // Timer management
  const [time, setTime] = React.useState(defaultTimer);
  const [notificationTime, setNotificationTime] = React.useState(0);
  const mapTrackingIntervalRef = useRef<ReturnType<typeof setTimeout>>();
  const notificationIntervalRef = useRef<ReturnType<typeof setTimeout>>();
  const generateDecreaseTimer = (timeType) => () => {
    const setter = timeType === 'map' ? setTime : setNotificationTime;
    const interval =
      timeType === 'map' ? mapTrackingIntervalRef.current : notificationIntervalRef.current;

    setter((prevTime) => {
      if (prevTime <= 0) {
        clearInterval(interval);
        return -1;
      } else {
        return prevTime - 1;
      }
    });
  };
  useEffect(() => {
    if (time > 0) {
      mapTrackingIntervalRef.current = setInterval(generateDecreaseTimer('map'), 1000);
    }
    return () => {
      clearInterval(mapTrackingIntervalRef.current);
    };
  }, [time]);

  useEffect(() => {
    if (notificationTime > 0) {
      notificationIntervalRef.current = setInterval(generateDecreaseTimer('notification'), 1000);
    }
    return () => {
      clearInterval(notificationIntervalRef.current);
    };
  }, [notificationTime]);

  useLayoutEffect(() => {
    if (isSetup.current) {
      ipcRenderer.send('overlay:set-position', { x: position.x, y: position.y });
    }
  }, [position.x, position.y]);

  const boxClassNames = classNames({
    'Overlay__Box--Open': open,
    'Overlay__Box--Invisible': !open && time <= 0 && notificationTime <= 0,
    Overlay__Box: true,
    Box: true,
  });

  const updatePosition = () => {
    ipcRenderer.invoke('overlay:get-position').then((position) => {
      setPosition(position);
      isSetup.current = true;
    });
  };

  useLayoutEffect(() => {
    ipcRenderer.removeAllListeners('overlay:trigger-reposition');
    ipcRenderer.on('overlay:trigger-reposition', () => {
      updatePosition();
    });
    ipcRenderer.removeAllListeners('overlay:set-persistence');
    ipcRenderer.on('overlay:set-persistence', (event, isDisabled) => {
      logger.debug('Setting persistence to', isDisabled);
      setOpen(!isDisabled);
    });

    ipcRenderer.removeAllListeners('overlay:toggle-movement');
    ipcRenderer.on('overlay:toggle-movement', (event, { isOverlayMoveable }) => {
      setMoveable(isOverlayMoveable);
      ipcRenderer.send('overlay:make-clickable', { clickable: isOverlayMoveable });
    });

    return () => {
      ipcRenderer.removeAllListeners('overlay:trigger-reposition');
      ipcRenderer.removeAllListeners('overlay:set-persistence');
      ipcRenderer.removeAllListeners('overlay:toggle-movement');
    };
  }, []);

  useEffect(() => {
    ipcRenderer.removeAllListeners('overlay:toggle-visibility');
    ipcRenderer.removeAllListeners('overlay:message');

    ipcRenderer.on('overlay:message', (event, { messages }) => {
      setNotificationTime(defaultTimer);
      setLatestMessage(<OverlayNotificationLine messages={messages} />);
    });
    ipcRenderer.invoke('overlay:get-persistence').then((isDisabled) => {
      setOpen(!isDisabled);
    });

    return () => {
      ipcRenderer.removeAllListeners('overlay:message');
      ipcRenderer.removeAllListeners('overlay:toggle-visibility');
    };
  }, []);

  useEffect(() => {
    if (store.currentRun.lastUpdate.isAfter(lastUpdate)) {
      setLastUpdate(store.currentRun.lastUpdate);
      setTime(defaultTimer);
      setLatestMapTrackingMessage(<OverlayMapInfoLine run={store.currentRun} />);
    }
  }, [store.currentRun, store.currentRun.lastUpdate, lastUpdate]);

  // TODO: Change latestMapTrackingMessage to actually just open the OL
  const containerClassNames = classNames({
    'Overlay-Container--Moveable': moveable,
    'Overlay-Container': true,
  });
  return (
    <div className={containerClassNames}>
      <div
        className="Overlay"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        draggable={moveable}
        onDragStart={(e) => {
          offset.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
        }}
        onDragEnd={(e) => {
          setPosition({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
          offset.current = { x: 0, y: 0 };
        }}
      >
        <div className={boxClassNames}>
          <OverlayLine
            time={time}
            isOpen={open || time > -1}
            latestMapTrackingMessage={latestMapTrackingMessage}
          >
            <OverlayMapInfoLine run={store.currentRun} />
          </OverlayLine>
          <OverlayLine
            time={notificationTime}
            isOpen={open || notificationTime > -1}
            alwaysVisibleChildren={<img className="Overlay__Logo" src={Logo} alt="Logo" />}
            latestMapTrackingMessage={latestMessage}
          >
            {latestMessage}
          </OverlayLine>
        </div>
      </div>
      <div className="Overlay-Label">
        <div>Move the Overlay where you want it to be, then press CTRL+F9 to lock it in place.</div>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            setPosition({ x: 0, y: 0 });
          }}
        >
          Reset Overlay Position
        </Button>
      </div>
    </div>
  );
};

export default observer(Overlay);
