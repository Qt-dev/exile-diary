import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import './LogBox.css';
import { Link } from 'react-router-dom';
import MuiLink from '@mui/material/Link';
import classNames from 'classnames';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { ipcRenderer } from 'electron';
import Price from '../Pricing/Price';

const classPerType = {
  error: 'Text--Error',
  important: 'Text--Rare',
  currency: 'Text--Legendary',
};

const Line = ({ messages, timestamp }) => {
  if (!messages) return null;
  const formattedMessages = messages.map(
    ({ type, text, link, linkEvent, icon, price, divinePrice }) => {
      const Element = [
        icon ? <img src={icon} alt={`icon-${icon}`} className={'Text--Icon'}></img> : null,
        type ? <span className={classPerType[type]}>{text}</span> : <>{text}</>,
      ];
      if (link) {
        return (
          <Link to={link} style={{ fontSize: 'inherit' }}>
            {Element}
          </Link>
        );
      } else if (linkEvent) {
        const triggerEvent = () => {
          ipcRenderer.send(linkEvent);
        };
        return (
          <MuiLink href="#" onClick={triggerEvent} style={{ fontSize: 'inherit' }}>
            {Element}
          </MuiLink>
        );
      } else if (price || price === 0) {
        return (
          <span className={classPerType['currency']}>
            <Price value={price} divinePrice={divinePrice} />
          </span>
        );
      } else {
        return <>{Element}</>;
      }
    }
  );
  const time = timestamp.format('YYYY-MM-DD HH:mm:ss');
  return (
    <div className="Log-Box__Line">
      <span className="Text--Legendary--2">[{time}] </span>
      {formattedMessages}
    </div>
  );
};

const LogBox = ({ store, enableAutoscroll }) => {
  const messages =
    (store.logs && store.logs.length) > 0
      ? store.logs.map(({ id, messages, timestamp }) => (
          <Line key={`Log-${id}`} timestamp={timestamp} messages={messages} />
        ))
      : '';
  const [isOpen, toggleOpenState] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(20);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartScrollTop, setDragStartScrollTop] = useState(0);
  const linesContainerRef = useRef<HTMLDivElement>(null);
  const scrollbarAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (isOpen && enableAutoscroll && linesContainerRef.current) {
      linesContainerRef.current.scrollTop = linesContainerRef.current.scrollHeight;
    }
  };

  // Listen for log-autoscroll event from main process
  useEffect(() => {
    const handleAutoscroll = () => {
      scrollToBottom();
    };

    ipcRenderer.on('log-autoscroll', handleAutoscroll);

    return () => {
      ipcRenderer.removeListener('log-autoscroll', handleAutoscroll);
    };
  }, [isOpen]);

  // Update scrollbar position
  const updateScrollbar = () => {
    if (linesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = linesContainerRef.current;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll > 0) {
        const percentage = scrollTop / maxScroll;
        setScrollPercentage(percentage);

        // Calculate thumb height based on viewport ratio
        const thumbHeightPercent = Math.max((clientHeight / scrollHeight) * 100, 10);
        setThumbHeight(thumbHeightPercent);
      }
    }
  };

  // Prevent scroll from bubbling to parent
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (linesContainerRef.current) {
      // Manually handle scrolling
      linesContainerRef.current.scrollTop += e.deltaY;
      updateScrollbar();
    }
  };

  // Handle scrollbar dragging
  const handleScrollbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (linesContainerRef.current) {
      setIsDragging(true);
      setDragStartY(e.clientY);
      setDragStartScrollTop(linesContainerRef.current.scrollTop);
    }
  };

  const handleScrollbarMove = (clientY: number) => {
    if (scrollbarAreaRef.current && linesContainerRef.current) {
      const scrollbarRect = scrollbarAreaRef.current.getBoundingClientRect();
      const { scrollHeight, clientHeight } = linesContainerRef.current;

      // Calculate how far the mouse has moved
      const deltaY = clientY - dragStartY;

      // Calculate the ratio between scrollbar movement and content scroll
      const scrollbarHeight = scrollbarRect.height;
      const thumbHeightInPixels = scrollbarHeight * thumbHeight / 100;
      const availableTrackHeight = scrollbarHeight - thumbHeightInPixels;
      const maxScroll = scrollHeight - clientHeight;

      // Convert pixel movement to scroll amount
      const scrollDelta = (deltaY / availableTrackHeight) * maxScroll;

      // Update scroll position
      linesContainerRef.current.scrollTop = Math.max(0, Math.min(maxScroll, dragStartScrollTop + scrollDelta));
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleScrollbarMove(e.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, thumbHeight, dragStartY, dragStartScrollTop]);

  // Watch for scroll and resize events
  useEffect(() => {
    const container = linesContainerRef.current;
    if (container && isOpen) {
      const handleScroll = () => updateScrollbar();
      container.addEventListener('scroll', handleScroll);

      const resizeObserver = new ResizeObserver(() => updateScrollbar());
      resizeObserver.observe(container);

      updateScrollbar(); // Initial update

      return () => {
        container.removeEventListener('scroll', handleScroll);
        resizeObserver.disconnect();
      };
    }
  }, [isOpen, messages.length]);

  const classes = classNames({
    'Log-Box': true,
    'Log-Box--Open': isOpen,
  });
  const icon = isOpen ? (
    <CloseFullscreenIcon
      fontSize="small"
      className="Log-Box__Icon"
      onClick={() => toggleOpenState(false)}
    />
  ) : (
    <OpenInFullIcon
      fontSize="small"
      className="Log-Box__Icon"
      onClick={() => toggleOpenState(true)}
    />
  );

  return (
    <div className={classes}>
      {isOpen && <div className="Log-Box__Sidebar">
        {icon}
        <div
          className="Log-Box__Scrollbar-Area"
          ref={scrollbarAreaRef}
          onMouseDown={handleScrollbarMouseDown}
        >
          <div
            className="Log-Box__Scrollbar-Thumb"
            style={{
              height: `${thumbHeight}%`,
              top: `${scrollPercentage * (100 - thumbHeight)}%`,
            }}
          ></div>
        </div>
      </div>}
      {!isOpen && icon}
      <div className="Log-Box__Lines" ref={linesContainerRef} onWheel={handleWheel}>
        <div className="Log-Box__Old_Lines">{messages.length > 1 ? messages.slice(0, -1) : ''}</div>
        <div className="Log-Box__Last_Line">{messages.slice(-1)}</div>
      </div>
    </div>
  );
};

export default observer(LogBox);
export { classPerType };
