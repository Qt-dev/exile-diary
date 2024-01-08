import DatabaseConstructor, { Database } from 'better-sqlite3';
import * as path from 'path';
import { get as getSettings } from './settings';
import Logger from 'electron-log';
import { app } from 'electron';
import * as sqliteRegex from './sqlite-regex--cjs-fix';
import SettingsManager from '../SettingsManager';
import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'events';

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
    ],
    maintenance: [
      `delete from incubators where timestamp < (select min(timestamp) from (select timestamp from incubators order by timestamp desc limit 25))`,
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
        const result = task();
        this.eventEmitter.emit(`task:end:${id}`);
        resolve(result);
      });
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
        for (const command of sqlList[index]) {
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

  getCharacterDbPath: (characterName?: string) => {
    if (!characterName) {
      const settings = getSettings();
      if (!settings || !settings.activeProfile || !settings.activeProfile.characterName) {
        // logger.error("No active profile selected, can't get DB");
        return null;
      }
      characterName = settings.activeProfile.characterName;
    }
    return path.join(userDataPath, `${characterName}.db`);
  },

  getManager: (
    league: string | undefined = undefined,
    characterName: string | undefined = undefined
  ) => {
    const dbPath = !!league ? DB.getLeagueDbPath(league) : DB.getCharacterDbPath(characterName);
    if (!dbPath) {
      return null;
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

    return await manager.runTask(() => manager.db.prepare(sql).get(params));
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
          logger.info(param);
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
