
/**
* This is the placers part  of YAMG library
* 
* author: Pyrophorus
* 
* alpha 3 : february 2018
* 
* Please note all this library requires the creation of a tiles map object using the special function:
* 
* var g_TOMap = createTileMap(wHeight,sLimit);
*
*/


//================== Painting and populating ====================
/* Unlike rmgen, the software operates on a unique array holding cell objects
 * An additional data structure (a heap) is set up as a tool for use of various filling functions.
 */
const yUNLOCKED = 0;
const yFORESTLOCK = 1;
const yDECOLOCK = 1 << 1;
const yROADLOCK = 1 << 2;
const yPATCHLOCK = 1 << 3;

const yLOCKALL = 0XFFFFFFFF;

const yMAXSLOPE = 2;

/**
 * This function extracts a points array from a zone (which is a cells array)
 * Mainly to help rmgen compatibility. Change this to Vector2D if desired, it's the only reference to PointXZ in the library 
 */
function zoneToPoints(zone)
{
	let points = [];
	for(let c of zone) {
		points.push(new PointXZ(c.x,c.y));
	}
	return points;
}

/**
 * This function extracts a zone (which is a cells array) from a point array
 * Mainly to help rmgen compatibility.
 */
function pointsToZone(points)
{
	let zone = [];
	for(let p of points) {
		zone.push(g_TOMap.gCells(p.x,p.z)); // change this to zone.push(g_TOMap.gCells(p.x,p.y)); if Vector2D is preferred.
	}
	return points;
}

/**
 * This is the cell (or tile) object constructor.
 * No need to create them directly. The next function does this automatically.
 * Thanks to Javascript, you can add members later if you need some.
 * 
 * @param x : the left edge coordinate
 * @param y : the upper edge coordinate
 * @param alt : cell altitude, i.e. mean value of corners altitudes
 * @param slope : maximal altitude difference within corners, this enable to detect cliffs.
 * @param terrain : base terrain of this cell.
 * @param lock : locks cell modifications
 * 
 * @ member key : the sorting key of the heap
 * @ member done : a boolean flag, set by insertion into the heap. Avoid storing the cell more than once.
 * @ members road, back, rType set and used by the roads building
 */

function Cell(x,y,alt,slope,terrain,lock) {
	this.x = x;
	this.y = y;
	this.alt = alt;
	this.slope = slope;
	this.terrain = terrain;
	this.road = undefined; // those two are references to other Cells, used in road building and more.
	this.back = undefined;
	this.rType = 0;
	this.lock = lock;
	this.key = 0;
	this.done = false;
}

/**
 * Create the TileObjectMap.
 * 
 * This object must be created with this function and not by the constructor below. The reason is the 'this' operator is ambiguous when adding
 * an iterator to the cell object. So iterators are added in a separate function.
 * 
 * @param wHeight: the water height
 * @param sLimit: the snow lower limit (if any)
 * @returns a TileObjectMap.
 */
function createTileMap(wHeight,sLimit=MAX_HEIGHT) {
	var g_TOMap = new TileObjectMap(wHeight,sLimit);
	setTilesNeighbors(g_TOMap);
	return g_TOMap;
}

/**
 * TileObjectMap constructor.
 * 
 * This object has the same purpose like tile classes and constraints in rmgen, but here, constraints and properties are recorded in a single Cell object.
 * Placers and constraints constructors are provided below to use it silently in a way compatible with rmgen, and one needs not to worry with it, except when
 * introducing new constraints. These constraints must be propagated to the TileObjectMap using the 'propagateConstraint' method.
 * 
 * @param wHeight: the water height
 * @returns a partially built TileObjectMap.
 */
function TileObjectMap(wHeight,sLimit) {

	this.gCells = [];
	let snowRand= Math.round(mapSize / 40);
	let rad2 = ( (mapSize - 3) * (mapSize - 3) / 4);
	
	for (let i = 0; i < mapSize; i++)
	{
		this.gCells[i] = [];
		let d1 = (i - (mapSize / 2))*(i - (mapSize / 2));
		for (let j = 0; j < mapSize; j++)
		{
			let a = (g_Map.height[i][j] + g_Map.height[i+1][j] + g_Map.height[i][j+1] + g_Map.height[i+1][j+1]) / 4;
			let s1 = Math.abs(g_Map.height[i+1][j+1] - g_Map.height[i][j]);
			let s2 = Math.abs(g_Map.height[i+1][j] - g_Map.height[i][j+1]);
			let s = (s1 > s2) ? s1 : s2;
			let d2 = (j - (mapSize / 2))*(j - (mapSize / 2));
			let lock = ( (d1 + d2) > rad2 ) && g_MapSettings.CircularMap ? yLOCKALL : 0;
			
			if( a < wHeight) {
				this.gCells[i][j] = new Cell(i,j,a,s,"water",lock);
			} else {
				if( s > 4) {
					this.gCells[i][j] = new Cell(i,j,a,s,"cliff",lock);
				} else {
					this.gCells[i][j] = new Cell(i,j,a,s,"wild",lock);
				}
			}
		}
	}
	this.heap = new Heap(mapSize * mapSize);
}

// creates an iterator returning all neighbor cells of this one
function setTilesNeighbors(tObjMap) {
	for (let i = 0; i < mapSize; i++)
	{
		for (let j = 0; j < mapSize; j++)
		{
			tObjMap.gCells[i][j][Symbol.iterator] = function* () {
				if(this.x > 0) {
					if(this.y > 0)
						yield tObjMap.gCells[this.x-1][this.y-1];
					yield tObjMap.gCells[this.x-1][this.y];
					if(this.y < (mapSize -1))
						yield tObjMap.gCells[this.x-1][this.y+1];
				}
				if(this.y > 0)
					yield tObjMap.gCells[this.x][this.y-1];
				if(this.y < (mapSize -1))
					yield tObjMap.gCells[this.x][this.y+1];
				if(this.x < (mapSize - 1)) {
					if(this.y > 0)
						yield tObjMap.gCells[this.x+1][this.y-1];
					yield tObjMap.gCells[this.x+1][this.y];
					if(this.y < (mapSize -1))
						yield tObjMap.gCells[this.x+1][this.y+1];
				}
			};
		}
	}
}


TileObjectMap.prototype.applyTerrainType = function(type,lock,zone) {
	for(let cell of zone) {
		cell.terrain = type;
		cell.lock = lock;
	}
}

TileObjectMap.prototype.getZoneAlt = function(altmin,altmax,type,mask = 0) {
	let zone = [];
	
	for (let x = 0; x < mapSize; x++) {
		for (let z = 0; z < mapSize; z++)
	    {
			let cell = this.gCells[x][z];
			if ((type != undefined) && (cell.terrain != type))
				continue;
			if(cell.lock & mask)
				continue;
			let alt = cell.alt;
			if( (alt >= altmin) && (alt < altmax))			
				zone.push(cell);
	    }
	 }
	return zone;
}

/**
 * Paint terrain according to 'terrain' member.
 * 
 */
TileObjectMap.prototype.paintMap = function() {
	for (var ix = 0; ix < mapSize; ix++) {
		for (var iz = 0; iz < mapSize; iz++)
		{
			switch(this.gCells[ix][iz].terrain) {
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
}

/**
 * Count the number of unlocked cells.
 * @returns the number
 */
TileObjectMap.prototype.countFreeCell = function(pLock) {
	let cnt = 0;
	for(let i = 0; i < mapSize; i++)
		for(let j = 0; j < mapSize; j++)
			if(!(this.gCells[i][j].lock & pLock))
				cnt++;
	return cnt;
}

/**
 * Clear the 'done' flag on all cells
 */
TileObjectMap.prototype.clearDoneFlag = function() {
	for(let i = 0; i < mapSize; i++)
		for(let j = 0; j < mapSize; j++)
			this.gCells[i][j].done = false;	
}

/**
 * Clear the 'done' flag and lock on all cells
 */
TileObjectMap.prototype.clearDoneAndLock = function(lock) {
	let mask = ~lock;
	for(let i = 0; i < mapSize; i++)
		for(let j = 0; j < mapSize; j++) {
			this.gCells[i][j].done = false;
			this.gCells[i][j].lock &= mask;
		}
}

/**
 * ========================== Roads building =============================
 */
const ySLOPEMAX = 1.3; ///< maximum of slope for a road
const R_NONE = 0; 	///< no road at this time
const R_ROAD = 1;   ///< a road uses this cell
const R_STOP = 2;   ///< this cell is an endpoint for the roads
const R_HIT = 3;    ///< this endpoint have been reached by a road
const hWater = waterHeight - 1;

function recalcTile(tile) {
	let i = tile.x;
	let j = tile.y;
	tile.alt = (g_Map.height[i][j] + g_Map.height[i+1][j] + g_Map.height[i][j+1] + g_Map.height[i+1][j+1]) / 4;
	let s1 = Math.abs(g_Map.height[i+1][j+1] - g_Map.height[i][j]);
	let s2 = Math.abs(g_Map.height[i+1][j] - g_Map.height[i][j+1]);
	tile.slope = (s1 > s2) ? s1 : s2;
}

function crossMountains(ti) {
	let r = ti.road;
	if(r == undefined)
		return;
	let prev = ti;
	r.back = prev;
	ti.lock = yLOCKALL;
	prev.lock = yLOCKALL;
	prev.back.terrain = "road";
	prev.terrain =  "road";
	ti.terrain = "road";
	let n = 1000;
	// large 388
	if(r.alt > prev.alt) {
		let sl = prev.alt + ySLOPEMAX;
		while((r != undefined) && (r.alt > sl) && (n-- > 0)) {
			r.terrain = "road";
			r.lock = yLOCKALL;
			g_Map.height[r.x][r.y] = sl;
			g_Map.height[r.x+1][r.y] = sl;
			g_Map.height[r.x][r.y+1] = sl;
			g_Map.height[r.x+1][r.y+1] = sl;
			recalcTile(r);
			sl += ySLOPEMAX;
			r.back = prev;
			prev = r;
			r = r.road;
		}
		if(r != undefined) {
			recalcTile(r);
			r.back = prev;
		}
	} else {
		r = ti;
		prev = ti.back;
		while((r != undefined) && (r.slope > ySLOPEMAX) && (n-- > 0)) {
			//warn("slope:"+r.slope);
			r.terrain = "road";
			r.lock = yLOCKALL;
			r.back = prev;
			prev = r;
			r = r.road;
		}
		if(r == undefined)
			r = prev;
			
		r.back = prev;
		let ro = r.back;
		let sl = r.alt + ySLOPEMAX;
		//warn("ro alt:"+ro.alt+" sl:"+sl);
		while((ro != undefined) && (ro.alt > sl) && (n-- > 0)) {
			//warn("ro alt:"+ro.alt+" sl:"+sl);
			g_Map.height[ro.x][ro.y] = sl;
			g_Map.height[ro.x+1][ro.y] = sl;
			g_Map.height[ro.x][ro.y+1] = sl;
			g_Map.height[ro.x+1][ro.y+1] = sl;
			recalcTile(ro);
			sl += ySLOPEMAX;
			ro = ro.back;
			if(ro == undefined)
				warn("ro.back is undefined");

		}
		r =ti;
	}
	return r;
}

/**
 * This is the main procedure to build roads
 * 
 *  // medium 4512,9474 large 388 
 *  
 *  @param: endpoints, an array of cells defining the endpoints of the road. Can be anything, including players bases of course.
 *  @param: mPenalty, positive number stating the cost of a step in mountains. High values avoid mountains crossing
 *  @param: wPenalty, positive number stating the cost of a step in water (fords).
 *  @param: noise, positive integer to make them more twisted, particularly on flat parts of the map. 
 */

TileObjectMap.prototype.buildRoads = function(endpoints,mPenalty = 30, wPenalty = 20, noise=3) {
	if(endpoints.length < 2)// obviously, we can't build roads with less than two points.
		return 0;
	
	for(let it of endpoints) {
		it.road = undefined;
		it.key = 0;
		it.lock |= yROADLOCK;
		it.rType = R_STOP;
		it.terrain = "road";
	}
	let nStop = endpoints.length;
	let net = 1;
	noise = Math.floor(noise);

    while(nStop-- > 0) {
        // search a root point in the 'endpoints' list
    	let it = undefined;
    	let i = 0;
    	for(i = 0; i < endpoints.length; i++) {
    		it = endpoints[i];
    		if(it.rType == R_STOP)
                break;
    	}

        if(i >= endpoints.length)
            break;

        //2- put the root point into the heap with key = 0
        this.clearDoneFlag(); // ???
        this.heap.clearHeap();
        this.heap.addCell(it);
        it.rType = R_HIT; // the root point is already hit.
        it.road = undefined;
        let cost = 0;

        while((nStop > 0) && (this.heap.getSize() > 0)) { // the stop condition is when all start/stop points have been reached, or the heap is empty (some roads are impossible).
        //3- get a leave from the heap
            it = this.heap.pickCell();
            if(it.lock == yLOCKALL)
            	continue;

   		 	for(let l of it) { // for each neighbours of it
   		 		if(l.road != undefined) // not already linked, i.e. visited
   		 			continue;
   		 		
                switch(l.rType) {

                    case R_NONE:
                    	if( (l.alt > hMiddle) || (l.alt < hWater) ) { // too high or too low cells are discarded
                    		l.done = true;
                            break;                    		
                    	}
                    	// computing the cost of this step
                    	cost = l.slope * 8; // flat  is prefered
                    	cost += ( (l.alt - it.alt) < 0 ? -(l.alt - it.alt) * 3 : (l.alt - it.alt) * 3 );
                    	if(l.alt > hMini) // mountains should be avoided when possible
                    		cost += mPenalty;
                    	if(l.alt < waterHeight + 0.5) // fords too...
                    		cost += wPenalty;
                    	if(l.terrain == "wild") // wild terrain has a penalty
                    		cost += 5;
                    	cost += randIntExclusive(0,noise); // some random if wanted

                        l.road = it;   // link to the previous cell
                        l.key = it.key + cost; // the full cost of this path
                        break;

                    case R_STOP:// target point is adjacent to it.
                        nStop--;
                                // no break on purpose !!!
                       
                    case R_ROAD: // we are on a road already existant, no need to go further
                        l.rType = R_HIT;
                        l.back = undefined;
                        let ro = it;
                        let rold = l;
                        while(ro != undefined) { // paint the road back using the link road.
                        	ro.back = rold; // we manage another link in the other direction, necessary only for mountains crossing
                        	if(ro.alt > waterHeight + 0.5) { // we don't paint the road under the water and on shore.
                        		ro.terrain = "road";
                        	}
                        	if(ro.slope > ySLOPEMAX) { // special when slope is too high, we must dig the terrain
                        		ro = crossMountains(ro);
                        		if(ro == undefined)
                        			continue;
                        	}
                        	if(ro.alt > waterHeight + 0.5) { // we don't paint the road under the water and on shore.
                        		ro.terrain = "road";
                        	}                    		
                            ro.rType = R_ROAD;
                            ro.lock = yLOCKALL;
                            rold = ro;
                            ro = ro.road;
                        }
                        break;

                    case R_HIT: // already hit points must be ignored, a shortest path already reached them

                    default:
                         l.done = true; // this will prevent heap addition
                         break;
                }
   		 		this.heap.addCell(l); // add the cell in the heap.
            }
        }
        //4- if the result is not satisfactory (nStop > 0), we restart from another root, not already hit. This means it's impossible to reach all endpoints from a single root.
        if(nStop > 0)
        	net++;
    }
    return net;
} // ------------ end build roads

/**
 * This algorithm searches the map to find suitable locations for players.
 * Need to be on a rather large piece of flat terrain, as far as possible from other players
 */
TileObjectMap.prototype.findPlayersBases = function() {

	let inc = Math.floor(mapSize / 8);
	let rad = (mapSize / 2) - inc;
	let cnt = 500 + (mapSize * 6);
	var patches = [];
	let centPos = mapSize / 2;
	
	// 1 ------ trying to find areas large enough around fixed points on the map.
	while(rad > 0) {
		for(let i = centPos -rad; i <= centPos + rad; i += inc)
			
			for(let j = centPos -rad; j <= centPos + rad; j +=inc) {
				 if( !this.gCells[i][j].done && (this.gCells[i][j].slope < yMAXSLOPE)) {
					 // YPatchPlacer(startx,startz,count,slopemin,slopemax,altmin,altmax,compact,slopeRatio,altRatio,noise,mask,lock) 6306, large 388 (mur)
					 let test = new YPatchPlacer(i,j,cnt,0,1.5,waterHeight + 2,32000,1.06,3,1,2,yPATCHLOCK,yPATCHLOCK);
					 test.find();
					 if (test.count <= 1) {
						 patches.push(test);
					 }
					 this.clearDoneFlag();
				}
	
			}
		rad -= Math.floor(mapSize / 8);
	}
	
	// 2 ------ select the best candidates
	
	// here we create a region holding all these areas for later use.
	var fields = [];
	for(let p of patches){
		fields = fields.concat(p.zone);
	}

	// try to eliminate bases too close from water or mountains
	const marge = 10;
	var nRem = patches.length - numPlayers;
	let i = 0;
	while((i < patches.length) && (nRem > 0)) {
		let fx = patches[i].barx;
		let fy = patches[i].bary;
		if(this.gCells[fx][fy].alt < waterHeight + 5) {
			patches.splice(i,1);
		} else {
			fx -= marge; // try to find if there are mountains (or map boundaries) around
			fy -= marge;
			if((fx < 0) || (fy < 0)) {
				patches.splice(i,1);
				continue;
			}
			if(((fx + 2 * marge) > mapSize ) || ( (fy + 2 * marge) > mapSize)) {
				patches.splice(i,1);
				continue;
			}
			let flag = true;
			for(let i = fx; i < fx + 2 * marge;i++)
				for(let j = fy; j < fy + 2 * marge; j++) {
					if ( (this.gCells[i][j].terrain == "wildm") || (this.gCells[i][j].terrain == "cliffm") ) {
						flag = false;
						break;
					}
				}
			if(flag)
				i++;
			else
				patches.splice(i,1);
		}	
	}

	// remove unnecessary bases if we have more than players (hopefully !)
	if((patches.length > numPlayers)) {
		nRem = patches.length - numPlayers;
		this.heap.clearHeap();
		for(let i = 0;i < patches.length; i++) {
			patches[i].count = 0;
			for(let j = i + 1; j < patches.length; j++) { // creates a sorted list of distances between bases
				let keyval = (patches[i].barx - patches[j].barx)*(patches[i].barx - patches[j].barx) + (patches[i].bary - patches[j].bary)*(patches[i].bary - patches[j].bary);
				this.heap.addCell({key:keyval,done:false,b1:i,b2:j});
			}
		}
		while((this.heap.getSize() > 0) && (nRem > 0) ) {
			let dist = this.heap.pickCell(); // get the bases pairs, the closer first
			if((patches[dist.b1].count == 0) && (patches[dist.b2].count == 0)) { // if both are still candidates
				let cent1 = (patches[dist.b1].barx - centPos) * (patches[dist.b1].barx - centPos) + (patches[dist.b1].bary - centPos) * (patches[dist.b1].bary - centPos);
				let cent2 = (patches[dist.b2].barx - centPos) * (patches[dist.b2].barx - centPos) + (patches[dist.b2].bary - centPos) * (patches[dist.b2].bary - centPos);
				if( cent1 > cent2) // mark for removing the one closest to the center of the map
					patches[dist.b2].count = 1;
				else
					patches[dist.b1].count = 1;
				nRem--;
			}
		}
		i = 0;
		while(i < patches.length) { // finally removes worst bases
			if(patches[i].count > 0) {
				patches.splice(i,1);
			} else
				i++;
		}
		
	}
	return [patches,fields];
}

TileObjectMap.prototype.putSameEntity = function(zone,count,retry,entity,mask) {
	while((count > 0) && (retry-- > 0)) {
		let p = randIntExclusive(0,zone.length);
		let cell = zone[p];
		if(!cell.done && !(cell.lock & mask)) {
			g_Map.addObject(new Entity(entity, 0, cell.x, cell.y, randFloat(0, 2*Math.PI)));
			cell.done = true;
			count--;
		}
	}
}

TileObjectMap.prototype.putRandEntities = function(zone,count,retry,entities,mask) {
	while((count > 0) && (retry-- > 0)) {
		let p = randIntExclusive(0,zone.length);
		let cell = zone[p];
		if((!cell.done) && !(cell.lock & mask)) {
			g_Map.addObject(new Entity(pickRandom(entities), 0, cell.x, cell.y, randFloat(0, 2*Math.PI)));
			cell.done = true;
			count--;
		}
	}
}

TileObjectMap.prototype.putRandFlock = function(zone,count,card,retry,entity,placer) {
	while((count > card) && (retry-- > 0)) {
		let p = randIntExclusive(0,zone.length);
		let cell = zone[p];
		if(!cell.done) {
			placer.replay(cell.x,cell.y,card);
			if(placer.card < (card / 2)) {
				continue;
			}
			for(let c of placer.zone) {
			 	let q = randIntExclusive(0, 3);
			 	if(q == 1) {
			 		g_Map.addObject(new Entity(entity, 0, c.x, c.y, randFloat(0, 2*Math.PI)));
			 		count--;
			 		
			 	}
			}
		}
	}
}

TileObjectMap.prototype.putLargeEntity = function(zone,count,retry,entity,mask) {
	while((count > 0) && (retry-- > 0)) {
		let p = randIntExclusive(0,zone.length);
		let cell = zone[p];
		for(let cl of cell) {
			if((cl.done) || (cl.lock & mask))
				cell.done = true;
		}
		if(!cell.done) {
			g_Map.addObject(new Entity(entity, 0, cell.x, cell.y, randFloat(0, 2*Math.PI)));
			cell.done = true;
			count--;
		}
	}
}

TileObjectMap.prototype.putLargeEntities = function(zone,count,retry,entities,mask) {
	while((count > 0) && (retry-- > 0)) {
		let p = randIntExclusive(0,zone.length);
		let cell = zone[p];
		for(let cl of cell) {
			if((cl.done) || (cl.lock & mask))
				cell.done = true;
		}
		if(!cell.done) {
			g_Map.addObject(new Entity(pickRandom(entities), 0, cell.x, cell.y, randFloat(0, 2*Math.PI)));
			cell.done = true;
			count--;
		}
	}
}

TileObjectMap.prototype.putForestChunks = function(zone,count,card,retry,trees,floor,placer) {
	while((count > card) && (retry-- > 0)) {
		let p = randIntExclusive(0,zone.length);
		let cell = zone[p];
		if(!cell.done) {
			placer.replay(cell.x,cell.y,card);
			if(placer.card < (card / 2)) {
				continue;
			}
			for(let c of placer.zone) {
				placeTerrain(c.x, c.y, floor);
			 	let q = randIntExclusive(0, 3);
			 	if(q == 1) {
			 		g_Map.addObject(new Entity(pickRandom(trees), 0, c.x, c.y, randFloat(0, 2*Math.PI)));
			 		count--;
			 		
			 	}
			}
		}
	}
}

/** ======================== placers objects ========================
This section provides placers and constraints objects using the TileObjectMap object.
*/

/**
 *  YPatchPlacer
 * 
 * The YPatchPlacer tries to find 'count' connected cells to 'startx,starty' cell, filtering them through a range of slope and height and avoiding locked cells.
 * The region selected grows around start like water pouring from there, using compact,slopeRatio,altRatio and noise to rule the process.
 * 
 * For each fetched cell, the value 'key' is computed:
 * (ancestor.key * compact) + (slope * slopeRatio) + (altRatio * Math.abs(height - start.height)) + randIntInclusive(0,noise)
 * Then the cell is inserted in a dynamically sorted array (heap) which provides first the cells with the key lower value.
 * If the cell is finally added to the region, its 'lock' member will be set accordindly.
 * 
 * compact : a float from 0 to 2 (higher values are useless). Rules how much the final region shape will be close to a square. In some way this rules the influence
 * of the distance of the cell to the start cell. Values around 1 prevent "fingers" to expand.
 * slopeRatio, altRatio : rule how cell slope and height difference from start will influence the expansion.
 * noise, a noise factor ruling mainly how noisy the border of the region will be.
 * 
 * This imply the YPatchPlacer is not very efficient on completely flat landscapes where height are the same and the cell slopes 0. One can use it anyway with a low
 * compact value and some noise and other parameters to 0.
 * 
 * Except the 'place' method which returns an array of points for rmgen compatibility, all others returns an array of 'Cell' objects.
 * Use the function zoneToPoints() to convert them to a points array if needed.
 * 
 * The placer is persistent which means you can access its members to get more informations, after execution or later.
 * count: holds 0 if the final region has the requested number of tiles, else the number of missing cells.
 * card: is the cardinal of the region.
 * zone: is a Cell array containing the region.
 * border: is a Cell array containing the border of the region.
 * barx,bary is the final center of the region.
 * 
 * - find(), place(), find the requested region. You shouldn't call it more than once, because it makes no sense. You'll get repeatdly the same region. Use replay instead.
 * - replay(startx,starty,count) is a convenience method to reuse the placer to get another region with the same tuning parameters.
 * 
 * - expand(count,addFlag) can add 'count' points to a previously computed region. The 'border' array is used as start points. If the addFlag is true,
 * the final 'zone' array will contain the whole region. If false, only the points added. You can call this more than once to get concentric regions, using
 * the same or different tuning parameters (set them directly in the placer before the call).
 * - expandZone(zone,count) adds 'points' to an existing zone (Cell array, use the conversion function to get it from a points array).
 * 
 * Important note:
 * For this placer to work as expected, and particularly the border feature, it is important to manage the 'done' flag in the cells correctly. Cells marked as 'done' are
 * NEVER visited again by this or other placers using the heap (roads and players base search as well).
 * The flag should be reset with g_TOMap.clearDoneFlag() each time you're finished with one region and it's expansions.
 * If you omit this, the successive regions will not overlap which can be desired, BUT the border will not be correct and the expand() method which rely on
 * it will expand only from some parts of the border. If you want both borders and not overlapping regions, you should use a 'mask' and a 'lock' set to yPATCHLOCK,
 * which is reserved for this use. To clear both this lock and the 'done' flag, you can call g_TOMap.clearDoneAndLock(yPATCHLOCK).
 * 
 * Of course, the braves searching for special effects can filter the 'border' region to control further expansion and try some other hacks. Have fun !
 * 
 */
function YPatchPlacer(startx,starty,count,slopemin,slopemax,altmin,altmax,compact,slopeRatio,altRatio,noise,mask,lock) {
	 this.sx = startx;
	 this.sy = starty;
	 this.barx = startx;
	 this.bary = starty;
	 this.card = 1;
	 this.count = count;
	 this.slopemin = slopemin;
	 this.slopemax = slopemax;
	 this.altmin = altmin;
	 this.altmax = altmax;
	 this.compact = compact;
	 this.slopeRatio = slopeRatio;
	 this.altRatio = altRatio;
	 this.noise = noise;
	 this.mask = mask;
	 this.lock = lock;
	 this.base = g_TOMap.gCells[startx][starty].alt;
	 this.border = [];
	 this.zone = undefined;
}

YPatchPlacer.prototype.place = function() {
	this.zone = undefined;
	return(zoneToPoints(this.find(true)));
}

YPatchPlacer.prototype.find = function(reset = true) {
	if (this.zone == undefined)
		this.zone = [];
	if(this.count > 0) {
		if(reset) {
			g_TOMap.heap.resetHeap();
			let it = g_TOMap.gCells[this.sx][this.sy];
			it.key = 0;
			g_TOMap.heap.addCell(it);
		}
		
		// using a heap to store neighbors allows to privilege expansion on close altitude cells. This gives a more realistic result than expanding equally in all directions.
		// we stop if no more neighbors are available or we've done enough.
		while((g_TOMap.heap.getSize() > 0) && (this.count-- > 0)) {
			 let it = g_TOMap.heap.pickCell();
			 if(it == undefined)
				 break;
			 this.zone.push(it);
			 this.barx += it.x; this.bary += it.y;
			 this.card++;
			 let cc = false;
			 for(let neigh of it) {
				 if((neigh.slope < this.slopemax) && (neigh.slope >= this.slopemin) && (neigh.alt < this.altmax) && (neigh.alt >= this.altmin) && !(this.mask & neigh.lock)) {
					 if(!neigh.done) {
						 neigh.key = (it.key * this.compact) + (neigh.slope * this.slopeRatio) + this.altRatio * Math.abs(neigh.alt - this.base) + randIntInclusive(0,this.noise);
					     neigh.lock |= this.lock;
						 g_TOMap.heap.addCell(neigh);
					 }
				 } else if(!neigh.done)
					 cc = true;
			 }
			 if(cc)
				 this.border.push(it);
		}
		this.barx = Math.round(this.barx / this.card); this.bary = Math.round(this.bary / this.card);
		
		while(g_TOMap.heap.getSize() > 0)
			this.border.push(g_TOMap.heap.pickCell());
		g_TOMap.heap.clearHeap();
	}
	return this.zone;
}

YPatchPlacer.prototype.replay = function(startx,starty,count) {
	this.sx = startx;
	this.sy = starty;
	this.card = 1;
	this.count = count;
	this.zone = undefined;
	this.border = [];
	return (this.find(true));
}

YPatchPlacer.prototype.expand = function(count,addFlag) { // experimental
	if(this.zone == undefined)
		return undefined;
	this.count = count;
	for(n in this.zone)
		n.done = true;
	if(!addFlag) {
		this.card = 1;
		this.zone = undefined;		
	}
	for(n of this.border)
		g_TOMap.heap.addCell(n);
	this.border = [];
	return (this.find(false));
}

YPatchPlacer.prototype.expandZone = function(zone,count) { // experimental
	let key = 0;
	g_TOMap.heap.resetHeap();
	for(let pt of zone) {
		let it = g_TOMap.gCells[pt.x][pt.z];
		it.done = true;
		it.key = key++;
		g_TOMap.heap.addCell(it);
	}
	this.zone = undefined;
	this.border = [];
	return (this.find(false));
}


function YPlacerFromTerrain(terrain) {
	 this.terrain = terrain;
}

YPlacerFromTerrain.prototype.place = function() {
	let points = [];
//	let mapSize = g_TOMap.mSize;
	
	for (let x = 0; x < mapSize; ++x) {
		for (let z = 0; z < mapSize; ++z)
	    {
			if (g_TOMap.gCells[x][z].terrain == this.terrain)
				points.push(g_TOMap.gCells[x][z]);
	    }
	 }
	return zoneToPoints(points);
}

function YPlacerFromheight(height) {
	 this.height = height;
}

YPlacerFromheight.prototype.place = function() {
	let points = [];
//	let mapSize = g_TOMap.mSize;
	
	for (let x = 0; x < mapSize; ++x) {
		for (let z = 0; z < mapSize; ++z)
	    {
			if (g_TOMap.gCells[x][z].alt < this.height)
				points.push(g_TOMap.gCells[x][z]);
	    }
	 }
	return zoneToPoints(points);
}


 // ---------------------- constraints ------------------
 function AvoidSlopeConstraint(slope)
 {
 	this.slope = slope;
 }

 AvoidSlopeConstraint.prototype.allows = function(x, z)
 {
 	return g_TOMap.gCells[x][z].slope <= this.slope;
 };

 function AvoidAltConstraint(height)
 {
 	this.height = height;
 }

 AvoidAltConstraint.prototype.allows = function(x, z)
 {
 	return g_TOMap.gCells[x][z].alt <= this.height;
 };

 function AvoidLockedConstraint(lock)
 {
 	this.lock = lock;
 }

 AvoidLockedConstraint.prototype.allows = function(x, z)
 {
 	return !(g_TOMap.gCells[x][z].lock & this.lock);
 }

// ===================== utilities ======================
function paintPointsArray(zone,terrain)
{
	for (let cell of zone)
	{
		placeTerrain(cell.x, cell.y, terrain);
	}
}

function paintPointsLocked(mask)
{
	for (let x = 0; x < mapSize; ++x) {
		for (let z = 0; z < mapSize; ++z)
	    {
			if(!g_TOMap.gCells[x][z].lock & mask)
				continue;
			g_TOMap.gCells[x][z].terrain = "marked";
	    }
	 }
}

 /**
  * An implementation of the classical heap container (dynamically sorted array).
  * One can insert here anything provided it has 'key' and 'done' members.
  * Mainly used to sort cells (from the cell map created above)
  * Please note that the HeightMap object embeds a Heap, so you should not need to use this constructor.
  * 
  * @param size : size of the container, use 'mapSize * mapSize' to avoid overflow problems
  * @returns a Heap pbject
  */
 function Heap(size) {
 	this.last = 1;
 	this.max = size;
 	this.table = new Array(size + 1); 

 	/**
 	    Add a cell to the heap
 	    Note this function sets the done flag of the cell. This not only prevents heap overflow, but helps in various cases: no cell can be inserted more than once.

 	*/
 	this.addCell = function(cell) {

 				if((this.last >= this.max) || (cell.done)) // overflow shield
 			        return;
 			
 				let i = this.last;
 				this.last++;
 			
 				while(i > 1)
 				{
 					let j = Math.floor(i / 2); // searching father of this element
 					if( this.table[j].key <= cell.key)
 						break; // insert is finished
 			
 					this.table[i]  = this.table[j];
 					i   =  j;
 				}
 				this.table[i] = cell;
 			    cell.done = true;
 			}

 	/**
 	    Pick (and extract) first cell from the heap

 	    <- the cell
 	*/
 	this.pickCell = function() {

 			  if( this.table == undefined || this.last == 1 )
 				  return undefined;

 		      let res = this.table[1];

 			  this.last--;
 		      let h = this.table[this.last];
 			  let i = 1;
 			  let j = 2;

 			  while( j < this.last ) {
 				  // select the correct son
 				  let k = j + 1;
 				  if( (k < this.last) && ( this.table[j].key > this.table[k].key) )
 					  j = k;
 				  if(h.key <= this.table[j].key) break;
 				  this.table[i] = this.table[j];
 				  i = j; j *= 2;
 			  }
 			  this.table[i] = h;
 			  return res;
 			}

 	/**
 	    Update all keys values
 	    (of course, this don't invalidate sort)
 	    -> the value to add to all keys
 	*/
 	this.updateKeys = function(val = 0) {

 			    for(let i = 1; i < this.last; i++)
 			    	this.table[i].key += val;
 			}

 	/**
 	    Returns the first cell key value
 	    <- key value
 	*/
 	this.testCell = function() {
 			    if(this.last > 1)
 			    	return this.table[1].key;
 			    else
 			        return -1;
 			}

 	/**
 	    Clear all members 'done' flag and reset the heap itself
 	*/
 	this.clearHeap = function() {
 			    for(let i = 1; i < this.last; i++)
 			        this.table[i].done = false;
 			    this.last = 1;
 			}

 	/**
 	    Reset the heap
 	*/
 	this.resetHeap = function() {
 			    this.last = 1;
 			}

 	/**
 	    Reads the content size
 	*/
 	this.getSize = function() {
 			    return (this.last - 1);
 			}
 }

