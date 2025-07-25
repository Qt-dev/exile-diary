import DatabaseConstructor, { Database } from 'better-sqlite3';
import * as path from 'path';
import { get as getSettings } from './settings';
import Logger from 'electron-log';
import { app } from 'electron';
import * as sqliteRegex from './sqlite-regex--cjs-fix';
import SettingsManager from '../SettingsManager';
import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'events';
import fs from 'fs';

const logger = Logger.scope('db/index');
const userDataPath = app.getPath('userData');

// Migrations to run on setup and on maintenance for each type of DB
// TODO: Move this to a separate file
const Migrations = {
  character: {
    init: [
      // version 0 - db initialize
      [
        `
          create table if not exists areainfo (
            id text primary key not null,
            name text not null,
            level number,
            depth number
          )
        `,
        `
          create table if not exists mapmods (
            area_id text not null,
            id text not null,
            mod text not null,
            primary key (area_id, id)
          )
        `,
        `
          create table if not exists events (
            id text not null,
            event_type text not null,
            event_text text,
            server text,
            primary key (id, event_type, event_text)
          )
        `,
        `
          create table if not exists items (
            event_id text not null, 
            id text not null,
            icon text not null,
            name text,
            rarity text not null,
            category text not null,
            identified number not null,
            typeline text not null,
            sockets text,
            stacksize number,
            rawdata text,
            primary key (event_id, id)
          )
        `,
        `
          create table if not exists lastinv (
            timestamp text not null,
            inventory text not null
          )
        `,
        `
          create table if not exists xp (
            timestamp text primary key not null,
            xp number not null
          )
        `,
        `
          create table if not exists mapruns (
            id text primary key not null,
            firstevent text unique not null,
            lastevent text unique not null,
            iiq number,
            iir number,
            packsize number,
            gained number,
            xp number
          )
        `,
        `
          create table if not exists filters (
            timestamp text primary key not null,
            text text
          )
        `,
        `
          create table if not exists leagues (
            timestamp text not null,
            league text primary key not null
          )
        `,
        `
          create table if not exists incubators ( 
            timestamp text primary key not null,
            data text not null
          )
        `,
        `alter table items add value number`,
      ],

      // version 1 - testing db versioning
      // every addition to initSQL must increment user_version
      [`pragma user_version = 1`],

      // version 2 - add runinfo
      [`pragma user_version = 2`, `alter table mapruns add runinfo text`],

      // version 3 - add gear checker
      [
        `pragma user_version = 3`,
        `
          create table if not exists gear (
            timestamp text not null,
            data text not null,
            diff text,
            primary key (timestamp)
          )
        `,
      ],

      // version 4 - fixes critical bug that caused previous versions to fail on first run
      [
        `pragma user_version = 4`,
        `alter table mapruns add kills number`,
        `insert or ignore into mapruns(id, firstevent, lastevent, gained, kills, runinfo) values(-1, -1, -1, -1, -1, '{"ignored":true}')`,
      ],

      // version 5 - league start and end dates
      [
        'pragma user_version = 5',
        `
          create view if not exists leaguedates as
            select league, timestamp as start, 
            (select ifnull(min(timestamp), 99999999999999) from leagues l2 where l2.timestamp > leagues.timestamp) as end
            from leagues
            order by start
        `,
      ],

      // version 6 - migration of fullrates and stashes to separate league DB
      [
        // not incremented here, requires extra processing (see debug.js)
      ],

      // version 7 - properly set ignored tag in runinfo, instead of relying on magic numbers
      [
        'pragma user_version = 7',
        `update mapruns set runinfo = JSON_SET(IFNULL(runinfo, '{}'), '$.ignored', true) where kills = -1 and gained = -1`,
      ],

      // version 8 - passive tree history
      [
        'pragma user_version = 8',
        `create table if not exists passives ( timestamp text primary key not null, data text not null )`,
      ],

      // version 9 - Einhar red/yellow beast tracking update
      [
        `pragma user_version = 9`,
        `
          update mapruns set runinfo = (
            select json_insert(
              runinfo, 
              '$.masters.\`Einhar, Beastmaster\`.redBeasts', redbeasts, 
              '$.masters.\`Einhar, Beastmaster\`.yellowBeasts', yellowbeasts
            ) as newinfo
            from (
              select id, sum(case beast when 'red' then 1 else 0 end) as redbeasts, sum(case beast when 'yellow' then 1 else 0 end) as yellowbeasts from (
                select case event_text
                  when 'Einhar, Beastmaster: Haha! You are captured, stupid beast.' then 'yellow'
                  when 'Einhar, Beastmaster: You have been captured, beast. You will be a survivor, or you will be food.' then 'yellow'
                  when 'Einhar, Beastmaster: This one is captured. Einhar will take it.' then 'yellow'
                  when 'Einhar, Beastmaster: Ohhh... That was a juicy one, exile.' then 'yellow'
                  when 'Einhar, Beastmaster: Do not worry little beast! We are friends now!' then 'yellow'
                  when 'Einhar, Beastmaster: Off you go, little beast! Away!' then 'yellow'
                  when 'Einhar, Beastmaster: We will be best friends beast! Until we slaughter you!' then 'yellow'
                  when 'Einhar, Beastmaster: Great job, Exile! Einhar will take the captured beast to the Menagerie.' then 'red'
                  when 'Einhar, Beastmaster: The First Ones look upon this capture with pride, Exile. You hunt well.' then 'red'
                  when 'Einhar, Beastmaster: Survivor! You are well prepared for the end. This is a fine capture.' then 'red'
                  when 'Einhar, Beastmaster: What? Do you not have nets, exile?' then 'red'
                  end 
                as beast from events
                where events.event_text like 'Einhar%'
                and events.id between mapruns.firstevent and mapruns.lastevent
                and beast is not null
              ) 
            )
          )
          where runinfo like '%"Einhar, Beastmaster"%' and runinfo like '%"beasts"%'
        `,
      ],
      // version 10 - Add Original Values to Items
      [
        `pragma user_version = 10`,
        `ALTER TABLE items ADD original_value NUMBER NOT NULL DEFAULT 0`,
        `ALTER TABLE items RENAME COLUMN value TO old_value`,
        `ALTER TABLE items ADD value NUMBER NOT NULL DEFAULT 0`,
        `UPDATE items SET original_value = old_value, value = old_value WHERE old_value IS NOT NULL`,
        `ALTER TABLE items DROP COLUMN old_value`,
      ],
      // Version 11 - Add Ignored column to Items
      [`pragma user_version = 11`, `ALTER TABLE items ADD ignored NUMBER NOT NULL DEFAULT 0`],
      // Version 12 - Remove gained column from mapruns
      [`pragma user_version = 12`, `ALTER TABLE mapruns DROP COLUMN gained`],
      // Version 13 - Update runes in DB to categorize them as Runes
      [
        `pragma user_version = 13`,
        `UPDATE items SET category = 'Kalguuran Rune' WHERE rarity = 'Currency' AND typeline LIKE '% Rune%'`,
      ],

      [
        // Delete view before all migrations
        `DROP VIEW IF EXISTS leaguedates`,

        // Mapruns format
        // TODO: Rename columns to be snake case
        `CREATE TABLE mapruns_bis (
            id INTEGER NOT NULL UNIQUE,
            first_event TEXT UNIQUE NOT NULL,
            last_event TEXT NOT NULL,
            iiq NUMBER,
            iir NUMBER,
            pack_size NUMBER,
            xp NUMBER,
            run_info TEXT,
            kills NUMBER,
            completed NUMBER DEFAULT 0,
            PRIMARY KEY("id" AUTOINCREMENT)
        )`,
        `DELETE from mapruns WHERE firstevent = -1 OR lastevent = -1`,
        `INSERT INTO mapruns_bis (first_event, last_event, iiq, iir, pack_size, xp, run_info, kills, completed)
          SELECT firstevent, lastevent, iiq, iir, packsize, xp, runinfo, kills, 1 FROM mapruns`,
        `UPDATE mapruns_bis
          SET 
            last_event = CAST(last_event AS INT),
            first_event = CAST(first_event AS INT)`,
        `UPDATE mapruns_bis
          SET 
            first_event = strftime('%Y-%m-%d %H:%M:%S', 
              substr(first_event, 1, 4) || '-' || 
              substr(first_event, 5, 2) || '-' || 
              substr(first_event, 7, 2) || ' ' || 
              substr(first_event, 9, 2) || ':' || 
              substr(first_event, 11, 2) || ':' || 
              substr(first_event, 13, 2)),
            last_event = strftime('%Y-%m-%d %H:%M:%S', 
              substr(last_event, 1, 4) || '-' || 
              substr(last_event, 5, 2) || '-' || 
              substr(last_event, 7, 2) || ' ' || 
              substr(last_event, 9, 2) || ':' || 
              substr(last_event, 11, 2) || ':' || 
              substr(last_event, 13, 2))`,
        `ALTER TABLE mapruns_bis RENAME TO "run"`,

        // Events Format
        `CREATE TABLE events_bis 
        (
          id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          event_text TEXT,
          server TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`,
        `INSERT INTO events_bis (event_type, event_text, server, timestamp)
          SELECT event_type, event_text, server, id
          FROM events
        `,
        `UPDATE events_bis
          SET timestamp = strftime('%Y-%m-%d %H:%M:%S', 
                        substr(timestamp, 1, 4) || '-' || 
                        substr(timestamp, 5, 2) || '-' || 
                        substr(timestamp, 7, 2) || ' ' || 
                        substr(timestamp, 9, 2) || ':' || 
                        substr(timestamp, 11, 2) || ':' || 
                        substr(timestamp, 13, 2))`,
        `DROP TABLE events`,
        `ALTER TABLE events_bis RENAME TO event`,

        // Mapmods format
        `CREATE TABLE mapmods_bis 
        (
        	id INTEGER NOT NULL,
        	run_id INTEGER NOT NULL,
        	mod TEXT NOT NULL,
        	PRIMARY KEY ("id" AUTOINCREMENT)
        )`,
        `INSERT INTO mapmods_bis (run_id, mod)
        	SELECT mapruns.id, mod
        	FROM mapmods, mapruns
        	WHERE mapmods.area_id = mapruns.id
        `,
        `DROP TABLE mapmods`,
        `ALTER TABLE mapmods_bis RENAME TO mapmod`,

        // Delete duplicated areainfo entries to make the areainfo unique per map_id
        `DELETE FROM areainfo
        WHERE areainfo.id NOT IN
        (
          SELECT MAX(a.id)
            FROM areainfo a, mapruns
            WHERE a.id BETWEEN mapruns.firstevent AND mapruns.lastevent
            GROUP BY mapruns.id
        )`,

        // AreaInfo Format
        `CREATE TABLE areainfo_bis 
        (
          id INTEGER NOT NULL,
          run_id INTEGER NOT NULL UNIQUE,
          name TEXT,
          level INTEGER,
          depth INTEGER,
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`,

        `INSERT INTO areainfo_bis (run_id, name, level, depth)
          SELECT mapruns.id, areainfo.name, areainfo.level, areainfo.depth
          FROM mapruns, areainfo
          WHERE areainfo.id BETWEEN mapruns.firstevent AND mapruns.lastevent
        `,

        `DROP TABLE areainfo`,

        `ALTER TABLE areainfo_bis RENAME TO area_info`,

        // Gear Format
        `CREATE TABLE gear_bis (
          id INTEGER NOT NULL,
          data TEXT NOT NULL,
          diff TEXT,
          timestamp TEXT NOT NULL,
          PRIMARY KEY(id AUTOINCREMENT)
        )`,

        `INSERT INTO gear_bis (timestamp, data, diff)
        SELECT timestamp, data, diff
        FROM gear`,

        `UPDATE gear_bis
        SET timestamp = strftime('%Y-%m-%d %H:%M:%S', 
                    substr(timestamp, 1, 4) || '-' || 
                    substr(timestamp, 5, 2) || '-' || 
                    substr(timestamp, 7, 2) || ' ' || 
                    substr(timestamp, 9, 2) || ':' || 
                    substr(timestamp, 11, 2) || ':' || 
                    substr(timestamp, 13, 2))`,

        `DROP TABLE gear`,
        `ALTER TABLE gear_bis RENAME TO gear`,

        // Filters Format
        `CREATE TABLE filters_bis (
          id INTEGER NOT NULL,
          text TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          PRIMARY KEY (id AUTOINCREMENT)
        )`,
        `INSERT INTO filters_bis (text, timestamp)
          SELECT text, timestamp
          FROM filters`,

        `UPDATE filters_bis
          SET timestamp = strftime('%Y-%m-%d %H:%M:%S',
                        substr(timestamp, 1, 4) || '-' ||
                        substr(timestamp, 5, 2) || '-' ||
                        substr(timestamp, 7, 2) || ' ' ||
                        substr(timestamp, 9, 2) || ':' ||
                        substr(timestamp, 11, 2) || ':' ||
                        substr(timestamp, 13, 2))`,

        `DROP TABLE filters`,
        `ALTER TABLE filters_bis RENAME TO "filter"`,

        // Incubators Format
        `CREATE TABLE incubators_bis (
          id INTEGER NOT NULL,
          data TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          PRIMARY KEY (id AUTOINCREMENT)
        )`,
        `INSERT INTO incubators_bis (data, timestamp)
          SELECT data, timestamp
          FROM incubators`,
        `UPDATE incubators_bis
          SET timestamp = strftime('%Y-%m-%d %H:%M:%S',
                        substr(timestamp, 1, 4) || '-' ||
                        substr(timestamp, 5, 2) || '-' ||
                        substr(timestamp, 7, 2) || ' ' ||
                        substr(timestamp, 9, 2) || ':' ||
                        substr(timestamp, 11, 2) || ':' ||
                        substr(timestamp, 13, 2))`,
        `DROP TABLE incubators`,
        `ALTER TABLE incubators_bis RENAME TO incubator`,

        // Items Format
        `CREATE TABLE items_bis (
          id INTEGER NOT NULL,
          item_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          icon TEXT NOT NULL,
          name TEXT,
          rarity TEXT NOT NULL,
          category TEXT NOT NULL,
          identified INTEGER NOT NULL,
          typeline TEXT NOT NULL,
          sockets TEXT,
          stack_size INTEGER,
          raw_data TEXT,
          value INTEGER NOT NULL DEFAULT 0,
          original_value INTEGER NOT NULL DEFAULT 0,
          ignored INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`,
        `INSERT INTO items_bis (item_id, event_id, icon, name, rarity, category, identified, typeline, sockets, stack_size, raw_data, value, original_value, ignored)
          SELECT id, event_id, icon, name, rarity, category, identified, typeline, sockets, stacksize, rawdata, value, original_value, ignored
          FROM items`,

        `UPDATE items_bis
          SET event_id = 
            (
            SELECT id 
            FROM event
            WHERE
              date(strftime('%Y-%m-%d %H:%M:%S', 
                substr(event_id, 1, 4) || '-' || 
                substr(event_id, 5, 2) || '-' || 
                substr(event_id, 7, 2) || ' ' || 
                substr(event_id, 9, 2) || ':' || 
                substr(event_id, 11, 2) || ':' || 
                substr(event_id, 13, 2))) = 
              date(event.timestamp)
            )`,
        `DROP TABLE items`,
        `ALTER TABLE items_bis RENAME TO item`,

        // Leagues Format
        `CREATE TABLE leagues_bis (
          id INTEGER NOT NULL,
          name TEXT NOT NULL UNIQUE,
          timestamp TEXT NOT NULL,
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`,
        `INSERT INTO leagues_bis (name, timestamp)
          SELECT league, timestamp
          FROM leagues`,
        `UPDATE leagues_bis
          SET timestamp = strftime('%Y-%m-%d %H:%M:%S', 
                        substr(timestamp, 1, 4) || '-' || 
                        substr(timestamp, 5, 2) || '-' || 
                        substr(timestamp, 7, 2) || ' ' || 
                        substr(timestamp, 9, 2) || ':' || 
                        substr(timestamp, 11, 2) || ':' || 
                        substr(timestamp, 13, 2))`,
        `DROP TABLE leagues`,
        `ALTER TABLE leagues_bis RENAME TO league`,

        // LastInv Format
        `CREATE TABLE last_inventory (
          id INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          inventory TEXT NOT NULL,
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`,
        `INSERT INTO last_inventory (timestamp, inventory)
          SELECT timestamp, inventory
          FROM lastinv`,
        `UPDATE last_inventory
          SET timestamp = strftime('%Y-%m-%d %H:%M:%S', 
                        substr(timestamp, 1, 4) || '-' || 
                        substr(timestamp, 5, 2) || '-' || 
                        substr(timestamp, 7, 2) || ' ' || 
                        substr(timestamp, 9, 2) || ':' || 
                        substr(timestamp, 11, 2) || ':' || 
                        substr(timestamp, 13, 2))`,
        `DROP TABLE lastinv`,

        // Passives Format
        `CREATE TABLE passives_bis (
          id INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`,
        `INSERT INTO passives_bis (timestamp, data)
          SELECT timestamp, data
          FROM passives`,
        `UPDATE passives_bis
          SET timestamp = strftime('%Y-%m-%d %H:%M:%S', 
                        substr(timestamp, 1, 4) || '-' || 
                        substr(timestamp, 5, 2) || '-' || 
                        substr(timestamp, 7, 2) || ' ' || 
                        substr(timestamp, 9, 2) || ':' || 
                        substr(timestamp, 11, 2) || ':' || 
                        substr(timestamp, 13, 2))`,
        `DROP TABLE passives`,
        `ALTER TABLE passives_bis RENAME TO passives`,

        // XP Format
        `CREATE TABLE xp_bis (
          id INTEGER NOT NULL,
          xp INTEGER NOT NULL,
          timestamp TEXT NOT NULL UNIQUE,
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`,
        `INSERT INTO xp_bis (timestamp, xp)
          SELECT timestamp, xp
          FROM xp`,
        `UPDATE xp_bis
          SET timestamp = strftime('%Y-%m-%d %H:%M:%S', 
                        substr(timestamp, 1, 4) || '-' || 
                        substr(timestamp, 5, 2) || '-' || 
                        substr(timestamp, 7, 2) || ' ' || 
                        substr(timestamp, 9, 2) || ':' || 
                        substr(timestamp, 11, 2) || ':' || 
                        substr(timestamp, 13, 2))`,
        `DROP TABLE xp`,
        `ALTER TABLE xp_bis RENAME TO xp`,

        `DROP TABLE mapruns`, // Remove old mapruns table. This could be used as a central reference for other tables
        `CREATE VIEW league_dates AS
          SELECT name, timestamp AS start, 
          (SELECT IFNULL(MIN(timestamp), DATETIME('now')) FROM "league" l2 WHERE l2.timestamp > "league".timestamp) AS end
          FROM "league"
          ORDER BY start`, // Create the view again after all migrations

        `pragma user_version = 14`,
      ],
    ],
    maintenance: [
      `delete from incubator where timestamp < (select min(timestamp) from (select timestamp from incubator order by timestamp desc limit 25))`,
    ],
  },
  league: {
    init: [
      [
        `pragma user_version = 1`,
        `
          create table if not exists characters (
            name text primary key not null
          )
        `,
        `
          create table if not exists fullrates (
            date text primary key not null,
            data text not null
          )
        `,
        `
          create table if not exists stashes (
            timestamp text primary key not null,
            items text not null,
            value text not null
          )
        `,
      ],
    ],
    maintenance: [],
  },
};

/**
 * DBManager
 *
 * Node and Electron's main process are single threaded. DB Connections were competing and locking parts of the DB, and so we are now using a single DBManager to handle all DB connections to a single DB.
 * This does not slow anything down, as the DBManager is still single threaded, but it does prevent DB locking.
 */
class DBManager {
  db: Database;
  tasks: string[] = [];
  isBusy: boolean = true;
  eventEmitter: EventEmitter = new EventEmitter();

  constructor({ dbPath }: { dbPath: string }) {
    logger.info('Starting DB:', dbPath);
    this.db = new DatabaseConstructor(dbPath);
    this.db.loadExtension(sqliteRegex.getLoadablePath());
    this.eventEmitter.on('task:added', () => {
      this.runTasks();
    });
    this.eventEmitter.on('task:ended', () => {
      this.runTasks();
    });
    this.isBusy = false;
    this.runTasks();
  }

  runTasks() {
    if (this.isBusy) {
      return;
    } else {
      const nextId = this.tasks.shift();
      if (nextId) {
        this.isBusy = true;
        this.eventEmitter.once(`task:end:${nextId}`, () => {
          this.isBusy = false;
          this.eventEmitter.emit(`task:ended`);
        });
        this.eventEmitter.emit(`task:start:${nextId}`);
      }
    }
  }

  runTask(task: Function): Promise<any> {
    const id = uuidv4();
    return new Promise((resolve) => {
      this.eventEmitter.once(`task:start:${id}`, () => {
        // logger.info(`Running task ${id}`);
        const result = task();
        this.eventEmitter.emit(`task:end:${id}`);
        resolve(result);
      });
      // logger.info(`Adding task ${id}`);
      this.tasks.push(id);
      this.eventEmitter.emit(`task:added`);
    });
  }

  init: Function = async (sqlList: string[][], maintSqlList: string[] = []) => {
    logger.info(`Initializing DB: ${this.db.name}`);
    let version = 0;
    try {
      version = this.db.pragma('user_version', { simple: true }) as number;
    } catch (err) {
      logger.error('Error reading database version: ' + err);
      return;
    }

    let migrationCounter = 0;

    for (const sqlPatch of sqlList) {
      const index = sqlList.indexOf(sqlPatch);
      if (version === 0 || index > version) {
        logger.debug(`Running initialization SQL for ${this.db.name} - version ${index}`);
        logger.debug(`SQL commands: ${JSON.stringify(sqlPatch)}`);
        for (const command of sqlList[index]) {
          logger.debug(`Running command: ${command}`);
          await this.runTask(() => this.db.prepare(command).run());
          migrationCounter++;
        }
      }
    }

    for (const command of maintSqlList) {
      await this.runTask(() => this.db.prepare(command).run());
      migrationCounter++;
    }

    logger.info(
      `Initialization complete for ${this.db.name} - ${migrationCounter} migrations applied`
    );
    return null;
  };
}

// Map of all the DB Managers that have been instantiated, by path
const DBConnections = new Map<string, DBManager>();

// External interface for DB
const DB = {
  getLeagueDbPath: (league: string) => {
    return path.join(userDataPath, `${league}.leaguedb`);
  },

  getCharacterDbPath: (characterName?: string, league?: string, oldVersion?: true) => {
    if (!characterName || !league) {
      const settings = getSettings();
      if (
        !settings ||
        !settings.activeProfile ||
        !settings.activeProfile.characterName ||
        !settings.activeProfile.characterName
      ) {
        // logger.error("No active profile selected, can't get DB");
        return null;
      }
      characterName = settings.activeProfile.characterName;
      league = settings.activeProfile.league;
    }
    if (oldVersion) {
      return path.join(userDataPath, `${characterName}.db`);
    } else {
      return path.join(userDataPath, `${characterName}.${league}.db`);
    }
  },

  getManager: (
    league: string | undefined = undefined,
    characterName: string | undefined = undefined
  ) => {
    const dbPath = !!league ? DB.getLeagueDbPath(league) : DB.getCharacterDbPath(characterName);
    let characterdbOldPath = DB.getCharacterDbPath(characterName, league, true);
    if (!dbPath) {
      return null;
    }

    if (
      !league &&
      !!characterName &&
      !!characterdbOldPath &&
      fs.existsSync(characterdbOldPath) &&
      !fs.existsSync(dbPath)
    ) {
      logger.info(`Found the old pattern in db name, copying ${characterdbOldPath} to  ${dbPath}`);
      fs.copyFileSync(characterdbOldPath, dbPath);
    }
    const manager: DBManager = DBConnections.get(dbPath) || new DBManager({ dbPath });
    DBConnections.set(dbPath, manager);

    return manager;
  },

  all: async (sql: string, params: any[] = [], league: string | undefined = undefined) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    return await manager.runTask(() => manager.db.prepare(sql).all(params));
  },

  get: async (sql: string, params: any[] = [], league: string | undefined = undefined) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    return manager.runTask(() => manager.db.prepare(sql).get(params));
  },

  run: async (sql: string, params: any[] = [], league: string | undefined = undefined) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    return await manager.runTask(() => manager.db.prepare(sql).run(params));
  },

  transaction: async (query: string, params: any[], league: string | undefined = undefined) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    return await manager.runTask(() => {
      const { db } = manager;
      const statement = db.prepare(query);
      const runMany = db.transaction((params) => {
        for (const param of params) {
          statement.run(param);
        }
      });
      return runMany(params);
    });
  },

  initDB: async (char: string) => {
    const manager = DB.getManager(undefined, char);
    if (!manager) return null;

    const { init, maintenance } = Migrations.character;
    await manager.init(init, maintenance);
  },

  initLeagueDB: async (league: string, characterName: string) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    const { init, maintenance } = Migrations.league;
    await manager.init(init, maintenance);

    const activeProfile = SettingsManager.get('activeProfile');

    if (!characterName && activeProfile.characterName) {
      await manager.runTask(() =>
        manager.db.prepare('insert into characters values (?)').run(activeProfile.characterName)
      );
    }
  },
};

export default DB;
