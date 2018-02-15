/**
* This is the fractal part  of YAMG library
* 
* author: Pyrophorus
* 
* alpha 3 : february 2018
*
*/

const UNDEFALT = -32000;
const yHISTOSIZE = 10000;

/**
 * The fractal painter is a compatible rmgen painter and can be created an used without special initialization.
 * It modifies a region of the map according to parameters. It can be used to create mountains but to soften the terrain too.
 * 
 * @param area : the area to be modified (a PointXZ array)
 * @param centerHeight : the desired height of the center of the region
 * @param bump : defines the range of height the painter will produce
 * @param rough : defines how chaotic the terrain will be.
 * @param progress : defines how chaotic the region will be.
 * @returns : a fractal painter object
 */
function FractalPainter(area,centerHeight,bump,rough,progress) {
	this.region = area;
	this.centerHeight = centerHeight;
	this.bump = bump;
	this.rough = rough;
	this.progress = progress;
	this.tMap = [];
	this.mSize = 64;
}

/**
 * The legacy method of the painter.
 *
 * @param nochiasm : this boolean states if chiasms will be generated (i.e. part of the region lower than their initial value).
 * @param type : special terrain will be generated, for instance mesas

 */
FractalPainter.prototype.paint = function(nochiasm = true, type = "none") {
	
	// 1- find the bounding box of the area
	let xmin = 64000; let ymin = 64000; let xmax = 0; let ymax = 0;
	let length = this.region.length;

	for (let i=0; i < length; i++)
	{
		let pt = this.region[i];
		if(pt.x > xmax)
			xmax = pt.x;
		if(pt.z > ymax)
			ymax = pt.z;
		if(pt.x < xmin)
			xmin = pt.x;
		if(pt.z < ymin)
			ymin = pt.z;
		
	}

	// 2 - create the temporary map
	let edge_x = (xmax - xmin);
	let edge_y = (ymax - ymin);

	let edge = ( edge_x >  edge_y) ? edge_x : edge_y;
	while(this.mSize < edge)
		this.mSize *= 2;
	
	let depx = Math.round((this.mSize - edge_x) / 2);
	let depy = Math.round((this.mSize - edge_y) / 2);
	
	depx = xmin - depx;
	depy = ymin - depy;
	
	// 3 - copy g_Map into temporary map
	this.mSize++;
	for (let i = 0; i < this.mSize; i++)
	{
		this.tMap[i] = new Float32Array(this.mSize);
		let xg = i + depx; 
		for (let j = 0; j < this.mSize; j++)
		{
			let yg = j + depy;
			if( (xg >= 0) && (yg >= 0) && (xg < mapSize) && (yg < mapSize))
				this.tMap[i][j] = g_Map.height[xg][yg];
			else
				this.tMap[i][j] = UNDEFALT;
		}
	}
	this.mSize--;
	
	
	// 4 - erase the area in the temporary map
	for (let i=0; i < length; i++)
	{
		let pt = this.region[i];
		let xg = pt.x - depx;
		let yg = pt.z - depy;
		this.tMap[xg][yg] = UNDEFALT;
	}
	
	// 5 - set the corner points height if unknown
	this.tMap[this.mSize/2][this.mSize/2] = this.centerHeight;
	
	if(this.tMap[0][0] == UNDEFALT)
		this.tMap[0][0] = this.centerHeight;
	if(this.tMap[this.mSize][0] == UNDEFALT)
		this.tMap[this.mSize][0] = this.centerHeight;
	if(this.tMap[0][this.mSize] == UNDEFALT)
		this.tMap[0][this.mSize] = this.centerHeight;
	if(this.tMap[this.mSize][this.mSize] == UNDEFALT)
		this.tMap[this.mSize][this.mSize] = this.centerHeight;

	this.createAltitudes(0, this.mSize, 0, this.mSize, this.bump, this.rough, this.progress);
	
	// 6 - back to the g_Map
	for (let i=0; i < length; i++)
	{
		let pt = this.region[i];
		let xg = pt.x - depx;
		let yg = pt.z - depy;
		if(nochiasm && (g_Map.height[pt.x][pt.z] > this.tMap[xg][yg]))
			continue;
		g_Map.height[pt.x][pt.z] = this.tMap[xg][yg];
	}
	
}

/**
 * Reset the painter for new use with same parameters.
 */
FractalPainter.prototype.reset = function() {
	this.tMap = [];
	this.mSize = 64;
}

/**
 * The fractal painter workhorse.
 * This function MUST be called through the paint method ONLY. Use the fractal map object below if you want to use it directly.
 */
FractalPainter.prototype.createAltitudes = function(x, xm, y, ym, noise, tRough, tProgress) {
	
	let px = (xm - x)/2;
	let off = px *  noise * tRough * 2 / this.mSize;

	let o2 = off / 2;
	let h = 0.1;
	
	if(this.tMap[x+px][y] <= UNDEFALT) {
		h = this.tMap[x][y] + (this.tMap[xm][y] -  this.tMap[x][y]) / 2  + (Math.random() * off) - o2;
		this.tMap[x+px][y] = (h <= 0 ? 0.1:h);
	}

	if(this.tMap[x][y+px] <= UNDEFALT) {
		h = this.tMap[x][ym] + (this.tMap[x][y] -  this.tMap[x][ym]) / 2  + (Math.random() * off) - o2;
		this.tMap[x][y+px] = (h <= 0 ? 0.1:h);
	}

	if(this.tMap[xm][y+px] <= UNDEFALT) {
		h = this.tMap[xm][y] + (this.tMap[xm][ym] -  this.tMap[xm][y]) / 2  + (Math.random() * off) - o2;
		this.tMap[xm][y+px] = (h <= 0 ? 0.1:h);
	}

	if(this.tMap[x+px][ym] <= UNDEFALT) {
		h = this.tMap[xm][ym] + (this.tMap[x][ym] -  this.tMap[xm][ym]) / 2  + (Math.random() * off) - o2;
		this.tMap[x+px][ym] = (h <= 0 ? 0.1:h);
	}

	if(this.tMap[x+px][y+px] <= UNDEFALT) {
		h = this.tMap[x][ym] + (this.tMap[xm][y] -  this.tMap[x][ym]) / 2  + (Math.random() * off) - o2;
		this.tMap[x+px][y+px] = (h <= 0 ? 0.1:h);
	}

	if(px < tProgress)
		noise = noise * tRough;
    if(px > 1) {
        this.createAltitudes(x,x+px,y,y+px,noise, tRough, tProgress);
        this.createAltitudes(x+px,xm,y,y+px,noise, tRough, tProgress);
        this.createAltitudes(x,x+px,y+px,ym,noise, tRough, tProgress);
        this.createAltitudes(x+px,xm,y+px,ym,noise, tRough, tProgress);
    }
    return;
}

/**
 * Fractal whole map creation
 * 
 * Here we create a temporary height array to use the morphing function.
 * We can't work directly on g_Map.height because most often, it's size is not a power of two.
 * 
 * Object HeightArray methods:
 * 	- createAltitudes, the morphing function may be called more than once on various regions with different parameters.
 *  - fullMap, a standard map creation with peaks and chiasms.
 *  - newMap, a standard map creation without chiasms (creates only mountains)
 *  - finishMorphing, crops the height map array to g_Map when done.
 */

function HeightArray(dim) {
	this.mSize = 64;
	while(this.mSize < dim)
		this.mSize *= 2;
	
	// large enough to fit the specified map size given by Atlas
	
	this.mSize++;
	
	this.tMap = [];
	
	for (let i = 0; i < this.mSize; i++)
	{
		this.tMap[i] = new Float32Array(this.mSize);
		for (let j = 0; j < this.mSize; j++)
		{
			this.tMap[i][j] = UNDEFALT;
		}
	}
	this.histo = new Int32Array(yHISTOSIZE);

	this.mSize--;
}

/**
 *  Here come the main recursive function which does all the morphing job.
 *  It works on squares whose corners height is already set.
 *  It splits each edge in two, adding a new point in the middle whose height is the mean of edge ends, plus a random noise factor (positive or negative). 
 *  Next, it calls itself on the four resulting squares, until the edge length is 1 (that's why it must work on squares whose edges length are a power of two.
 *  
 *  Of course, the noise factor must be adjusted to the square size. Typically, it should be halved as edges size is halved on each step. To give more control on
 *  maps, there are two parameters which rule the noise factor:
 *  	- tRough: the noise factor is multiplied by this number. 0.5 is the standard value (i.e. the noise is halved on each step). Lower values will give less noise
 *  on small squares and will give smoother details. On the contrary, higher values will give more chaotic terrain, even if the map is rather flat.
 *  	- tProgress: the noise factor attenuation begins when squares edges is under this value.
 */
HeightArray.prototype.createAltitudes = function(x, xm, y, ym, noise, tRough, tProgress) {
	
	let px = (xm - x)/2;
	let off = px *  noise * tRough * 2 / this.mSize;
	let o2 = off / 2;
	let h = 0.1;
	
	if(this.tMap[x+px][y] <= UNDEFALT) {
		h = this.tMap[x][y] + (this.tMap[xm][y] -  this.tMap[x][y]) / 2  + (Math.random() * off) - o2;
		this.tMap[x+px][y] = (h <= 0 ? 0.1:h);
	}

	if(this.tMap[x][y+px] <= UNDEFALT) {
		h = this.tMap[x][ym] + (this.tMap[x][y] -  this.tMap[x][ym]) / 2  + (Math.random() * off) - o2;
		this.tMap[x][y+px] = (h <= 0 ? 0.1:h);
	}

	if(this.tMap[xm][y+px] <= UNDEFALT) {
		h = this.tMap[xm][y] + (this.tMap[xm][ym] -  this.tMap[xm][y]) / 2  + (Math.random() * off) - o2;
		this.tMap[xm][y+px] = (h <= 0 ? 0.1:h);
	}

	if(this.tMap[x+px][ym] <= UNDEFALT) {
		h = this.tMap[xm][ym] + (this.tMap[x][ym] -  this.tMap[xm][ym]) / 2  + (Math.random() * off) - o2;
		this.tMap[x+px][ym] = (h <= 0 ? 0.1:h);
	}

	if(this.tMap[x+px][y+px] <= UNDEFALT) {
		h = this.tMap[x][ym] + (this.tMap[xm][y] -  this.tMap[x][ym]) / 2  + (Math.random() * off) - o2;
		this.tMap[x+px][y+px] = (h <= 0 ? 0.1:h);
	}

	if(px < tProgress)
		noise = noise * tRough;
    if(px > 1) {
        this.createAltitudes(x,x+px,y,y+px,noise, tRough, tProgress);
        this.createAltitudes(x+px,xm,y,y+px,noise, tRough, tProgress);
        this.createAltitudes(x,x+px,y+px,ym,noise, tRough, tProgress);
        this.createAltitudes(x+px,xm,y+px,ym,noise, tRough, tProgress);
    }
    return;
}

/**
 * This method creates a full map with peaks and chiasms.
 * It gives not full map control, but can be used as a template.
 * 
 *  @param tRough: rules the ground irregularity, from 0.1 (smooth) to 1 (very chaotic and probably not playable)
 *  @param baselevel: height of the main floor of the map.
 *  @param seaRatio: percent of sea (lake) tiles on the map
 *  @param mountRatio: percent of rough peaks or chiasms tiles on the map
 *  @param snowRatio: percent of snowy tiles on the map
 *  @param baseRatio: percent of floor cells on the map.
 *  
 *  @returns [waterHeight,snowLimit] respectively heights of water upper and snow lower limits.
 * 
 */

HeightArray.prototype.fullMap = function (tRough,tBump,baselevel,seaRatio,mountRatio,snowRatio,baseRatio) {

	//Here are defined the big picture of the map.
	let tProgress = 32; // fractal attenuation range, try it from 2 to mapSize (powers of two). See algorithm for details.
	let tRelief = (MAX_HEIGHT * mapSize) / tBump; //  200 < 400 < 800 This one rules more or less the highest peaks in the map. MAX_HEIGHT * 2 is a maximum.
	//warn("tRelief:" + tRelief);
	
	let s00 = randIntExclusive(baselevel / 4,tRelief / 5); // saving original corners of the map to keep the big picture
	let s10 = randIntExclusive(baselevel / 4,tRelief / 5); // these can be set to a fixed value when full control is wanted (max MAX_HEIGHT/2 )
	let s01 = randIntExclusive(baselevel / 4,tRelief / 5); // for instance setting a corner ot a higher value than others to force mountains there.
	let s11 = randIntExclusive(baselevel / 4,tRelief / 5);
	let s22 = randIntExclusive(baselevel / 4,tRelief / 5); // height of the center
	
	this.tMap[0][0] = s00;
	this.tMap[this.mSize][0] =  s10;
	this.tMap[0][this.mSize] =  s01;
	this.tMap[this.mSize][this.mSize] =  s11;
	this.tMap[this.mSize/2][this.mSize/2] =  s22;
	
	this.createAltitudes(0, this.mSize, 0, this.mSize,tRelief,tRough,tProgress); // this creates the basic map
	
	baseRatio = seaRatio + mountRatio + baseRatio; // normalization: seaRatio + mountRatio + baseRatio should be 100 but...
	seaRatio /= baseRatio;
	mountRatio  /= baseRatio;
	snowRatio /= baseRatio;
	if(snowRatio > (1 - seaRatio)) // we don't want snow under water.
		snowRatio = 1 - seaRatio;
	// please note these ratios are not always very accurate, particularly on flat maps where many tiles share the same height.
	
	//----------------------- 2 - create an height histogram to adjust mountains ratio.
	for (let i = 0; i < yHISTOSIZE; i++)
		this.histo[i] = 0;
	
	let off1 = (this.mSize - mapSize) / 2;
	let off2 = this.mSize - off1;
	
	if (g_MapSettings.CircularMap) {

		var rad2 = mapSize * mapSize / 4;
		for (let i = off1; i < off2; i++)
		{
			let d1 = i - (this.mSize / 2);
			d1 = d1 * d1;
			for (let j = off1; j < off2; j++)
			{
				let d2 = j - (this.mSize / 2);
				d2 = d2 * d2;
				if((d1 + d2) <= rad2) {
					let idx = Math.round(this.tMap[i][j] * 10);
					this.histo[idx]++;
					test++;
				}
			}
		}
	} else {
		for (let i = off1; i < off2; i++)
		{
			for (let j = off1; j < off2; j++)
			{
				let idx = Math.round(this.tMap[i][j] * 10);
				this.histo[idx]++;
				test++;
			}
		}
	}
	
	let peakHeigth = 32000;
	if( mountRatio != 0) {
		let count = 0;
		let i = 0;
		if (g_MapSettings.CircularMap) {
			var limit = rad2 * Math.PI * (1 - mountRatio);
			var many = rad2 * Math.PI;
		} else {
			var limit = this.mSize * this.mSize * (1 - mountRatio);
			var many = this.mSize * this.mSize;
		}
		while ((count < limit) && (i < yHISTOSIZE))
			count += this.histo[i++];
		peakHeigth = i / 10;
	}
		
	//----------------------- 3- reworking the highest parts with rough terrain: creates mountains or chiasms
	for (let i = 0; i < this.mSize; i++)
	{
		for (let j = 0; j < this.mSize; j++)
		{
			if( this.tMap[i][j] > peakHeigth)
				this.tMap[i][j] = UNDEFALT;
		}
	}
	
	this.tMap[0][0] = s00;
	this.tMap[mSize][0] =  s10;
	this.tMap[0][mSize] =  s01;
	this.tMap[mSize][mSize] =  s11;
	
	
	tRough += 0.5;  // we want something rather chaotic on mountains
	tProgress = 64;
	this.createAltitudes(0, this.mSize, 0, this.mSize, (tRelief * 1.2),tRough,tProgress); // redraw high peaks
	
	// histogram needs to be redone because the map has been rudely scavenged
	for (let i = 0; i < yHISTOSIZE; i++)
		this.histo[i] = 0;
	
	if (g_MapSettings.CircularMap) {
		for (let i = off1; i < off2; i++)
		{
			let d1 = i - (this.mSize / 2);
			d1 = d1 * d1;
			for (let j = off1; j < off2; j++)
			{
				let d2 = j - (this.mSize / 2);
				d2 = d2 * d2;
				if((d1 + d2) <= rad2) {
					let idx = Math.round(this.tMap[i][j] * 10);
					this.histo[idx]++;
					test++;
				}
			}
		}
	} else {
		for (let i = off1; i < off2; i++)
		{
			for (let j = off1; j < off2; j++)
			{
				let idx = Math.round(this.tMap[i][j] * 10);
				this.histo[idx]++;
				test++;
			}
		}		
	}
	
	let count = 0;
	let i = 0;
	if (g_MapSettings.CircularMap) {
		limit = rad2 * Math.PI * seaRatio;
	} else {
		limit = this.mSize * this.mSize * seaRatio;
	}
	while ((count <= limit) && (i < yHISTOSIZE))
		count += this.histo[i++];
	let waterHeight = Math.round(i / 10) + 20;
	
	//we don't reset i because we must start at sea level
	if(snowRatio > 0) {
		if (g_MapSettings.CircularMap) {
			limit = (rad2 * 3.14 - count) * (1 - snowRatio); // and set the limit using the number of emerged points only.
		} else {
			limit = (this.mSize * this.mSize - count) * (1 - snowRatio);
		}
		count = 0;
		while ((count < limit) && (i < yHISTOSIZE))
			count += this.histo[i++];
		var snowLimit = (i / 10);
	} else
		snowLimit = 32000;
	
	this.finishMorphing(); // create the g_Map.height array from t_Map
	globalSmoothHeightmap(1);  // optionnal but advisable: it removes some artefacts and smooth unrealistic edges.
	return [waterHeight,snowLimit];
}

/**
 * Another map creation: a large smooth plain with some mountains.
 *
 * @param tBump: rules the height range from 250 (very high) - 800 (low value)
 * @param baselevel: mean height of base plain
 * @param seaRatio: water ratio on the map (%)
 * @param mountRatio: mountain ratio on the map: the value Math.floor(mapSize / 18) is added to adapt map size. mountRatio = 5 will be 15 on a normal map.
 * @param snowRatio: compute a 'snowLevel' but don't change anything
 * 
 */
HeightArray.prototype.newMap = function(tBump = 370,baselevel = 50,seaRatio = 10,mountRatio = 5,snowRatio = 0) {
	let tRough = 1; //(randIntExclusive(90,110) / 100); // 0.1 - 0.8
	mountRatio += Math.floor((1 * mapSize) / 18);
	let baseRatio = 100 - seaRatio - mountRatio;
		
	//Here are defined the big picture of the map.
	let tProgress = 64; // fractal attenuation range, try it from 2 to mapSize (powers of two). See algorithm for details.
	let tRelief = (MAX_HEIGHT * mapSize) / tBump; //  200 < 400 < 800 This one rules more or less the highest peaks in the map. MAX_HEIGHT * 2 is a maximum.
	
	let hmin = baselevel * 3;
	let hmax = baselevel * 5;
	
	let s00 = randIntExclusive(hmin,hmax); // saving original corners of the map to keep the big picture
	let s10 = randIntExclusive(hmin,hmax); // these can be set to a fixed value when full control is wanted (max MAX_HEIGHT/2 )
	let s01 = randIntExclusive(hmin,hmax); // for instance setting a corner ot a higher value than others to force mountains there.
	let s11 = randIntExclusive(hmin,hmax);
	let s22 = baselevel * 5; // height of the center
	
	this.tMap[0][0] = s00;
	this.tMap[this.mSize][0] =  s10;
	this.tMap[0][this.mSize] =  s01;
	this.tMap[this.mSize][this.mSize] =  s11;
	this.tMap[this.mSize/2][this.mSize/2] =  s22;
	
	this.createAltitudes(0, this.mSize, 0, this.mSize,tRelief,tRough,tProgress); // this creates the mountains map
	
	let off = (this.mSize - mapSize) / 2;
	mapSize++;
	var mountMap = [];
	
	for (let i = 0; i < mapSize; i++)
	{
		mountMap[i] = new Float32Array(mapSize);
		for (let j = 0; j < mapSize; j++)
		{
			mountMap[i][j] = this.tMap[i+off][j+off];
		}
	}
	mapSize--;
	
	
	//------ computing the baselevel part:
	this.tMap = [];
	
	for (let i = 0; i <= this.mSize; i++)
	{
		this.tMap[i] = new Float32Array(this.mSize + 1);
		for (let j = 0; j <= this.mSize; j++)
		{
			this.tMap[i][j] = UNDEFALT;
		}
	}
	
	this.tMap[0][0] = baselevel;
	this.tMap[this.mSize][0] =  baselevel;
	this.tMap[0][this.mSize] =  baselevel;
	this.tMap[this.mSize][this.mSize] =  baselevel;
	
	
	tRough = 0.4;  // we want something rather flat
	tProgress = 32;
	this.createAltitudes(0, this.mSize, 0, this.mSize, (tRelief / 3),tRough,tProgress); // redraw
	
	this.finishMorphing(); // create the g_Map.height array from t_Map
	
	//----------------------- 2 - create an height histogram to adjust mountains ratio.
	for (let i = 0; i < 10000; i++)
		this.histo[i] = 0;
	
	if (g_MapSettings.CircularMap) {
	
		var rad2 = mapSize * mapSize / 4;
		for (let i = 0; i < mapSize; i++)
		{
			let d1 = i - (mapSize / 2);
			d1 = d1 * d1;
			for (let j = 0; j < mapSize; j++)
			{
				let d2 = j - (mapSize / 2);
				d2 = d2 * d2;
				if((d1 + d2) <= rad2) {
					let idx = Math.round(mountMap[i][j] * 10);
					this.histo[idx]++;
				}
			}
		}
	} else {
		for (let i = 0; i < mapSize; i++)
		{
			for (let j = 0; j < mapSize; j++)
			{
				let idx = Math.round(mountMap[i][j] * 10);
				this.histo[idx]++;
			}
		}
	}
	
	var peakHeigth = 32000;
	let count = 0;
	let i = 0;
	
	if (g_MapSettings.CircularMap) {
		var limit = rad2 * Math.PI * (1 - mountRatio / 100);
		var many = rad2 * Math.PI;
	} else {
		var limit = this.mSize * this.mSize * (1 - mountRatio / 100);
		var many = this.mSize * this.mSize;
	}
	while ((count < limit) && (i < 10000))
		count += this.histo[i++];
	peakHeigth = i / 10;
	
	let snowLimit = MAX_HEIGHT;
	
	//----------------------- 3- applying the mountains to base map
	
	let gap = (peakHeigth - baselevel);
	var monts = [];
	
	let hMaxi = 0;
	let hMini = 0;
	
	for (let i = 0; i < mapSize; i++)
	{
		for (let j = 0; j < mapSize; j++)
		{
			if(g_Map.height[i][j] > hMini)
				hMini = g_Map.height[i][j];
			let alt = mountMap[i][j] - gap;
			if(( mountMap[i][j] > peakHeigth) && ( alt > g_Map.height[i][j])) {
				g_Map.height[i][j] = alt;
				monts.push(new PointXZ(i,j)); // store the region for later use
				if(alt > hMaxi)
					hMaxi = alt;
			}
		}
	}
	
	let hMiddle = hMaxi - (hMaxi - hMini) / 2;
	mountMap = null;
	
	for (let i = 0; i < 10000; i++)
		this.histo[i] = 0;
	
	if (g_MapSettings.CircularMap) {
		for (let i = 0; i < mapSize; i++)
		{
			let d1 = i - (mapSize / 2);
			d1 = d1 * d1;
			for (let j = 0; j < mapSize; j++)
			{
				let d2 = j - (mapSize / 2);
				d2 = d2 * d2;
				if((d1 + d2) <= rad2) {
					let idx = Math.round(g_Map.height[i][j] * 10);
					this.histo[idx]++;
				}
			}
		}
	} else {
		for (let i = 0; i < mapSize; i++)
		{
			for (let j = 0; j < mapSize; j++)
			{
				let idx = Math.round(g_Map.height[i][j] * 10);
				this.histo[idx]++;
			}
		}		
	}
	
	count = 0;
	i = 0;
	if (g_MapSettings.CircularMap) {
		var limit = rad2 * Math.PI * (seaRatio / 100);
	} else {
		var limit = mapSize * mapSize * (seaRatio / 100);
	}
	while ((count < limit) && (i < 10000))
		count += this.histo[i++];
	let waterHeight = i / 10;
	return [waterHeight,snowLimit,hMaxi,hMini,hMiddle,monts];
}

/**
 * Final transfer the temporary map to g_Map when all morphing is done
 * of course, tMap is cropped, keeping only its center.
 */
HeightArray.prototype.finishMorphing = function() {
	let off = (this.mSize - mapSize) / 2;
	mapSize++;
	for (let i = 0; i < mapSize; i++)
	{
		for (let j = 0; j < mapSize; j++)
		{
			g_Map.height[i][j] = this.tMap[i+off][j+off];
		}
	}
	
	mapSize--;
}
