import React, { useState } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams, GridSortModel } from '@mui/x-data-grid';
import { observer } from 'mobx-react-lite';
import ChaosIcon from '../../assets/img/c.png';
import './LootTable.css';
import { electronService } from '../../electron.service';
const { logger } = electronService;

const columns: GridColDef[] = [
  // { field: 'id', headerName: 'ID', width: 90 },
  {
    field: 'icon',
    headerName: '',
    sortable: false,
    filterable: false,
    renderCell: (params: GridRenderCellParams) => (
      <img src={params.row.icon} alt="Item Icon" className="Loot-Table__Item-Icon" />
    ),
  },
  {
    field: 'value',
    headerName: 'Unit Value',
    headerAlign: 'center',
    align: 'center',
    type: 'number',
  },
  {
    field: 'quantity',
    headerName: 'Quantity',
    headerAlign: 'center',
    align: 'center',
    type: 'number',
  },
  {
    field: 'totalValue',
    headerName: 'Total Value',
    headerAlign: 'center',
    align: 'center',
    type: 'number',
  },
  {
    field: 'name',
    flex: 1,
    headerName: 'Item Name',
  },
];

const LootTable = ({ profit, store }) => {
  const [sortModel, setSortModel] = useState<GridSortModel>([
    {
      field: columns[1].field,
      sort: 'desc',
    },
  ]);
  const handleSortChange = (model) => {
    logger.info('handleSortChange', model);
    /* if statement to prevent the infinite loop by confirming model is 
    different than the current sortModel state */
    if (JSON.stringify(model) !== JSON.stringify(sortModel)) {
      setSortModel(model);
    }
  };
  return (
    <div>
      <h2 className="Loot-Table__Header">
        Profit Breakdown (Total = {profit}
        <img className="Loot-Table__Chaos-Icon" src={ChaosIcon} alt="profit" />)
      </h2>
      <DataGrid
        density="compact"
        disableColumnFilter
        disableColumnMenu
        disableColumnSelector
        disableRowSelectionOnClick
        disableDensitySelector
        initialState={{ sorting: { sortModel } }}
        rows={store.getItemsForLootTable()}
        columns={columns}
        paginationModel={{ page: 0, pageSize: 100 }}
        onSortModelChange={handleSortChange}
      />
    </div>
  );
};

export default observer(LootTable);
