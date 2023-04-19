import DB from './index';

export default {
  getLastRuns: async (numberOfRunsToShow: number) => {
    // var numberOfShownMaps = $("#numberOfShownMaps").val() || 10;
    const lastRunsQuery = `
      select mapruns.id, name, level, depth, iiq, iir, packsize, firstevent, lastevent,
        (mapruns.xp - (select xp from mapruns m where m.id < mapruns.id and xp is not null order by m.id desc limit 1)) xpgained,
        (select count(1) from events where event_type='slain' and events.id between firstevent and lastevent) deaths,
        gained, kills, runinfo
      from areainfo, mapruns
      where areainfo.id = mapruns.id
        and json_extract(runinfo, '$.ignored') is null
      order by mapruns.id desc
      limit ${numberOfRunsToShow}
    `;

    const runData = await DB.all(lastRunsQuery);

    return runData;
  },
}