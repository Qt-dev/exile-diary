import React from 'react';

// function drawSockets(item) {
//   if (item.width === 1) {
//     return drawSocketsSingleColumn(item);
//   } else {
//     return drawSocketsTwoColumns(item);
//   }
// }

// function drawSocketsTwoColumns(item) {
//   var socketsDiv = document.createElement('div');
//   socketsDiv.className = 'sockets';

//   var padding = computeSocketPadding(item.getNumSockets());

//   var x = 0;
//   var y = 0;
//   var linked = false;

//   item.sockets.forEach(function (group) {
//     linked = false;
//     var chars = group.split('');
//     chars.forEach(function (socketColor) {
//       var socket = drawSocket(socketColor);
//       socket.style.left = (padding.x + x * 6).toString() + 'px';
//       socket.style.top = (padding.y + y * 6).toString() + 'px';
//       socketsDiv.appendChild(socket);

//       if (linked) {
//         var link = drawLink(x, y, padding);
//         socketsDiv.appendChild(link);
//       }

//       var newXY = incrementSocketPos(x, y);
//       x = newXY.x;
//       y = newXY.y;

//       linked = true;
//     });
//   });

//   return socketsDiv;
// }

// function drawSocketsSingleColumn(item) {
//   var socketsDiv = document.createElement('div');
//   socketsDiv.className = 'sockets';

//   var padding = computeSocketPaddingSingleColumn(item.getNumSockets());

//   var y = 0;
//   var linked = false;

//   item.sockets.forEach(function (group) {
//     linked = false;
//     var chars = group.split('');
//     chars.forEach(function (socketColor) {
//       var socket = drawSocket(socketColor);
//       socket.style.left = padding.x.toString() + 'px';
//       socket.style.top = (padding.y + y * 6).toString() + 'px';
//       socketsDiv.appendChild(socket);

//       if (linked) {
//         var link = drawLinkSingleColumn(y, padding);
//         socketsDiv.appendChild(link);
//       }

//       y += 1;
//       linked = true;
//     });
//   });

//   return socketsDiv;
// }

function computeSocketPadding(numSockets) {
  // The height values as computed by the formula below:
  //	1: 4,
  //	2: 4,
  //	3: 10,
  //	4: 10,
  //	5: 16,
  //	6: 16

  var width = numSockets == 1 ? 4 : 10;
  var height = (Math.ceil(numSockets / 2) - 1) * 6 + 4;

  var result: any = {};
  result.x = 2 + (10 - width) / 2;
  result.y = 2 + (16 - height) / 2;
  return result;
}

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
        <div className={`Socket-Container Socket-${charPosition}`} style={style}>
          <div className={`Socket Socket-${color}`}></div>
          {link}
        </div>
      );
      charPosition++;
    }
  }
  // We need to add a fake socket to re align stuff for the second line
  if(charPosition === 3) {
    sockets.push(
      <div className={`Socket-Container Socket-3`}>
        <div className={`Socket Socket-None`}></div>
      </div>
    );
  }
  // item.sockets.join('').length;

  return <div className="Sockets">{sockets}</div>;
};

export default Sockets;
