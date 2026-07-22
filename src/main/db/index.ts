import DatabaseConstructor, { Database } from 'better-sqlite3';
import * as path from 'path';
import { get as getSettings } from './settings';
import Logger from 'electron-log';
import * as sqliteRegex from './sqlite-regex--cjs-fix';
import SettingsManager from '../SettingsManager';
import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'events';
import fs from 'fs';
import { getUserDataPath } from '../runtime/getUserDataPath';

const logger = Logger.scope('db/index');

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
      [
        // Fix item event_id not being a number
        `ALTER TABLE item ADD COLUMN new_event_id INTEGER NOT NULL DEFAULT 0`,
        `UPDATE item SET new_event_id = CAST(event_id AS INTEGER)`,
        `ALTER TABLE item DROP COLUMN event_id`,
        `ALTER TABLE item RENAME COLUMN new_event_id TO event_id`,

        // Add some indexes
        `CREATE INDEX IF NOT EXISTS "item_ignored" ON "item" (
          "ignored",
          "event_id"
        )`,
        `CREATE INDEX IF NOT EXISTS "item_value" ON "item" (
          "event_id",
          "ignored",
          "value"
        )`,

        `pragma user_version = 15`,
      ],
      [
        // Fix Venarius bossfights tracking
        `UPDATE run
        SET run_info = json_remove(run_info, '$.synthesis')
        WHERE json_array_length(json_extract(run_info, '$.synthesis.bossFights')) = 0;`,
        `pragma user_version = 16`,
      ],
      [
        // Add graftblood tracking table
        `CREATE TABLE IF NOT EXISTS graftblood (
          id INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          value INTEGER NOT NULL,
          PRIMARY KEY ("id" AUTOINCREMENT)
        )`,
        `CREATE INDEX IF NOT EXISTS "graftblood_timestamp" ON "graftblood" ("timestamp")`,
        `pragma user_version = 17`,
      ],
      [`ALTER TABLE item ADD COLUMN valuation TEXT`, `pragma user_version = 18`],
    ],
    maintenance: [
      `delete from incubator where timestamp < (select min(timestamp) from (select timestamp from incubator order by timestamp desc limit 25))`,
    ],
  },
  league: {
    init: [
      [
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
        `pragma user_version = 1`,
      ],
    ],
    maintenance: [
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
  statements: Map<string, ReturnType<Database['prepare']>> = new Map();
  tasks: string[] = [];
  isBusy: boolean = true;
  eventEmitter: EventEmitter = new EventEmitter();
  hasRegexExtension: boolean = false;

  constructor({ dbPath }: { dbPath: string }) {
    logger.info('Starting DB:', dbPath);
    this.db = new DatabaseConstructor(dbPath);
    this.loadRegexExtension();
    this.eventEmitter.on('task:added', () => {
      this.runTasks();
    });
    this.eventEmitter.on('task:ended', () => {
      this.runTasks();
    });
    this.isBusy = false;
    this.runTasks();
  }

  private loadRegexExtension() {
    this.hasRegexExtension = false;
    try {
      const extensionPath = sqliteRegex.getLoadablePath();
      this.db.loadExtension(extensionPath);
      this.hasRegexExtension = true;
    } catch (error) {
      logger.warn(
        `Failed to load sqlite regex extension for ${this.db.name}. Continuing without it.`,
        error
      );
    }
  }

  getStatement(sql: string) {
    const cached = this.statements.get(sql);
    if (cached) return cached;
    const statement = this.db.prepare(sql);
    this.statements.set(sql, statement);
    return statement;
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
    return new Promise((resolve, reject) => {
      this.eventEmitter.once(`task:start:${id}`, async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        } finally {
          this.eventEmitter.emit(`task:end:${id}`);
        }
      });
      this.tasks.push(id);
      this.eventEmitter.emit(`task:added`);
    });
  }

  private getUserVersionCommand(command: string) {
    return /^\s*pragma\s+user_version\s*=\s*(\d+)/i.exec(command);
  }

  private async runStatementsAtomically(commands: string[]) {
    if (!commands.length) return;

    await this.runTask(() => {
      const transaction = this.db.transaction(() => {
        for (const command of commands) {
          logger.debug(`Running command: ${command}`);
          this.db.prepare(command).run();
        }
      });
      transaction();
    });
  }

  async hasTable(tableName: string) {
    return this.runTask(() =>
      this.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(tableName)
    );
  }

  async ensureKnownSchemaRepairs() {
    const version = this.db.pragma('user_version', { simple: true }) as number;
    if (version < 14 || (await this.hasTable('area_info'))) return;

    logger.warn(
      `Repairing missing area_info table in ${this.db.name}; the database reports schema version ${version}`
    );
    await this.runStatementsAtomically([
      `CREATE TABLE IF NOT EXISTS area_info (
        id INTEGER NOT NULL,
        run_id INTEGER NOT NULL UNIQUE,
        name TEXT,
        level INTEGER,
        depth INTEGER,
        PRIMARY KEY ("id" AUTOINCREMENT)
      )`,
    ]);
  }

  async validateTables(requiredTables: string[]) {
    const missing: string[] = [];
    for (const tableName of requiredTables) {
      if (!(await this.hasTable(tableName))) missing.push(tableName);
    }

    if (missing.length) {
      throw new Error(
        `DB_SCHEMA_INVALID: ${this.db.name} is missing required tables: ${missing.join(', ')}`
      );
    }
  }

  async hasUserData() {
    const checks = [
      ['run', 'SELECT 1 FROM run LIMIT 1'],
      ['mapruns', "SELECT 1 FROM mapruns WHERE CAST(id AS TEXT) != '-1' LIMIT 1"],
      ['event', 'SELECT 1 FROM event LIMIT 1'],
      ['events', 'SELECT 1 FROM events LIMIT 1'],
      ['item', 'SELECT 1 FROM item LIMIT 1'],
      ['items', 'SELECT 1 FROM items LIMIT 1'],
      ['area_info', 'SELECT 1 FROM area_info LIMIT 1'],
      ['areainfo', 'SELECT 1 FROM areainfo LIMIT 1'],
      ['gear', 'SELECT 1 FROM gear LIMIT 1'],
      ['filter', 'SELECT 1 FROM filter LIMIT 1'],
      ['filters', 'SELECT 1 FROM filters LIMIT 1'],
      ['incubator', 'SELECT 1 FROM incubator LIMIT 1'],
      ['incubators', 'SELECT 1 FROM incubators LIMIT 1'],
      ['last_inventory', 'SELECT 1 FROM last_inventory LIMIT 1'],
      ['lastinv', 'SELECT 1 FROM lastinv LIMIT 1'],
      ['passives', 'SELECT 1 FROM passives LIMIT 1'],
      ['xp', 'SELECT 1 FROM xp LIMIT 1'],
      ['league', 'SELECT 1 FROM league LIMIT 1'],
      ['leagues', 'SELECT 1 FROM leagues LIMIT 1'],
      ['graftblood', 'SELECT 1 FROM graftblood LIMIT 1'],
      ['stashes', 'SELECT 1 FROM stashes LIMIT 1'],
      ['fullrates', 'SELECT 1 FROM fullrates LIMIT 1'],
    ] as const;

    for (const [tableName, query] of checks) {
      if (!(await this.hasTable(tableName))) continue;
      const row = await this.runTask(() => this.db.prepare(query).get());
      if (row) return true;
    }
    return false;
  }

  async resetEmptyDatabaseWithBackup() {
    if (!fs.existsSync(this.db.name) || (await this.hasUserData())) return false;

    const dbPath = this.db.name;
    const backupPath = `${dbPath}.incomplete-${Date.now()}.bak`;
    logger.warn(`Backing up incomplete empty database ${dbPath} to ${backupPath}`);
    this.db.close();
    fs.renameSync(dbPath, backupPath);
    this.statements.clear();
    this.db = new DatabaseConstructor(dbPath);
    this.loadRegexExtension();
    return true;
  }

  init: Function = async (sqlList: string[][], maintSqlList: string[] = []) => {
    logger.info(`Initializing DB: ${this.db.name}`);
    let version = 0;
    try {
      version = this.db.pragma('user_version', { simple: true }) as number;
    } catch (err) {
      logger.error('Error reading database version: ' + err);
      if (err && typeof err === 'object') {
        (err as { code?: string }).code = 'DB_VERSION_READ_FAILED';
      }
      throw err;
    }

    const migrationCommands: string[] = [];
    let targetVersion = version;
    for (const [index, sqlPatch] of sqlList.entries()) {
      if (version !== 0 && index <= version) continue;

      logger.debug(`Queueing initialization SQL for ${this.db.name} - version ${index}`);
      logger.debug(`SQL commands: ${JSON.stringify(sqlPatch)}`);
      for (const command of sqlPatch) {
        const versionMatch = this.getUserVersionCommand(command);
        if (versionMatch) {
          targetVersion = Math.max(targetVersion, Number(versionMatch[1]));
        } else {
          migrationCommands.push(command);
        }
      }
    }

    if (targetVersion > version) {
      migrationCommands.push(`pragma user_version = ${targetVersion}`);
    }

    await this.runStatementsAtomically(migrationCommands);
    await this.runStatementsAtomically(maintSqlList);

    logger.info(
      `Initialization complete for ${this.db.name} - ${migrationCommands.length} migration commands applied`
    );
    return null;
  };
}

// Map of all the DB Managers that have been instantiated, by path
const DBConnections = new Map<string, DBManager>();

const RequiredCharacterTables = [
  'run',
  'event',
  'mapmod',
  'area_info',
  'gear',
  'filter',
  'incubator',
  'item',
  'league',
  'last_inventory',
  'passives',
  'xp',
  'graftblood',
];

const RequiredLeagueTables = ['characters', 'fullrates', 'stashes'];

// External interface for DB
const DB = {
  getLeagueDbPath: (league: string) => {
    return path.join(getUserDataPath(), `${league}.leaguedb`);
  },

  getCharacterDbPath: (characterName?: string, league?: string, oldVersion?: true) => {
    const settings = getSettings();
    if (!characterName) characterName = settings?.activeProfile?.characterName;
    if (!league) league = settings?.activeProfile?.league;
    if (!characterName || !league) {
      return null;
    }
    if (oldVersion) {
      return path.join(getUserDataPath(), `${characterName}.db`);
    } else {
      return path.join(getUserDataPath(), `${characterName}.${league}.db`);
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

  getCharacterManager: (characterName?: string, league?: string) => {
    const dbPath = DB.getCharacterDbPath(characterName, league);
    if (!dbPath) return null;

    const oldPath = characterName
      ? DB.getCharacterDbPath(characterName, league, true)
      : null;
    if (oldPath && fs.existsSync(oldPath) && !fs.existsSync(dbPath)) {
      logger.info(`Found the old pattern in db name, copying ${oldPath} to ${dbPath}`);
      fs.copyFileSync(oldPath, dbPath);
    }

    const manager: DBManager = DBConnections.get(dbPath) || new DBManager({ dbPath });
    DBConnections.set(dbPath, manager);
    return manager;
  },

  all: async (sql: string, params: any[] = [], league: string | undefined = undefined) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    return await manager.runTask(() => manager.getStatement(sql).all(params));
  },

  get: async (sql: string, params: any[] = [], league: string | undefined = undefined) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    return manager.runTask(() => manager.getStatement(sql).get(params));
  },

  run: async (sql: string, params: any[] = [], league: string | undefined = undefined) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    return await manager.runTask(() => manager.getStatement(sql).run(params));
  },

  runMany: async (query: string, params: any[], league: string | undefined = undefined) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    return await manager.runTask(() => {
      const { db } = manager;
      const statement = manager.getStatement(query);
      const runMany = db.transaction((params) => {
        for (const param of params) {
          statement.run(param);
        }
      });
      return runMany(params);
    });
  },

  transaction: async (query: string, params: any[], league: string | undefined = undefined) => {
    return DB.runMany(query, params, league);
  },

  initDB: async (char: string, league?: string) => {
    const manager = DB.getCharacterManager(char, league);
    if (!manager) return null;

    const { init, maintenance } = Migrations.character;
    const initializeAndValidate = async () => {
      await manager.init(init, maintenance);
      await manager.ensureKnownSchemaRepairs();
      await manager.validateTables(RequiredCharacterTables);
    };
    try {
      await initializeAndValidate();
    } catch (error) {
      if ((error as { code?: string })?.code === 'DB_VERSION_READ_FAILED') throw error;
      const reset = await manager.resetEmptyDatabaseWithBackup();
      if (!reset) throw error;
      await initializeAndValidate();
    }
  },

  initLeagueDB: async (league: string, characterName: string) => {
    const manager = DB.getManager(league);
    if (!manager) return null;

    const { init, maintenance } = Migrations.league;
    await manager.init(init, maintenance);
    await manager.validateTables(RequiredLeagueTables);

    const activeProfile = SettingsManager.get('activeProfile');

    if (!characterName && activeProfile.characterName) {
      await manager.runTask(() =>
        manager.db
          .prepare('insert or ignore into characters values (?)')
          .run(activeProfile.characterName)
      );
    }
  },
};

export default DB;
