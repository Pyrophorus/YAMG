/**
 *  Egyptian oasis
 *  
 *  alpha 0.2 - february 2018
 *  author: Pyrophorus
 *  
 */

RMS.LoadLibrary("rmgen");
RMS.LoadLibrary("heightmap");
RMS.LoadLibrary("yamg");

//========= terrains

const tWild = ["desert_sand_stones", "desert_sand_smooth", "desert_sand_smooth_b", "desert_lakebed_dry_b", "desert_lakebed_dry", "desert_dirt_rough", "desert_plants_b", "desert_grass_a_sand"];
const tWildm = ["desert_sand_scrub", "desert_sand_smooth", "desert_sand_smooth_b"];
const tField = ["desert_grass_a_sand", "desert_grass_a_sand", "desert_grass_a_stones", "desert_plants_b"];
const tCliff = ["desert_cliff_egypt_1", "desert_cliff_egypt_2", "desert_cliff_3_dirty","desert_cliff_base"];
const tInfl = ["tropic_plants_c", "tropic_plants_b", "tropic_plants", "tropic_grass_plants"];
const treeFloor = ["tropic_forestfloor_a","savanna_forestfloor_a"]; // the ground in the forest
const treeList = ["gaia/flora_tree_acacia", "gaia/flora_tree_tamarix", "gaia/flora_tree_carob", "gaia/flora_tree_date_palm", "gaia/flora_tree_aleppo_pine"];
const tWater = ["desert_sand_wet"];
const tBase = "desert_city_tile_plaza";
const tRoad = "desert_city_tile";

const oPine = "gaia/flora_tree_cretan_date_palm_short";
const oBerryBush = "gaia/flora_tree_olive";
const aGrassShort = "actor|props/flora/grass_soft_large.xml";

const oStoneLarge = "gaia/geology_stonemine_desert_quarry";
const oBadGeol = ["gaia/geology_stonemine_desert_badlands_quarry","gaia/geology_metal_desert_badlands_slabs"];
const oStoneSmall = "gaia/geology_stone_tropic_a";
const oMetalLarge = "gaia/geology_metal_desert_slabs";
const oAnimals = ["gaia/fauna_camel","gaia/fauna_elephant_north_african"];
const gateList = ["gaia/flora_bush_badlands","gaia/flora_bush_badlands","gaia/flora_tree_poplar_lombardy","gaia/flora_tree_senegal_date_palm"];

//=========== standard map initialization ============
InitMap();

var numPlayers = getNumPlayers();
var mapSize = getMapSize();

/**
 * This loop is needed because some maps may be unplayble because
 * 	- we can't find the requested players number bases
 * 	- some parts are unreachable from elsewhere
 * 
 * Since it's very unlikely to happen, the noMore limit should never be reached.
 */

var noMore = 5;
do {
// =========== Create a new height map ============

var hMap = new HeightArray(mapSize);

let res = hMap.newMap(370,50,10,5,0);
var waterHeight = res[0];
var snowLimit = res[1];
var hMaxi = res[2];
var hMini = res[3];
var hMiddle = res[4];
var monts = res[5];
globalSmoothHeightmap(1);  // optional but advisable: it removes some artifacts and smooth unrealistic edges.
hMap = null; // cleaning the unnecessary object

setWaterHeight(waterHeight - MIN_HEIGHT);

//----------- end morphing section -----------
var g_TOMap = createTileMap(waterHeight + 0.5,snowLimit); // creates the cells map object.

//=============== filling section ==============

// we have now two regions: the 'monts' holding the mountaneous part of the map
for(let i = 0; i < monts.length; i++) {
	if(g_TOMap.gCells[monts[i].x][monts[i].z].slope > 4) {
		g_TOMap.gCells[monts[i].x][monts[i].z].terrain = "cliffm";
		g_TOMap.gCells[monts[i].x][monts[i].z].lock = yLOCKALL; // we lock this to avoid putting anything on the cliffs.
	}  else {
		g_TOMap.gCells[monts[i].x][monts[i].z].terrain = "wildm";
		g_TOMap.gCells[monts[i].x][monts[i].z].lock = 0;
	}
}

let res2 = g_TOMap.findPlayersBases();
var patches = res2[0];
var fields = res2[1];

// the wild part of the map
var zone = g_TOMap.getZoneAlt(waterHeight+1,32000,"wild",0);
g_TOMap.applyTerrainType("wild",yFORESTLOCK,zone);

// and the fields, holding more or less 70% of flat terrain (water excluded)
g_TOMap.applyTerrainType("field",0,fields);
// players bases and influence area are marked as "infl". Except players default starting resources and unit, nothing will be  placed here
for(let p of patches) {
	g_TOMap.applyTerrainType("infl",yFORESTLOCK,p.zone);
}

g_TOMap.clearDoneFlag();

// ========= now roads...
var endpoints = [];

// this sets the endpoints of roads to the players bases only, but it's possible to add some more at will.
for(let p of patches) {
	endpoints.push(g_TOMap.gCells[p.barx][p.bary]);
}

var nets = g_TOMap.buildRoads(endpoints,waterHeight - 1, hMini, hMiddle);

// ========= end retry loop.
} while((--noMore > 0) && (patches.length < numPlayers) && (nets > 1));


/**
 * Paint terrain according to 'terrain' member.
 * 
 */
for (let ix = 0; ix < mapSize; ix++) {
	for (let iz = 0; iz < mapSize; iz++)
	{
		switch(g_TOMap.gCells[ix][iz].terrain) {
			case 'wild':
				placeTerrain(ix, iz, tWild);
				break;
			case 'wildm':
				placeTerrain(ix, iz, tWildm);
				break;
			case 'cliff':
			case 'cliffm':
				placeTerrain(ix, iz, tCliff);
				break;
			case 'field':
				placeTerrain(ix, iz, tField);
				break;
			case 'water':
				placeTerrain(ix, iz, tWater);
				break;
			case 'infl':
				placeTerrain(ix, iz, tInfl);
				break;
			case 'road':
				placeTerrain(ix, iz, tRoad);
				break;
			case 'road2':
				placeTerrain(ix, iz, tRoad2);
				break;
			default:
				placeTerrain(ix, iz, "cave_walls");
				break;
		}
	}
}	

setWaterType("lake");


// ============================= objects ==========================
g_TOMap.clearDoneFlag();


// ==================== setting players bases ====================
//randomize player order
var playerIDs = [];
for (var i = 0; i < numPlayers; i++)
{
	playerIDs.push(i+1);
}
playerIDs = sortPlayers(playerIDs);
var radius = scaleByMapSize(15,25);
var clBaseResource = createTileClass();

for(let i = 0; i < mapSize; i++) {
	for(let j = 0; j < mapSize; j++) {
		if(g_TOMap.gCells[i][j].lock & yROADLOCK)
			addToClass(i, j, clBaseResource);
	}
}

for (var i = 0; i < numPlayers; i++)
{
	var id = playerIDs[i];
	log("Creating base for player " + id + "...");
	let fx = patches[i].barx;
	let fz = patches[i].bary;
	
	let placer = new YPatchPlacer(fx,fz,280,0,1.5,waterHeight + 2,32000,1.1,1,0,10,0,0);
	paintPointsArray(placer.find(),tBase);
	// create starting units
	placeCivDefaultEntities(fx, fz, id);
	
	let av = new AvoidTileClassConstraint(clBaseResource,2);

	placeDefaultChicken(fx, fz, clBaseResource,av);

	// create berry bushes
	var bbAngle = randFloat(0, TWO_PI);
	var bbDist = 12;
	var bbX = round(fx + bbDist * cos(bbAngle));
	var bbZ = round(fz + bbDist * sin(bbAngle));
	var group = new SimpleGroup(
		[new SimpleObject(oBerryBush, 5,5, 0,3)],
		true, clBaseResource, bbX, bbZ
	);
	createObjectGroup(group, 0,av);

	// create metal mine
	var mAngle = bbAngle;
	while(abs(mAngle - bbAngle) < PI/3)
	{
		mAngle = randFloat(0, TWO_PI);
	}
	var mDist = 13;
	var mX = round(fx + mDist * cos(mAngle));
	var mZ = round(fz + mDist * sin(mAngle));
	group = new SimpleGroup(
		[new SimpleObject(oMetalLarge, 1,1, 0,0)],
		true, clBaseResource, mX, mZ
	);
	createObjectGroup(group, 0,av);

	// create stone mines
	mAngle += randFloat(PI/8, PI/4);
	mX = round(fx + mDist * cos(mAngle));
	mZ = round(fz + mDist * sin(mAngle));
	group = new SimpleGroup(
		[new SimpleObject(oStoneLarge, 1,1, 0,2)],
		true, clBaseResource, mX, mZ
	);
	createObjectGroup(group, 0,av);
	
	var hillSize = PI * radius * radius;
	// create starting trees
	var num = floor(hillSize / 100);
	var tAngle = randFloat(-PI/3, 4*PI/3);
	var tDist = randFloat(11, 13);
	var tX = round(fx + tDist * cos(tAngle));
	var tZ = round(fz + tDist * sin(tAngle));
	group = new SimpleGroup(
		[new SimpleObject(oPine, num, num, 0,5)],
		false, clBaseResource, tX, tZ
	);
	createObjectGroup(group, 0, avoidClasses(clBaseResource,2));

	placeDefaultDecoratives(fx, fz, aGrassShort, clBaseResource, radius,av);

}


// ------------- Palms and bushes around the influence zone
for(let p of patches){
	for(let cell of p.border){
		if(!cell.done && (cell.terrain != "road") && (randIntExclusive(0,4) > 0)) {
			g_Map.addObject(new Entity(pickRandom(gateList), 0, cell.x, cell.y, 0));
			cell.done = true;
		}
	}
}

// ------------ crocodiles and palms on the shore
zone = g_TOMap.getZoneAlt(waterHeight,waterHeight + 0.8,undefined,yLOCKALL);
if(zone.length > 0)
	g_TOMap.putSameEntity(zone,Math.floor(mapSize / 10),200,"gaia/flora_tree_date_palm",0);

zone = g_TOMap.getZoneAlt(waterHeight-0.5,waterHeight + 0.2,undefined,yLOCKALL);
if(zone.length > 0)
	g_TOMap.putSameEntity(zone,Math.floor(mapSize / 20),200,"gaia/fauna_crocodile",0);


//------------ fill the fields region
zone = g_TOMap.getZoneAlt(waterHeight+1,32000,"field",yLOCKALL); //yFORESTLOCK yROADLOCK

if(zone.length > 0) {
	// ------------ forests
	let placer = new YPatchPlacer(0,0,0,0,5,waterHeight + 1,32000,0.8,5,2,10,yFORESTLOCK,yFORESTLOCK);
	g_TOMap.putForestChunks(zone,mapSize * 10,Math.floor(mapSize * 10 / 12),200,treeList,treeFloor,placer)
	
	g_TOMap.putLargeEntity(zone,numPlayers,200,oStoneLarge,yLOCKALL); // stone mine
	g_TOMap.putLargeEntity(zone,numPlayers,200,oMetalLarge,yLOCKALL); // metal mine

// ------------ elephants
	g_TOMap.putSameEntity(zone,Math.floor(mapSize / 20),200,"gaia/fauna_elephant_north_african",0);

//------------ camels flocks
	placer = new YPatchPlacer(0,0,0,0,5,waterHeight + 1,hMiddle,0.8,5,2,2,0,yFORESTLOCK);
	g_TOMap.putRandFlock(zone,mapSize / 10,8,200,"gaia/fauna_camel",placer);
}

// ------ in the wilderness
zone = g_TOMap.getZoneAlt(waterHeight + 1,hMiddle,"wild",yROADLOCK);
if(zone.length > 0) {
	//------------ gazelles flocks on wild
	let placer = new YPatchPlacer(0,0,0,0,5,waterHeight + 1,hMiddle,0.8,5,2,2,0,yFORESTLOCK);
	g_TOMap.putRandFlock(zone,mapSize / 10,8,200,"gaia/fauna_gazelle",placer);
	
	g_TOMap.putLargeEntity(zone,numPlayers,200,oStoneLarge,yROADLOCK); // stone mine
	g_TOMap.putLargeEntity(zone,numPlayers,200,oMetalLarge,yROADLOCK); // metal mine
}

//------ in the wild mountains
zone = g_TOMap.getZoneAlt(hMini,hMiddle,"wildm");
if(zone.length > 0) {
// ------------ bushes on mountains
	let placer = new YPatchPlacer(0,0,0,0,5,waterHeight + 1,hMiddle,0.8,5,2,2,0,yFORESTLOCK);
	g_TOMap.putRandFlock(zone,mapSize * 2,mapSize / 4,200,"gaia/flora_bush_badlands",placer);

	g_TOMap.putLargeEntities(zone,Math.floor(mapSize / 40),200,oBadGeol,yLOCKALL); // stone mine
}

// Export map data at last.
ExportMap();
