import React from 'react';
import './MainStats.css';
import { electronService } from '../../electron.service';
import { useLoaderData } from 'react-router';
import KillIcon from '../../assets/img/encountericons/kills.png';
import DeathIcon from '../../assets/img/encountericons/deaths.png';
import KillDeathIcon from '../../assets/img/encountericons/kd.png';
import MavenIcon from '../../assets/img/encountericons/maven.png';
import AbyssalDepthIcon from '../../assets/img/encountericons/abyss.png';
import VaalSideAreaIcon from '../../assets/img/encountericons/vaalsidearea.png';
import ShrinesIcon from '../../assets/img/encountericons/shrine.png';
import EnvoyEncounterIcon from '../../assets/img/encountericons/envoy.png';
import EnvoyWordsIcon from '../../assets/img/encountericons/words.png';
import BlightIcon from '../../assets/img/encountericons/blight.png';
import BlightedMapIcon from '../../assets/img/encountericons/blightedmap.png';
import UnrighteousIcon from '../../assets/img/encountericons/cassia.png';
import DeliriumMirrorIcon from '../../assets/img/encountericons/delirium.png';
import MetamorphIcon from '../../assets/img/encountericons/metamorph.png';
import LegionIcon from '../../assets/img/encountericons/legion.png';
import AlvaIcon from '../../assets/img/encountericons/alva.png';
import EinharIcon from '../../assets/img/encountericons/einhar.png';
import RedBeastIcon from '../../assets/img/redBeast.png';
import YellowBeastIcon from '../../assets/img/yellowBeast.png';
import WhiteBeastIcon from '../../assets/img/whiteBeast.png';
import NikoIcon from '../../assets/img/encountericons/niko.png';
import JunIcon from '../../assets/img/encountericons/jun.png';

import { Table, TableBody, TableCell, TableHead, TableRow} from '@mui/material';
const { logger } = electronService;


/* Stats we want:

- Value of drops
- Raw divine drops
- Monsters slain
- Deaths
- K/D Ratio

- Maven Crucibles
- Abyssal Depths entered
- Vaal side areas entered

- Envoy encountered
- Total words spoken ?
- Blight encounters
- Blighted Maps
- Unrighteous turned to ash ?

- Delirium Mirrors
- Metamorphs
- Metamorph specific organs

- Legion General encounters
- Each Legion General

- Lab trials completed

- Shrines activated

-----

Conquerors defeated

-----

Masters
- Encounters, Missions completed
- Beasts captured ?
- Incursions completed?
- Sulphie deposits?

Syndicate
- Mastermind 
- Each member
*/

const MainStats = ({ stats }) => {
	const whiteBeasts = stats.misc.masters.einhar.details.beasts - stats.misc.masters.einhar.details.yellowBeasts - stats.misc.masters.einhar.details.redBeasts;
	logger.info('Stats', stats);
	return (
		<div className="Stats">
			<h2 className="Stats__Header">Total Stats</h2>
			<div className="Stats__Container Stats--Two-Columns">
				<div className='Stats__Column Stats__Left-Column'>
					<div className='Stat'>
						<div className="Stat__Text">
							Value of drops <span className="Stat__Value">{stats.valueOfDrops}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Raw divine drops <span className="Stat__Value">{stats.rawDivineDrops}</span>
						</div>
					</div>
					<br />
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={KillIcon} alt="Kills Icon" className="Stat__Icon" />Monsters slain: <span className="Stat__Value">{stats.misc.kills.toLocaleString('en-US')}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={DeathIcon} alt="Deaths Icon" className="Stat__Icon" />Deaths: <span className="Stat__Value">{stats.misc.deaths}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={KillDeathIcon} alt="K/D Ratio Icon" className="Stat__Icon" />K/D Ratio: <span className="Stat__Value">{(stats.misc.kills / stats.misc.deaths).toLocaleString('en-US')}</span>
						</div>
					</div>
					<br />
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={MavenIcon} alt="Maven Icon" className="Stat__Icon" />Maven Crucibles: <span className="Stat__Value">{stats.misc.maven.crucible.started}</span> (<span className="Stat__Value">{stats.misc.maven.crucible.completed}</span> completed)	
						</div>
					</div>
					<br />
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={AbyssalDepthIcon} alt="Abyssal Depth Icon" className="Stat__Icon" />Abyssal Depths entered: <span className="Stat__Value">{stats.misc.abyssalDepths}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={VaalSideAreaIcon} alt="Vaal Side Area Icon" className="Stat__Icon" />Vaal side areas entered: <span className="Stat__Value">{stats.misc.vaalSideAreas}</span>
						</div>
					</div>
					<br />
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={ShrinesIcon} alt="Shrines Icon" className="Stat__Icon" />Shrines activated: <span className="Stat__Value">{stats.misc.shrines.total}</span>
						</div>
					</div>
					<div className="Stat__Table-Container">
						<Table className="Stat--List" size="small" padding="normal" sx={{width: 'auto'}} >
							<TableHead >
								<TableRow>
									<TableCell align="center" colSpan={3} sx={{ backgroundColor: 'rgba(155,155,155,0.1)', borderRadius: '5px'}} padding="none">
										Shrine Types
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{Object.keys(stats.misc.shrines.types).sort((a, b) => stats.misc.shrines.types[b] - stats.misc.shrines.types[a]).map((shrineType: string) => {
									const Icon = require(`../../assets/img/shrineicons/${shrineType.replace(' Shrine', '')}.png`);
									return (
										<TableRow className='Stat' key={shrineType}>
											<TableCell sx={{width: '1.5em'}} align="center">
												<img src={Icon} alt={`${shrineType} Icon`} className="Stat__Table__Icon" />
											</TableCell>
											<TableCell>
												{shrineType}
											</TableCell>
											<TableCell align='center'>
												<span className="Stat__Value">
													{stats.misc.shrines.types[shrineType]}
												</span>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				</div>
				<div className='Stats__Column Stats__Right-Column'>
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={EnvoyEncounterIcon} alt="Envoy Encounter Icon" className="Stat__Icon" />
							Envoy encountered: <span className="Stat__Value">{stats.misc.envoy.encounters}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={EnvoyWordsIcon} alt="Envoy Words Icon" className="Stat__Icon" />
							Total words spoken: <span className="Stat__Value">{stats.misc.envoy.words}</span>
						</div>
					</div>
					<br />
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={BlightIcon} alt="Blight Icon" className="Stat__Icon" />
							Blight encounters: <span className="Stat__Value">{stats.misc.blightEncounter}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={BlightedMapIcon} alt="Blighted Map Icon" className="Stat__Icon" />
							Blighted Maps: <span className="Stat__Value">{stats.misc.blightedMap}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={UnrighteousIcon} alt="Unrighteous Icon" className="Stat__Icon" />
							Unrighteous turned to ash: <span className="Stat__Value">{stats.misc.unrighteous}</span>
						</div>
					</div>
					<br />
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={DeliriumMirrorIcon} alt="Delirium Mirror Icon" className="Stat__Icon" />
							Delirium Mirrors: <span className="Stat__Value">{stats.misc.simulacrum.encounters}</span>
						</div>
					</div>
					<br />
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={MetamorphIcon} alt="Metamorph Icon" className="Stat__Icon" />
							Metamorphs Encountered: <span className="Stat__Value">{stats.misc.metamorph.encounters}</span>
						</div>
					</div>
					{Object.keys(stats.misc.metamorph.organs).map((organ: string) => {
						const Icon = require(`../../assets/img/metamorphicons/${organ.replace(' ', '')}.png`);
						return (
							<div className='Stat' key={organ}>
								<div className="Stat__Text">
									<img src={Icon} alt={`${organ} Icon`} className="Stat__Icon" />
									{organ} Harvested: <span className="Stat__Value">{stats.misc.metamorph.organs[organ]}</span>
								</div>
							</div>
						);
					})}
					<br />
					<div className='Stat'>
						<div className="Stat__Text">
							<img src={LegionIcon} alt="Legion Icon" className="Stat__Icon" />
							Legion General Encounters: <span className="Stat__Value">{stats.misc.legionGenerals.encounters}</span> (<span className="Stat__Value">{stats.misc.legionGenerals.kills}</span> killed)
						</div>
					</div>
					{Object.keys(stats.misc.legionGenerals.generals).map((general: string) => {
						const LegionGeneralIcon = require(`../../assets/img/legionicons/${general.replace(',', '').split(' ')[0].toLowerCase()}.png`);
						return (
							<div className='Stat' key={general}>
								<div className="Stat__Text">
									<img src={LegionGeneralIcon} alt={`${general} Icon`} className="Stat__Icon" />
									{general}: <span className="Stat__Value">{stats.misc.legionGenerals.generals[general].encounters}</span> (<span className="Stat__Value">{stats.misc.legionGenerals.generals[general].kills}</span> killed)
								</div>
							</div>);
					})}
				</div>
			</div>
			<h2 className="Stats__Header">Conquerors of the Atlas</h2>
			<div className='Stats__Container Stats--Two-Columns Stats--Conquerors'>
				{Object.keys(stats.misc.conquerors).map((conqueror: string) => {
					const conquerorPrefix = conqueror.replace(',', '').split(' ')[0].toLowerCase();
					const ConquerorIcon = require(`../../assets/img/encountericons/${conquerorPrefix}.png`);
					return (
						<div className='Stat' key={conqueror}>
							<div className={`Stat__Header Stat__Header--${conquerorPrefix}`}>
								<img src={ConquerorIcon} alt="Conqueror Icon" className="Stat__Header__Icon" />{conqueror}
							</div>
							<div className="Stat__Text">
								Citadel Battle: <span className="Stat__Value">{stats.misc.conquerors[conqueror].encounters}</span> (<span className="Stat__Value">{stats.misc.conquerors[conqueror].defeated}</span> defeated)
							</div>
						</div>
					)
				})}
			</div>
			<h2 className="Stats__Header">Masters</h2>
			<div className='Stats__Container Stats--One-Column Stats--Masters'>
				<div className='Stat__Section Stat__Section--One-Column'>
					<div className='Stat__Section-Header Stat__Header--alva'>
						<img src={AlvaIcon} alt="Conqueror Icon" className="Stat__Header__Icon" />Alva, Master Explorer
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Encounters: <span className="Stat__Value">{stats.misc.masters.alva.started}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Missions Completed: <span className="Stat__Value">{stats.misc.masters.alva.missionMaps}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Temple Runs: <span className="Stat__Value">{stats.misc.masters.alva.details.temples}</span> (<span className="Stat__Value">{Object.keys(stats.misc.masters.alva.details.tier3Rooms).length}</span> t3 rooms)
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Incursions Completed: <span className="Stat__Value">{stats.misc.masters.alva.details.incursions}</span>
						</div>
					</div>
				</div>
				<div className='Stat__Section Stat__Section--One-Column'>
					<div className='Stat__Section-Header Stat__Header--einhar'>
						<img src={EinharIcon} alt="Einhar Icon" className="Stat__Header__Icon" />{stats.misc.masters.einhar.fullName}
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Encounters: <span className="Stat__Value">{stats.misc.masters.einhar.started}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Missions completed: <span className="Stat__Value">{stats.misc.masters.einhar.missionMaps}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Captured Beasts: 
							<span className="Stat__Value">{stats.misc.masters.einhar.details.beasts}</span>
							<span className="Stat__Value--Beasts">
							(
								<img className="Stat__Beast-Icon" src={RedBeastIcon} alt="Red Beast Icon" />x {stats.misc.masters.einhar.details.redBeasts} |
								<img className="Stat__Beast-Icon" src={YellowBeastIcon} alt="Yellow Beast Icon" />x {stats.misc.masters.einhar.details.yellowBeasts} | 
								<img className="Stat__Beast-Icon" src={WhiteBeastIcon} alt="White Beast Icon" />x {whiteBeasts}
							)
							</span>
						</div>
					</div>
				</div>
				<div className='Stat__Section Stat__Section--One-Column'>
					<div className='Stat__Section-Header Stat__Header--niko'>
						<img src={NikoIcon} alt="Niko Icon" className="Stat__Header__Icon" />{stats.misc.masters.niko.fullName}
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Encounters: <span className="Stat__Value">{stats.misc.masters.niko.started}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Missions completed: <span className="Stat__Value">{stats.misc.masters.niko.missionMaps}</span>
						</div>
					</div>
					<div className='Stat'>
						<div className="Stat__Text">
							Sulphite Deposits Collected: <span className="Stat__Value">{stats.misc.masters.niko.details.sulphite}</span>
						</div>
					</div>
				</div>
				<div className='Stat__Section Stat__Section--Two-Columns'>
					<div className='Stat__Section-Header Stat__Header--jun'>
						<img src={JunIcon} alt="Jun Icon" className="Stat__Header__Icon" />{stats.misc.masters.jun.fullName}
					</div>
					<div className='Stat__Section__Column'>
						<div className='Stat'>
							<div className="Stat__Text">
								Encounters: <span className="Stat__Value">{stats.misc.masters.jun.started}</span>
							</div>
						</div>
						<div className='Stat'>
							<div className="Stat__Text">
								Missions completed: <span className="Stat__Value">{stats.misc.masters.jun.missionMaps}</span>
							</div>
						</div>
						<div className='Stat'>
							<div className="Stat__Text">
								Mastermind Lairs: <span className="Stat__Value">{stats.misc.mastermind.started}</span>(<span className="Stat__Value">{stats.misc.mastermind.completed}</span> defeated)
							</div>
						</div>
						<div className='Stat'>
							<div className="Stat__Text">
								Safehouses Visited: <span className="Stat__Value">{stats.misc.syndicate.safehouses}</span>
							</div>
						</div>
						<div className='Stat'>
							<div className="Stat__Text">
								Syndicate Member encountered: <span className="Stat__Value">{stats.misc.syndicate.encounters}</span>
							</div>
						</div>
					</div>
					<div className='Stat__Section__Column'>
						<Table size="small"  padding="none">
							<TableHead>
								<TableRow sx={{ backgroundColor: 'rgba(155,155,155,0.1)', borderRadius: '5px'}}>
									<TableCell>Syndicate Member</TableCell>
									<TableCell align="center">Encounters</TableCell>
									<TableCell align="center">Kills</TableCell>
									<TableCell align="center">Kills as Leader</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{
									Object.keys(stats.misc.syndicate.members).sort().map((name) => {
										const member = stats.misc.syndicate.members[name];
										return (
										<TableRow key={name}>
											<TableCell>{name}</TableCell>
											<TableCell align="center">{member.encounters}</TableCell>
											<TableCell align="center">{member.kills}</TableCell>
											<TableCell align="center">{member.safehouseLeaderKills}</TableCell>
										</TableRow>
										)
									})
								}
							</TableBody>
						</Table>
					</div>
				</div>
			</div>
		</div>
		);
	};
	
	export default MainStats;