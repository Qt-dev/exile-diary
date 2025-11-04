// Mock the dependencies first
jest.mock('../../../src/main/db/index');
jest.mock('electron-log', () => ({
  scope: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}));

import GraftbloodTracker from '../../../src/main/modules/GraftbloodTracker';
import DB from '../../../src/main/db/index';

const mockDB = DB as jest.Mocked<typeof DB>;

describe('GraftbloodTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getGraftbloodFromEquipment', () => {
    it('should return 0 when equipment is null', () => {
      const result = GraftbloodTracker.getGraftbloodFromEquipment(null);
      expect(result).toBe(0);
    });

    it('should return 0 when equipment is undefined', () => {
      const result = GraftbloodTracker.getGraftbloodFromEquipment(undefined);
      expect(result).toBe(0);
    });

    it('should return 0 when equipment is not an array', () => {
      const result = GraftbloodTracker.getGraftbloodFromEquipment({} as any);
      expect(result).toBe(0);
    });

    it('should return 0 when equipment has no grafts', () => {
      const equipment = [
        { inventoryId: 'Helm', properties: [] },
        { inventoryId: 'BodyArmour', properties: [] },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(0);
    });

    it('should extract current graftblood from a single graft', () => {
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          name: 'Gnarled Thought',
          typeLine: 'Storming Eshgraft',
          properties: [
            {
              name: 'Quality',
              values: [['+5%', 1]],
              displayMode: 0,
              type: 6,
            },
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['503', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(503);
    });

    it('should sum graftblood from both graft slots', () => {
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['0', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
        {
          inventoryId: 'BrequelGrafts2',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['503', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(503); // 0 + 503
    });

    it('should handle grafts with no properties', () => {
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: null,
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(0);
    });

    it('should handle grafts with properties but no graftblood property', () => {
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Quality',
              values: [['+5%', 1]],
              displayMode: 0,
              type: 6,
            },
          ],
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(0);
    });

    it('should handle graftblood property with missing values', () => {
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [],
              displayMode: 3,
            },
          ],
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(0);
    });

    it('should handle invalid graftblood values', () => {
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['invalid', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(0);
    });

    it('should handle maximum graftblood values', () => {
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['9252', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
        {
          inventoryId: 'BrequelGrafts2',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['9252', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(18504); // 9252 + 9252
    });

    it('should handle inventoryId variations using substring matching', () => {
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['100', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
        {
          inventoryId: 'BrequelGrafts2',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['200', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
        {
          inventoryId: 'SomeOtherInventoryId',
          properties: [],
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(300); // 100 + 200, ignoring non-graft items
    });

    it('should safely handle items with null or undefined inventoryId', () => {
      const equipment = [
        {
          inventoryId: null,
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['500', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
        {
          inventoryId: undefined,
          properties: [],
        },
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['100', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
      ];
      const result = GraftbloodTracker.getGraftbloodFromEquipment(equipment);
      expect(result).toBe(100); // Only the valid graft
    });
  });

  describe('logGraftblood', () => {
    it('should store graftblood value in database', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['503', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
      ];

      mockDB.run.mockResolvedValue(undefined);

      const result = await GraftbloodTracker.logGraftblood(timestamp, equipment);

      expect(result).toBe(503);
      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO graftblood(timestamp, value) VALUES(?, ?)',
        [timestamp, 503]
      );
    });

    it('should handle database insertion failure gracefully', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      const equipment = [
        {
          inventoryId: 'BrequelGrafts',
          properties: [
            {
              name: 'Graftblood: {0}/{1}',
              values: [
                ['100', 0],
                ['9252', 0],
              ],
              displayMode: 3,
            },
          ],
        },
      ];

      const mockError = new Error('Database insertion failed');
      mockDB.run.mockRejectedValue(mockError);

      const result = await GraftbloodTracker.logGraftblood(timestamp, equipment);

      expect(result).toBe(100);
      expect(mockDB.run).toHaveBeenCalled();
    });

    it('should store zero graftblood when no grafts equipped', async () => {
      const timestamp = '2023-01-01T12:00:00.000Z';
      const equipment = [{ inventoryId: 'Helm', properties: [] }];

      mockDB.run.mockResolvedValue(undefined);

      const result = await GraftbloodTracker.logGraftblood(timestamp, equipment);

      expect(result).toBe(0);
      expect(mockDB.run).toHaveBeenCalledWith(
        'INSERT INTO graftblood(timestamp, value) VALUES(?, ?)',
        [timestamp, 0]
      );
    });
  });

  describe('getGraftbloodGained', () => {
    it('should calculate graftblood gained between two timestamps', async () => {
      const firstEvent = '2023-01-01T12:00:00.000Z';
      const lastEvent = '2023-01-01T12:30:00.000Z';

      const mockRows = [{ value: 100 }, { value: 250 }, { value: 450 }];
      mockDB.all.mockResolvedValue(mockRows);

      const result = await GraftbloodTracker.getGraftbloodGained(firstEvent, lastEvent);

      expect(result).toBe(350); // 450 - 100
      expect(mockDB.all).toHaveBeenCalledWith(
        'SELECT value FROM graftblood WHERE DATETIME(timestamp) BETWEEN DATETIME(?) AND DATETIME(?) ORDER BY timestamp',
        [firstEvent, lastEvent]
      );
    });

    it('should return null when not enough data points', async () => {
      const firstEvent = '2023-01-01T12:00:00.000Z';
      const lastEvent = '2023-01-01T12:30:00.000Z';

      mockDB.all.mockResolvedValue([{ value: 100 }]);

      const result = await GraftbloodTracker.getGraftbloodGained(firstEvent, lastEvent);

      expect(result).toBeNull();
    });

    it('should return null when no data available', async () => {
      const firstEvent = '2023-01-01T12:00:00.000Z';
      const lastEvent = '2023-01-01T12:30:00.000Z';

      mockDB.all.mockResolvedValue([]);

      const result = await GraftbloodTracker.getGraftbloodGained(firstEvent, lastEvent);

      expect(result).toBeNull();
    });

    it('should handle negative graftblood gain (death/logout)', async () => {
      const firstEvent = '2023-01-01T12:00:00.000Z';
      const lastEvent = '2023-01-01T12:30:00.000Z';

      const mockRows = [{ value: 500 }, { value: 200 }];
      mockDB.all.mockResolvedValue(mockRows);

      const result = await GraftbloodTracker.getGraftbloodGained(firstEvent, lastEvent);

      expect(result).toBe(-300); // 200 - 500
    });

    it('should handle zero graftblood gain', async () => {
      const firstEvent = '2023-01-01T12:00:00.000Z';
      const lastEvent = '2023-01-01T12:30:00.000Z';

      const mockRows = [{ value: 100 }, { value: 100 }];
      mockDB.all.mockResolvedValue(mockRows);

      const result = await GraftbloodTracker.getGraftbloodGained(firstEvent, lastEvent);

      expect(result).toBe(0);
    });

    it('should handle database query failure', async () => {
      const firstEvent = '2023-01-01T12:00:00.000Z';
      const lastEvent = '2023-01-01T12:30:00.000Z';

      const mockError = new Error('Database query failed');
      mockDB.all.mockRejectedValue(mockError);

      const result = await GraftbloodTracker.getGraftbloodGained(firstEvent, lastEvent);

      expect(result).toBeNull();
    });

    it('should use first and last values even with many data points', async () => {
      const firstEvent = '2023-01-01T12:00:00.000Z';
      const lastEvent = '2023-01-01T12:30:00.000Z';

      const mockRows = [
        { value: 100 },
        { value: 200 },
        { value: 300 },
        { value: 400 },
        { value: 500 },
      ];
      mockDB.all.mockResolvedValue(mockRows);

      const result = await GraftbloodTracker.getGraftbloodGained(firstEvent, lastEvent);

      expect(result).toBe(400); // 500 - 100 (first and last only)
    });
  });
});
