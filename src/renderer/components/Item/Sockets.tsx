import React from 'react';

const Sockets = ({ item }) => {
  const sockets: any = [];
  let charPosition = 0;
  for (const group of item.sockets) {
    const chars = group.split('');
    for (const [index, color] of chars.entries()) {
      const style = {
        gridArea: `socket-${charPosition}`,
      };
      const link = index < chars.length - 1 ? <div className="Socket-Link" /> : null;
      sockets.push(
        <div key={`socket-${charPosition}`} className={`Socket-Container Socket-${charPosition}`} style={style}>
          <div className={`Socket Socket-${color}`}></div>
          {link}
        </div>
      );
      charPosition++;
    }
  }
  // We need to add a fake socket to re align stuff for the second line
  if (charPosition === 3) {
    sockets.push(
      <div key={`socket-3`} className={`Socket-Container Socket-3`}>
        <div className={`Socket Socket-None`}></div>
      </div>
    );
  }
  // item.sockets.join('').length;

  return <div className="Sockets">{sockets}</div>;
};

export default Sockets;
