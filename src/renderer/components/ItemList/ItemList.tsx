import React from 'react';
import logger from 'electron-log/renderer';
import { observer } from 'mobx-react-lite';
import Item from '../Item/Item';
import './ItemList.css';

const ItemList = ({ store }) => {
  return (
    <div className="Item-List">
      {store.items.map((item) => {
        return <Item key={item.id} item={item} />;
      })}
    </div>
  );
};

export default observer(ItemList);
