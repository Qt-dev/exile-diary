
// Mock the dependencies first
jest.mock('../../../src/main/db/index');
jest.mock('../../../src/helpers/constants', () => ({
  uniqueFlasks: { 'Flask1.png': 'Test Flask' },
  uniqueMaps: { 'Map1.png': 'Test Map' },
  uniqueIconsNew: { 'TestIcon.png': 'Test Item' },
  uniqueIcons: { 'https://test.com/icon.png': 'Legacy Item' },
}));
jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

import Runs from '../../../src/main/db/run';
import DB from '../../../src/main/db/index';
import constants from '../../../src/helpers/constants';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('Runs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getLatestUncompletedRun', () => {
    it('should return the last area', async () => {
      const mockResult = { id: 42, first_event: '1', last_event: '2' };
      mockDB.get.mockResolvedValue(mockResult);
      
      const result = await Runs.getLatestUncompletedRun();
      
      expect(mockDB.get).toHaveBeenCalledTimes(1);
      const args = mockDB.get.mock.calls[0][0];
      expect(args).toContain('SELECT id, first_event, last_event FROM run');
      expect(args).toContain('ORDER BY id DESC');
      expect(args).toContain('LIMIT 1');
      
      expect(result).toBe(mockResult);
    });

    it('should return 0 when no runs exist', async () => {
      const emptyResult = {id: 0, first_event: null, last_event: null};
      mockDB.get.mockResolvedValue(emptyResult);
      
      const result = await Runs.getLatestUncompletedRun();

      expect(result).toEqual(emptyResult);
    });

    it('should handle database query failure', async () => {
      const mockError = new Error('Database error');
      mockDB.get.mockRejectedValue(mockError);
      
      await expect(Runs.getLatestUncompletedRun()).rejects.toThrow('Database error');
    });
  });

  describe('insertMapRun', () => {
    it('should insert map run with boolean conversion', async () => {
      const mapData = [
        'first_event_id',
        'last_event_id',
        75, // iiq
        150, // iir
        20, // pack_size
        1000, // xp
        50, // kills
        '{"test": "data"}', // run_info
        true, // completed
      ];
      mockDB.run.mockResolvedValue(undefined);

      const result = await Runs.insertMapRun(mapData);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO run(first_event, last_event, iiq, iir, pack_size, xp, kills, run_info, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['first_event_id', 'last_event_id', 75, 150, 20, 1000, 50, '{"test": "data"}', 1]
      );
    });

    it('should handle false boolean values', async () => {
      const mapData = ['first', 'last', 0, 0, 0, 0, 0, '{}', false];
      mockDB.run.mockResolvedValue(undefined);

      await Runs.insertMapRun(mapData);

      expect(mockDB.run).toHaveBeenCalledWith(
        expect.any(String),
        ['first', 'last', 0, 0, 0, 0, 0, '{}', 0]
      );
    });

    it('should handle mixed data types', async () => {
      const mapData = ['first', 'last', null, undefined, true, false, 'string', 123];
      mockDB.run.mockResolvedValue(undefined);

      await Runs.insertMapRun(mapData);

      expect(mockDB.run).toHaveBeenCalledWith(
        expect.any(String),
        ['first', 'last', null, undefined, 1, 0, 'string', 123]
      );
    });
  });

  describe('getLastRuns', () => {
    it('should get last runs with specified limit', async () => {
      const mockRuns = [
        { id: 1, name: 'Test Map', level: 83, deaths: 0, gained: 100 },
        { id: 2, name: 'Another Map', level: 84, deaths: 1, gained: 200 },
      ];
      mockDB.all.mockResolvedValue(mockRuns);

      const result = await Runs.getLastRuns(10);

      expect(mockDB.all).toHaveBeenCalledWith(expect.stringContaining('SELECT run.id, name, level'), [10]);
      expect(result).toEqual(mockRuns);
    });

    it('should handle MAX_SAFE_INTEGER for all runs', async () => {
      const mockRuns = [{ id: 1, name: 'Test Map' }];
      mockDB.all.mockResolvedValue(mockRuns);

      await Runs.getLastRuns(Number.MAX_SAFE_INTEGER);

      expect(mockDB.all).toHaveBeenCalledWith(expect.any(String), [Number.MAX_SAFE_INTEGER]);
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      mockDB.all.mockResolvedValue([]);

      await Runs.getLastRuns(5);

      const expectedQuery = expect.stringMatching(/SELECT run\.id, name, level.*FROM area_info, run.*WHERE area_info\.run_id = run\.id.*ORDER BY run\.id desc.*LIMIT \?/s);
      expect(mockDB.all).toHaveBeenCalledWith(expectedQuery, [5]);
    });
  });

  describe('getRunMods', () => {
    it('should get mods for a specific run', async () => {
      const mapId = 42;
      const mockMods = [{ mod: 'Increased Monster Life' }, { mod: 'Added Fire Damage' }];
      mockDB.all.mockResolvedValue(mockMods);

      const result = await Runs.getRunMods(mapId);

      expect(mockDB.all).toHaveBeenCalledWith(
        `
      SELECT mod
      FROM mapmod
      WHERE run_id = ?
      ORDER BY id;
    `,
        [BigInt(mapId)]
      );
      expect(result).toEqual(mockMods);
    });

    it('should handle BigInt conversion correctly', async () => {
      const mapId = 999999999999;
      mockDB.all.mockResolvedValue([]);

      await Runs.getRunMods(mapId);

      expect(mockDB.all).toHaveBeenCalledWith(expect.any(String), [BigInt(mapId)]);
    });
  });

  describe('getEvents', () => {
    it('should get events for a specific run', async () => {
      const mapId = 42;
      const mockEvents = [
        { id: 1, event_type: 'entered', timestamp: '2023-01-01T12:00:00.000Z' },
        { id: 2, event_type: 'slain', timestamp: '2023-01-01T12:05:00.000Z' },
      ];
      mockDB.all.mockResolvedValue(mockEvents);

      const result = await Runs.getEvents(mapId);

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT event.* FROM run, event'),
        [mapId]
      );
      expect(result).toEqual(mockEvents);
    });
  });

  describe('getRunInfo', () => {
    it('should get complete run information', async () => {
      const mapId = 42;
      const mockRunInfo = {
        id: 42,
        name: 'Test Map',
        level: 83,
        gained: 150,
        xpgained: 1000,
        league: 'Sanctum',
      };
      mockDB.get.mockResolvedValue(mockRunInfo);

      const result = await Runs.getRunInfo(mapId);

      expect(mockDB.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT run.id, name, level'),
        [mapId]
      );
      expect(result).toEqual(mockRunInfo);
    });
  });

  describe('getItems', () => {
    it('should get and format items for a run', async () => {
      const mapId = 42;
      const mockItems = [
        {
          id: 1,
          rarity: 'Rare',
          icon: 'icon1.png',
          value: 100,
          original_value: 90,
          stack_size: 1,
          raw_data: '{"typeLine": "Sword", "identified": true}',
          ignored: 0,
        },
      ];
      mockDB.all.mockResolvedValue(mockItems);

      const result = await Runs.getItems(mapId);

      expect(result).toEqual({
        1: ['{"typeLine":"Sword","identified":true,"rarity":"Rare","value":100,"originalValue":90,"pickupStackSize":1,"isIgnored":false}'],
      });
    });

    it('should handle empty items result', async () => {
      const mapId = 42;
      mockDB.all.mockResolvedValue(undefined);

      const result = await Runs.getItems(mapId);

      expect(result).toEqual([]);
    });

    it('should handle unique items with secret names', async () => {
      const mockItems = [
        {
          id: 1,
          rarity: 'Unique',
          icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAvCAYAAABzJ5OsAAARbklEQVRoQ7VaCXgUVdY9tXSnu9PpdLqzL2RpSCCQDGE3QBJWRRBXMuo/biioqDgqKDqDNDPgKDqO4MiIowKfCw6MG7iyBREQyCIhJCSQNAlZOnvS+1ZV738Vab+M4xDWyldfJ131qs6979x7z30vDACFSqVK4jjORY82+vcFHYQQhh5k3rx5ykP7Dj9t7WgOowMbtGptt5JR7u90d7YE77mgB17CTQwFnhqqCp3k8roOeL3eM7Ix9AwM9CyzGSw9pbzcvDy3zbOxpLJYNryTOqE3OX7IMUtj9evyc66mAUxibOwsgz78uvZ2W6fL1RPh8PnWyh4c6KVms5mCN0s5WenT441DdlWfPttmMBo6GMJGllcd+tgn+pbS53gGes5ATjrfdSYsLPSe66dPn9rT5Zyy+8C+EJ0ubHxvb2/9QC/tdz1qeu70Y0a9KTwgCmcyhoyI+2LPRysqTh55o6DAzO/bZxYuB+B5wYcoFA8lxsfckGHKMP14vDLd2tn6DB3wMuUyt23bNvF8g4vMRfwU8xRhQvbYLTlZ025vbmv+RqUMSYuJildt2PLiLL/fXxWcoathADNmVLZZ8gt5FSer07Iyhsa0tXczzZ2t0+jLDs6bB2oAfjZA9vbKlSuZyspMpqMjitm3b4rsVdX9hYuKurqdE5IS0oRmawPf2Fr3fXn14Ycp+MqBZvByjGKyhw3dHK2PvtHa2ii6A25lcrJJe+RoSYkn4C+gD3YFXy57UH6RzPPgd5PGzk6Lj4tdV2c5ObvsxGGJQJLv+ZJGvJlGfLU8np7kcgCenzYhIUMUYB9NHZR8P6MQ1IkJCUJZWbWytattLh24g54sBdsHQM6ND9672FReUZrrdgQmx8clj6trqBZO11c46eUWebboucdgMDR1dXU55FR6tYD34QlyMjYqqnBQfOyHUbFG1J5q4mrO1L5Krz9VUFBAg26fkDMsJ/k32WNf8vulm3q6u5U8r2LUoSG7DhV/v9nh7jhks9nqY2JiNGq1Wqyvr/deTdDBZ/eBb9mxg3urtDSQHBf3h9+MzFx1xtKCqprq/SLIbHqj7FXDUw8vKmqz9mTber2iIiSMcXpspKurg02MS2P0On11+anixcdOHNlD75W2bt3KFRYWSleTMn2eP2eF/ClPsSZ31Kj9tNCMPlp2vIXm6mvpdyee/f3iJS6X5+XaGouvs8embG63MjyrglEfScLCwqEPj2YUSo2v19Z+ymI5+ZqlpeZd2SkrVqyQy/BVo04QvByIfUVHoVBMyBo8+NuW1g5da0/nbRT8xwvvve+4u8eZ1dDSIDkDbransxex0YlQK8PR2t6O5tZaSaszMp2drSQ/dwabEJuwYdPWNx+jYwMy7YqKisSrYcTP4OUZCOZ2oz7sXn2oYWNdc8Pbjzz+yOcRnGZHcclRSDwDSSTweNxoamqHta0NAdGLIakm3H3HfeSlta9ITlcvyczM4j0+afOZusr5Mo36Z6orGQv/Ab6/AfGRhldEv/LJ6bOmtOlDVbENTY2UZBzcHg+Ky8rgdLvx6MInwHNqHC75AWnx0VThsejtdZPWE6cJNCy0sdryju7A6+UVxRuDz6bxIF2pWfgv8HIc0Blg5eoaHR67PjxC8/CMaXmSw+5iQ5QqfLl7Z5/H5UOvC4X5D2vQ2dGF4xXHwIocrpt7PV5+cTWUPrdo9XRwTj9BdnbO1wZD9KO7d39puZKx8GvgIRchYCV1kFlKTU58Kzdn3ALwrHSmvoGl+R8+bwBt7R0QRAHDTGmIjEiAISoGIUoOmYNH4qs9O+H2uaECL3Z3NcPlcXJ+RuxShWlWharV/6itrfVRI/hzlJKz0iUdvwq+P314ns+dPWXGdxqtmnf6nCQpJoFxO3lU155C5akj8FBDBFHsS1saBQejwYgWGtAhChXU6lCYUofDFJci9lip4Y4uJuDx33Ki6cSnwQTxk6MgV+aLptP/BN/PFfz0ifk7o2OMU7RarVR1soY9UHyEcl0JSRLAsgyUCgXc3v+uS6aYaAxNHI60pEzsOPQVMSglITo2sjMuLutHVmS2s529Rf88+ukp+V3njJCr+AWn1vOCP1dsxIJJuWZJEFeIoiTUWs7w7d1dYKhi+OV88wol9bgSo9MzwKl0CIuIgLW5EYXX/g6uziaUbipBN7HBpmpBSKgfGRmjnJOzpv6YlTL0w0nP3rKJ2uDdOo8WuG2F51WzQceeF3wwdQ5NT1/ISNIGnlcIDreL7+3pQa/D0UcV6qm++kZVGT04KDkOz8y/Dz2U0Z/sokEscEgdnoxhOUMxKZAJ1cfJ5Gxto1SOA0w5NrIOHcjCmx5lCoaO2nfS2lQ4//XFHbIBwDYUDiDJB6JNHxfpOSguMvpQTExUwrHKSkmpVLB+/0+dYvABwblOM2Ugf3ouirfXgVidSFYaIfqdkEI5hNwUjRzTaOS1FcCxV4va08dIObaTD/CxNCZlBJ+bPbLKFeAWvvP15oNyTGRmZjLzqqoI1TC/GtQDgf+5cMXGxhZqVcp/Rer1JCEpmfl4x44+4DJo2cI0TShCouOQNnEkWn/owVyLD9Om5CD7lQfhaGzB0T/9Hc0KET3Ts1BSdhw35U9E6Nc5aP9OCwuzEu+TPWIio+eShqX6pDD9hkGGlA2vf73xZF84gKoMStRfpqQBwQe1e1RUVCwRxdJwrTY+Mz2d7Ni9h9FyLCYmJKCkqxvXZI5AdHoqGkutyKvV4Mm3H4bmjmkg9h4w9m4IAoH93W1oNERi5fLN8OUYkDF5DKJ3pkJx3Em19HZEIUViUI9yvoZ16Rn37QWF/9YmxC1/fO2ys7/WkQ0Mnlotu1fOAlq15lO3132TyWAQRY7l7HYnVl87A2+VlmFiQQHcrR3o3m3By4ueQNort9MWjGYjF81ClZWA5RRITxf8jjgc8Trxl7+vQ4OSR+qcIZjb/AwsRcU4RaownskmFaRM8hMWseMF7s4515ZPXD4/j3rd/suubEDwwTQmg6d6PS1CpSw+29RsyM0cQVhjJHNHcjwsdXX4wtKAMMJjfHsKVmxci9C4Zohna8DlFQA0tZKDB0BOnYY3bgqVGGOwq2E/nj+6Hm3Q4fGEpchoNeAj8RDq6I8OiXhCew854HxXiJ2qUWSOGbXy1jVPmIM98wVlm/4cC2Yeyu+XafQseSw/TxQjDNxQtQJtbe349PtixMdEYYY/Bg/MWQZDYQLIxhfAeOzAmCxAraWNoRW+cgan6xPQyI9EV8CPaJcOnI+gBmVIV8zCN/73KIHehB75WKJ6DFt0fyNPL/qtWN3Qe9v8jcs+J7RXYAp/SqUX5Hn5xiDn9Hp9cq+999CiMWPidQmJkpou1FhO1+FIdQ10srbhjXgwfgmiFk2DIqIGwt/WIpAaBWRlU5Dh8NjjULerA1W9OnhJPIYoM9HqOIG3/UswiclFKjse5dJJVJMOJCtiMCEiUtpp2Mym5Uwt//OWvZMoB52EyAqb6yvNF3z0Ww55bqopdfW86TOlIz+WsQ21dXAKAkTK7ww6LYtTXkOKKR/hI7rQc7YKvpZmsGEa9FpFhERlo602gGa7BzWeAK7RXocI+1dYJSyGH8MQg0wkslkYp87HFvYFjHQnokOsFD9SHuScOu0SR2f3X4M4Lgr8uZmSU1bk1OEZR0abMtJe37GDRPI8c8PwDESodfjRUo3Jobm4AS8hoLLDp7bB2lKOFF0MOmwuiOpMuHusqHeewmmhE1p4Yccx9MCN+awZm6W3UUU7z7dUm6DgSrDU+wKMzCByQtjLWLlQV5iOy23qaT8uM+FiwSPYkI83mRYygrjhcEM9TW9gk3gF5ozNQqjEkbLTFcytwlMw+KciROtCra0MzYFyDFVNRpJmOgK+DljcO+EgEs1IDlpLN1AjxuIB9g76XQc+J5tpZUxGPmNCkiKRFKON6Z1Qa2utFXoPtxzZSUctvCzwM4cNe9jvsK8vt1qlmBAVW02bk9siBsOUbsAHR0ukAJHYZRErkegYgxi1ElucH+A4acIcdhrGMkb4iQ8NUjXxUvbWUvH8L/IZJmAkJY0GrTQHOZlr0MxWYDY14EZ2Jvk29jPGNt5aunrb508BQjGdffdFez4YuEMj9QUeh/drU1SkSqcMIZ9Z6pjFeDBwxljT+03XvkgqHsj4hHj2/9SPgquNxExlMo4KpTgoVUNNicLSxegQJoA8dgFGqyfhJfdibJf2U0x6ZNFMY45bTQvXYTxnfQgrFHdCI+mkTWnr2dHDZ/z5tc/efJ6YycXTpn90R3Bc0fDo6IJEvUEqaqlkMl2TmZnkyZ1/xM26VCgneLiA+MCEGzlPO5WL1T34Ha4l4YyAbeQk8yG+DQgwOh7AzPA4xsDVkTbSzkQxFeQkymkMLGDuxlTFbKwLLIWVUikCGnIEpYw+0uhyem0TnE7/iYv2fP+0GcayS9Mj9GvitDrSoVYQxuNn5zb+tnGd9OWt2tDa1VGKkBnVNrswI6OAT0mIIdv3fiU9S27jRjOTpVI0YSe+aywn9VqCgDGeFqYZ/FqSRPz4XvyK+Sc+wUOYiqmqUdgkfIgi6SAVGP6aSD5jeExS9LrDdd89fkng+xtg0oVuHhwVe3dqmkksqSnmhjWOkFxcXN4nEVvLM92hRzrd7sx2QoQZycP5xOjYiv3Fxaql3Lwhw8V0SUvXNn9gSvEOOUi6oe0chJHhI5gM5fXcHOkb8Uv2fRoHf2UL0cS0SOupfO4O8f5liC//DKt3zqroKr3rssFHKhSjJ6clH3V6A+yuhgYxGlrudu66L9YJ2+aq1ExKWIDfxBIpr12ScHPmRJcd7sVlVRW3FDCDZ6cQjsTROmlHBtmEsl4rzhyNQVL6nZiWNhMJ4nrs5exUHw1mYqWDpJg9gdaqcIRPMqbZJIsFl875fiLJeENqSsmJxuaUBoHmGKr/8zCEm8XdvP5Zcc0jszAr5Chf9Eeb4F1Gm1Q+JSJ5v6Xbcz3Pty0Lk3B7FlElBUiMsgcKhmNCmyvZ8gXTxOxlE5Cax0EjvIcvOJfCJ4WLUe44blzYfvLpddSeb824hDwfDNh+4BWzUlN2dbvc+XRpWPQSwnVJkjQFOexYfuzKNcJbZnmMCtwCP8RXaYXTann1qw7BQ1OeJh6cewwn4e4QgutNbJY6lqSX7yJfPD+ZH/xcOPGOLxMtUrdCzWYPnbDfUeUhzWzlO/aA/b1LyvP9s02wYI2LiHiabmi91OYPCJF0odNLJKZNksSJTAY3lbvh3zbG9eK6wD9KNZRi3kBgAc+yd6kVqs02n1teEqQia3AIUDuOir6cOCQMs8P+vgOOCiPPP+IUpQWRxJA6wjjTZ4k6fN/pasve0aNHd5fSheFL5nyfVJZl/k/NVFgYx3+jJlIuzzCimmM4lrY/tQGBSq9IdhIz0utjAws/E797byvdLqK9aYaCZWcEJOlzOra+X6PR15ylIEVlhFEsRWlApUKy4OXvGsfNekoTjfLd1h1T5O0CWaJfFvj+Wp92WlpVr+0NBUPuTjQahOYuG2+jkreTSAJ9CT+ICbV1Klx5Lj8ttOf2cIHhSqoS5a0huUeVl9uZfivL//G3EtoRBl53T29k9xveVm/9RUni80nP/gupcRz3tlqhuL/H6xPUdHUnjIlmakgzFcvg9Dy/qksQltNpV5SUlAgXtEZDnWxeaZYNkQ2U22UNPeU9gwvX8wPp5n5Tr6SLyVvDFcobHQG/GEmUxMWizSb5E0LAttIlqgleeBvkbEHPC17qk5vwlWZ5dpifx1w2bfobRdMKBdRHAYWC59dwIL/3CyKULJb7JZa2VNIqFsxpjS5sht1u777cncIrCj4YA/J2pzzNoZzqXp/ke4fuyK3wA6uiAVMXsJy+tIEKN/O5YB9oUv/n9SsO/tybmAIUcPuwT6ALZ/mU23+i/4SwkF6rOcdbA/300FPe6rzk42qB7wMUrAP016HnMsqpK7kj/v/Gb1HMcWOJmgAAAABJRU5ErkJggg==',
          value: 100,
          original_value: 90,
          stack_size: 1,
          raw_data: '{"typeLine": "Sword"}',
          ignored: 0,
        },
      ];
      mockDB.all.mockResolvedValue(mockItems);

      const result = await Runs.getItems(42);

      expect(result[1]).toBeDefined();
    });
  });

  describe('updateItemValues', () => {
    it('should update item values successfully', async () => {
      const items = [
        { id: 'item1', eventId: 'event1', value: 100 },
        { id: 'item2', eventId: 'event2', value: 200 },
      ];
      mockDB.transaction.mockResolvedValue(undefined);

      const result = await Runs.updateItemValues(items);

      expect(mockDB.transaction).toHaveBeenCalledWith(
        'UPDATE item SET value = ? WHERE id = ? AND event_id = ?',
        [
          [100, 'item1', 'event1'],
          [200, 'item2', 'event2'],
        ]
      );
      expect(result).toBe(true);
    });

    it('should handle transaction failure', async () => {
      const items = [{ id: 'item1', eventId: 'event1', value: 100 }];
      const mockError = new Error('Transaction failed');
      mockDB.transaction.mockRejectedValue(mockError);
      
      const result = await Runs.updateItemValues(items);

      expect(result).toBe(false);
    });
  });

  describe('getRun', () => {
    it('should get complete run data', async () => {
      const mapId = 42;
      const mockRunInfo = { id: 42, name: 'Test Map' };
      const mockMods = [{ mod: 'Test Mod' }];
      const mockEvents = [{ id: 1, event_type: 'entered' }];
      const mockItems = { 1: ['item data'] };

      // Mock all the sub-functions
      jest.spyOn(Runs, 'getRunInfo').mockResolvedValue(mockRunInfo);
      jest.spyOn(Runs, 'getRunMods').mockResolvedValue(mockMods);
      jest.spyOn(Runs, 'getEvents').mockResolvedValue(mockEvents);
      jest.spyOn(Runs, 'getItems').mockResolvedValue(mockItems);

      const result = await Runs.getRun(mapId);

      expect(result).toEqual({
        ...mockRunInfo,
        events: mockEvents,
        items: mockItems,
        mods: mockMods,
      });
    });
  });

  describe('getAreaInfo', () => {
    it('should get area information', async () => {
      const areaId = 42;
      const mockAreaInfo = { id: 1, run_id: 42, name: 'Test Area', level: 83, depth: 0 };
      mockDB.get.mockResolvedValue(mockAreaInfo);

      const result = await Runs.getAreaInfo(areaId);

      expect(mockDB.get).toHaveBeenCalledWith('SELECT * FROM area_info WHERE run_id = ?', [areaId]);
      expect(result).toEqual(mockAreaInfo);
    });
  });

  describe('insertAreaInfo', () => {
    it('should insert area info successfully', async () => {
      const areaData = { areaId: 42, name: 'Test Area', level: 83, depth: 0 };
      jest.spyOn(Runs, 'getAreaInfo').mockResolvedValue({ name: undefined, level: undefined, depth: undefined } as any);
      mockDB.run.mockResolvedValue(undefined);

      const result = await Runs.insertAreaInfo(areaData);

      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO area_info(run_id, name, level, depth) VALUES(?, ?, ?, ?) ON CONFLICT(run_id) DO UPDATE SET name = ?, level = ?, depth = ?',
        expect.arrayContaining([42, 'Test Area', 83, 0])
      );
      expect(result).toBe(true);
    });

    it('should handle missing area info', async () => {
      const areaData = { areaId: 42 };
      jest.spyOn(Runs, 'getAreaInfo').mockResolvedValue({ name: undefined, level: undefined, depth: undefined } as any);

      const result = await Runs.insertAreaInfo(areaData);

      expect(result).toBe(false);
    });

    it('should handle database insertion failure', async () => {
      const areaData = { areaId: 42, name: 'Test Area' };
      jest.spyOn(Runs, 'getAreaInfo').mockResolvedValue({ name: undefined, level: undefined, depth: undefined } as any);
      mockDB.run.mockRejectedValue(new Error('Constraint violation'));

      const result = await Runs.insertAreaInfo(areaData);

      expect(result).toBe(false);
    });
  });

  describe('deleteAreaInfo', () => {
    it('should delete area info successfully', async () => {
      const areaId = 42;
      mockDB.run.mockReset();
      mockDB.run.mockResolvedValue(undefined);

      const result = await Runs.deleteAreaInfo(areaId);

      expect(mockDB.run).toHaveBeenCalledWith('DELETE FROM areainfo WHERE run_id = ?', [areaId]);
      expect(result).toBe(true);
    });

    it('should handle deletion failure', async () => {
      const areaId = 42;
      const mockError = new Error('Foreign key constraint');
      mockDB.run.mockRejectedValue(mockError);
      
      const result = await Runs.deleteAreaInfo(areaId);
      
      expect(result).toBe(false);
    });
  });

  describe('insertMapMods', () => {
    beforeEach(() => {
      mockDB.run.mockReset();
    })
    it('should insert map mods successfully', async () => {
      const mapId = 42;
      const mods = ['Increased Monster Life', 'Added Fire Damage'];
      mockDB.run.mockResolvedValue(undefined);

      const result = await Runs.insertMapMods(mapId, mods);

      expect(mockDB.run).toHaveBeenCalledTimes(2);
      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO mapmod(run_id, mod) VALUES(?, ?)',
        [mapId, 'Increased Monster Life']
      );
      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO mapmod(run_id, mod) VALUES(?, ?)',
        [mapId, 'Added Fire Damage']
      );
      expect(result).toBe(true);
    });

    it('should handle empty mods array', async () => {
      const mapId = 42;
      const mods: string[] = [];

      const result = await Runs.insertMapMods(mapId, mods);

      expect(mockDB.run).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle insertion failure', async () => {
      const mapId = 42;
      const mods = ['Test Mod'];
      const mockError = new Error('Insertion failed');
      mockDB.run.mockRejectedValue(mockError);
      
      const result = await Runs.insertMapMods(mapId, mods);

      expect(result).toBe(false);
    });
  });

  describe('replaceMapMods', () => {
    it('should replace map mods by deleting and inserting', async () => {
      const mapId = 42;
      const mods = ['New Mod'];
      jest.spyOn(Runs, 'deleteMapMods').mockResolvedValue(true);
      jest.spyOn(Runs, 'insertMapMods').mockResolvedValue(true);

      await Runs.replaceMapMods(mapId, mods);

      expect(Runs.deleteMapMods).toHaveBeenCalledWith(mapId);
      expect(Runs.insertMapMods).toHaveBeenCalledWith(mapId, mods);
    });
  });

  describe('deleteMapMods', () => {
    it('should delete map mods successfully', async () => {
      const mapId = 42;
      mockDB.run.mockResolvedValue(undefined);

      const result = await Runs.deleteMapMods(mapId);

      expect(mockDB.run).toHaveBeenCalledWith('DELETE FROM mapmod WHERE mapmod.run_id = ?', [mapId]);
      expect(result).toBe(true);
    });

    it('should handle deletion failure', async () => {
      const mapId = 42;
      const mockError = new Error('Deletion failed');
      mockDB.run.mockRejectedValue(mockError);
      
      const result = await Runs.deleteMapMods(mapId);

      expect(result).toBe(false);

    });
  });

  describe('getAreaName', () => {
    it('should get area name from events', async () => {
      const timestamp = '123456789';
      const mockResult = { area: 'Test Area' };
      mockDB.get.mockResolvedValue(mockResult);
      
      const result = await Runs.getAreaName(timestamp);
      
      expect(mockDB.get).toHaveBeenCalledWith(
        "SELECT event_text AS area FROM event WHERE event_type='entered' AND id < ? ORDER BY id DESC LIMIT 1",
        [timestamp]
      );
      expect(result).toBe('Test Area');
    });
  });

  describe('getRunsFromDates', () => {
    it('should get runs within date range', async () => {
      const from = '2023-01-01';
      const to = '2023-01-31';
      const mockRuns = [{ id: 1, name: 'Test Map', gained: 100 }];
      mockDB.all.mockResolvedValue(mockRuns);

      const result = await Runs.getRunsFromDates(from, to);

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT areainfo.name, run.id'),
        [from, to]
      );
      expect(result).toEqual(mockRuns);
    });
  });

  describe('getItemsFromRun', () => {
    it('should get all items from a specific run', async () => {
      const mapRunId = '42';
      const mockItems = [{ id: 'item1', value: 100 }];
      mockDB.all.mockResolvedValue(mockItems);

      const result = await Runs.getItemsFromRun(mapRunId);

      expect(mockDB.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT item.*'),
        [mapRunId]
      );
      expect(result).toEqual(mockItems);
    });
  });

  describe('insertEvent', () => {
    it('should insert event successfully', async () => {
      const event = {
        event_type: 'entered',
        event_text: 'Test Area',
        timestamp: '2023-01-01T12:00:00.000Z',
        server: 'test-server',
      };
      mockDB.run.mockResolvedValue(undefined);

      const result = await Runs.insertEvent(event);

      expect(mockDB.run).toHaveBeenCalledWith(
        `
      INSERT INTO event( event_type, event_text, timestamp, server)
      VALUES(?, ?, ?, ?)
    `,
        [event.event_type, event.event_text, event.timestamp, event.server]
      );
      expect(result).toBe(true);
    });

    it('should handle insertion failure', async () => {
      const event = { event_type: 'test', event_text: null, timestamp: '2023-01-01', server: null };
      const mockError = new Error('Constraint violation');
      mockDB.run.mockRejectedValue(mockError);

      const result = await Runs.insertEvent(event);

      expect(result).toBe(false);
    });

    it('should validate SQL query structure for SQLite compatibility', async () => {
      const event = {
        event_type: 'entered',
        event_text: 'Test Area',
        timestamp: '2023-01-01T12:00:00.000Z',
        server: 'test-server',
      };
      mockDB.run.mockResolvedValue(undefined);

      await Runs.insertEvent(event);

      const expectedQuery = `
      INSERT INTO event( event_type, event_text, timestamp, server)
      VALUES(?, ?, ?, ?)
    `;
      
      expect(mockDB.run).toHaveBeenCalledWith(expectedQuery, [
        event.event_type,
        event.event_text,
        event.timestamp,
        event.server,
      ]);
      
      // Verify query matches expected SQLite event table schema
      expect(expectedQuery).toContain('INSERT INTO event');
      expect(expectedQuery).toContain('event_type');
      expect(expectedQuery).toContain('event_text');
      expect(expectedQuery).toContain('timestamp');
      expect(expectedQuery).toContain('server');
    });
  });
});


