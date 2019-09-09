/* Creating reproducible versions for debugging purposes:

(1) include <script src="js/seedrandom.min.js"></script> in html file
    (from https://github.com/davidbau/seedrandom, copied locally)

(2) apply Math.seedrandom(42) or Math.seedrandom("hello") or similar
    in all files containing Math.random commands 
    => at present, only road.js

!! only use inside functions/methods, e.g., in road constructor;
  otherwise, DOS in some browsers at first, but not subsequent, calls (stop-start)

console.log(Math.random());          // Always 0.0016341939679719736 with 42
console.log(Math.random());          // Always 0.9364577392619949 with 42
 Math.seedrandom(42);                // undo side effects of console commands 
*/


var userCanDistortRoads=false;
var userCanDropObstaclesAndTL=true;

//#############################################################
// adapt standard IDM and MOBIL model parameters from control_gui.js
// since no sliders for that.
// Values are distributed in updateModels() => truck model derivatives
// and (as deep copies) in road.updateModelsOfAllVehicles
//#############################################################

nLanesMin=1;
nLanesMax=4; 

density=0.02; 

//var nLanes_main=1; //!!debug
var nLanes_main=3;
var nLanes_rmp=1;


/*######################################################
 Global overall scenario settings and graphics objects

 refSizePhys  => reference size in m (generally smaller side of canvas)
 refSizePix   => reference size in pixel (generally smaller side of canvas)
 scale = refSizePix/refSizePhys 
       => roads have full canvas regardless of refSizePhys, refSizePix

 (1) refSizePix=Math.min(canvas.width, canvas.height) determined during run  

 (2) refSizePhys smaller  => all phys roadlengths smaller
  => vehicles and road widths appear bigger for a given screen size 
  => chose smaller for mobile, 

  Example: refSizePhys propto sqrt(refSizePix) => roads get more compact 
  and vehicles get smaller, both on a sqrt basis

  Or jump at trigger refSizePix<canvasSizeCrit propto clientSize 
  => css cntrl normal/mobile with 2 fixed settings

  NOTICE: canvas has strange initialization of width=300 in firefox 
  and DOS when try sizing in css (see there) only 
 
  document.getElementById("contents").clientWidth; .clientHeight;

  always works!

######################################################*
*/


var scenarioString="OnRamp";
console.log("\n\nstart main: scenarioString=",scenarioString);


var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;
var aspectRatio=canvas.width/canvas.height;


console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


//##################################################################
// overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

var isSmartphone=false;
var critAspectRatio=16./9.; // optimized for 16:9 corresp. css.#contents
var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updatePhysicalDimensions();
//##################################################################

var mainroadLen=1000; //!!

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.47;
var center_yRel=-0.48;
var arcRadiusRel=0.34;
var rampLenRel=1.60;


// constant  refSizePhys calculated by requirement fixed mainroadLen!!

var refSizePhys=mainroadLen/(Math.PI*arcRadiusRel
			     +2*(critAspectRatio-center_xRel));
var scale=refSizePix/refSizePhys;

var center_xPhys, center_yPhys;
var arcRadius, arcLen, straightLen;
var rampLen, mergeLen, mainRampOffset, taperLen, rampRadius;

updatePhysicalDimensions();

// the following remains constant 
// => road becomes more compact for smaller screens

var laneWidth=7; // remains constant => road becomes more compact for smaller


var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 


function updatePhysicalDimensions(){ // only if sizePhys changed
  center_xPhys=center_xRel*refSizePhys; //[m]
  center_yPhys=center_yRel*refSizePhys;

  arcRadius=arcRadiusRel*refSizePhys;
  arcLen=arcRadius*Math.PI;
  straightLen=refSizePhys*critAspectRatio-center_xPhys;
 
  rampLen=rampLenRel*refSizePhys; 
  mergeLen=0.3*rampLen;
  mainRampOffset=mainroadLen-straightLen+mergeLen-rampLen+0.5*straightLen;
  taperLen=50;
  rampRadius=4*arcRadius;
  console.log("calculated mainroadLen=",arcLen+2*straightLen);
}



// on constructing road, road elements are gridded and internal
// road.traj_xy(u) are generated if doGridding=true (here false). If true, 
// traj_xy*(u) obsolete ??!!!

function traj_x(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter;
}

function traj_y(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? arcRadius
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
}


// heading of onramp (0: towards positive x, pi/2 = towards positive y)
// in logical onramp longitudinal coordinates
// linear change of heading between the pivot points

// NOTICE: in defining dependent geometry,
// do not refer to mainroad or onramp!! may not be defined: 
// mainroad.nLanes => nLanes_main, ramp.nLanes=>nLanes_ramp1!!

function headingRamp(u){

  var um1=0; var headingm1=0.2; // heading at ramp begin
  var u0=0.3*(rampLen-mergeLen); var heading0=0; 
  var u1=0.4*(rampLen-mergeLen); var heading1=0;
  var u2=0.5*(rampLen-mergeLen); var heading2=0.0; // 0.2;
  var u3=0.55*(rampLen-mergeLen); var heading3=0;
  var u4=0.6*(rampLen-mergeLen); var heading4=0;
  var u5=0.8*(rampLen-mergeLen); var heading5=0.25;
  var u6=1.0*rampLen-mergeLen; var heading6=0;
  var u7=rampLen-taperLen; var heading7=0;
  var u8=rampLen-0.5*taperLen; var heading8=2*nLanes_rmp*laneWidth/taperLen;
  var u9=rampLen; var heading9=0;
  var heading= (u<u0) ? headingm1 + (u-um1)/(u0-um1)*(heading0-headingm1) :
    (u<u1) ? heading0 + (u-u0)/(u1-u0)*(heading1-heading0) :
    (u<u2) ? heading1 + (u-u1)/(u2-u1)*(heading2-heading1) :
    (u<u3) ? heading2 + (u-u2)/(u3-u2)*(heading3-heading2) :
    (u<u4) ? heading3 + (u-u3)/(u4-u3)*(heading4-heading3) :
    (u<u5) ? heading4 + (u-u4)/(u5-u4)*(heading5-heading4) :
    (u<u6) ? heading5 + (u-u5)/(u6-u5)*(heading6-heading5) :
    (u<u7) ? heading6 + (u-u6)/(u7-u6)*(heading7-heading6) :
    (u<u8) ? heading7 + (u-u7)/(u8-u7)*(heading8-heading7)
    : heading8 + (u-u8)/(u9-u8)*(heading9-heading8);
  return heading;
}

// construct ramp x/y arrays in phsyical space
//!!! assuming for the moment mainroad heading=0 @ merge!

var nArrRamp=100;
var drampLen=rampLen/(nArrRamp-1);
var xRamp=[];
var yRamp=[];

// updates array variables if new geometry, changed viewport size etc

function updateRampGeometry(){

  // crucial: correct x/y attachment at begin of merge 
  // (assume heading=0 @ merge for the moment)

  xRamp[nArrRamp-1]=traj_x(mainRampOffset+rampLen-mergeLen)+mergeLen;
  yRamp[nArrRamp-1]=traj_y(mainRampOffset+rampLen-mergeLen)
    -0.5*laneWidth*(nLanes_main-nLanes_rmp);

  for(var i=nArrRamp-2; i>=0; i--){
    var u=drampLen*(i+0.5);
    xRamp[i]=xRamp[i+1]-drampLen*Math.cos(headingRamp(u));
    yRamp[i]=yRamp[i+1]-drampLen*Math.sin(headingRamp(u));
  }
  console.log("in updateRampGeometry: nLanes_main=",nLanes_main,
	      " trajRamp_y(rampLen-50)=",trajRamp_y(rampLen-50)
	     );

}


function trajRamp_x(u){ // physical coordinates
  var idouble=u/drampLen;
  var il=Math.max(0,Math.floor(idouble));
  var iu=Math.min(nArrRamp-1,il+1);
  return xRamp[il]+(idouble-il)*(xRamp[iu]-xRamp[il]);
}

function trajRamp_y(u){ // physical coordinates
  var idouble=u/drampLen;
  var il=Math.max(0,Math.floor(idouble));
  var iu=Math.min(nArrRamp-1,il+1);
  return yRamp[il]+(idouble-il)*(yRamp[iu]-yRamp[il]);
}


//##################################################################
// Specification of logical road 
//##################################################################

var isRing=false;  // 0: false; 1: true
var roadIDmain=1;
var roadIDramp=2;

var truckFracToleratedMismatch=1.0; // 100% allowed=>changes only by sources

var speedInit=20; // IC for speed

// last arg = doGridding (true: user can change road geometry)

var mainroad=new road(roadIDmain,mainroadLen,laneWidth,nLanes_main,
		      traj_x,traj_y,
		      density, speedInit,truckFrac, isRing,userCanDistortRoads);

var ramp=new road(roadIDramp,rampLen,laneWidth,nLanes_rmp,
		    trajRamp_x,trajRamp_y,
		  0*density, speedInit, truckFrac, isRing,userCanDistortRoads);


// add standing virtual vehicle at the end of ramp (1 lane)
// prepending=unshift (strange name)

var virtualStandingVeh=new vehicle(2, laneWidth, ramp.roadLen-0.9*taperLen, 0, 0, "obstacle");

ramp.veh.unshift(virtualStandingVeh);

// !! introduce stationary detectors (aug17)

var nDet=3;
var mainDetectors=[];
mainDetectors[0]=new stationaryDetector(mainroad,0.10*mainroadLen,30);
mainDetectors[1]=new stationaryDetector(mainroad,0.60*mainroadLen,30);
mainDetectors[2]=new stationaryDetector(mainroad,0.90*mainroadLen,30);


//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification
//####################################################################

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes

var drawColormap=false;
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=100/3.6; // max speed for speed colormap (drawn in blue-violet)


//####################################################################
// Images
//####################################################################


// init background image

var background = new Image();
background.src ='figs/backgroundGrass.jpg'; 
 

// init vehicle image(s)

carImg = new Image();
carImg.src = 'figs/blackCarCropped.gif';
truckImg = new Image();
truckImg.src = 'figs/truck1Small.png';


// init traffic light images

traffLightRedImg = new Image();
traffLightRedImg.src='figs/trafficLightRed_affine.png';
traffLightGreenImg = new Image();
traffLightGreenImg.src='figs/trafficLightGreen_affine.png';


// init obstacle images

obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<10; i++){
    obstacleImgs[i]=new Image();
    obstacleImgs[i].src = (i==0)
	? 'figs/obstacleImg.png'
	: "figs/constructionVeh"+i+".png";
}


// init road images

roadImgs1 = []; // road with lane separating line
roadImgs2 = []; // road without lane separating line

for (var i=0; i<4; i++){
    roadImgs1[i]=new Image();
    roadImgs1[i].src="figs/road"+(i+1)+"lanesCropWith.png"
    roadImgs2[i]=new Image();
    roadImgs2[i].src="figs/road"+(i+1)+"lanesCropWithout.png"
}

roadImg1 = new Image();
roadImg1=roadImgs1[nLanes_main-1];
roadImg2 = new Image();
roadImg2=roadImgs2[nLanes_main-1];

rampImg = new Image();
rampImg=roadImgs1[nLanes_rmp-1];



//####################################################################
//!!! vehicleDepot(nImgs,nRow,nCol,xDepot,yDepot,lVeh,wVeh,containsObstacles)
//####################################################################

var smallerDimPix=Math.min(canvas.width,canvas.height);
var depot=new vehicleDepot(obstacleImgs.length, 1,2,
			   0.7*smallerDimPix/scale,
			   -0.5*smallerDimPix/scale,
			   30,30,true);




//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second (unchanged during runtime)
var dt=timewarp/fps;


//#################################################################
function updateSim(){
//#################################################################

    // update times

    time +=dt; // dt depends on timewarp slider (fps=const)
    itime++;

    updateRampGeometry();

    mainroad.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);

    ramp.updateTruckFrac(truckFrac, truckFracToleratedMismatch);
    ramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);


    // externally impose mandatory LC behaviour
    // all ramp vehicles must change lanes to the left (last arg=false)

    ramp.setLCMandatory(0, ramp.roadLen, false);


    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    mainroad.updateBCup(qIn,dt); // argument=total inflow

    for (var i=0; i<mainroad.nveh; i++){
	if(mainroad.veh[i].speed<0){
	    console.log(" speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	}
    }


    ramp.calcAccelerations();  
    ramp.updateSpeedPositions();
    //ramp.updateBCdown();
    ramp.updateBCup(qOn,dt); // argument=total inflow

    //template: road.mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)

    ramp.mergeDiverge(mainroad,mainRampOffset,
			ramp.roadLen-mergeLen,ramp.roadLen,true,false);


    for(var iDet=0; iDet<nDet; iDet++){
	mainDetectors[iDet].update(time,dt);
    }


    //!!!  without this zoomback cmd, everything works but depot vehicles
    // just stay where they have been dropped outside of a road

    if(depotVehZoomBack){
	var res=depot.zoomBackVehicle();
	depotVehZoomBack=res;
	userCanvasManip=true;
    }

    // write vehicle positions of mainroad and onramp to console for external use

    //if((itime>=125)&&(itime<=128)){
    if(false){
	console.log("updateSim: Simulation time=",time,
		    " itime=",itime);
	console.log("\nmainroad vehicles:");
	mainroad.writeVehiclesSimple();
	//console.log("\nonramp vehicles:");
	ramp.writeVehiclesSimple();
    }

}//updateSim




//##################################################
function drawSim() {
//##################################################

    //!! test relative motion isMoving


    var movingObserver=false;
    var uObs=0*time;

    // (0) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
    var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
    var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);


    var hasChanged=false;


    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

	updatePhysicalDimensions();

	if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
	}


    }

 


    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    


    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(hasChanged||(itime<=2) || (itime===20) || userCanvasManip 
	   || movingObserver || (!drawRoad)){
        ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }

    // (3) draw mainroad and ramp
    // (always drawn; changedGeometry only triggers building a new lookup table)

    var changedGeometry=userCanvasManip || hasChanged||(itime<=1)||true; 
    ramp.draw(rampImg,rampImg,scale,changedGeometry,
		movingObserver,0, 
		center_xPhys-mainroad.traj_x(uObs)+ramp.traj_x(0),
		center_yPhys-mainroad.traj_y(uObs)+ramp.traj_y(0)); 
    ramp.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!

    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry,
		  movingObserver,uObs,center_xPhys,center_yPhys); 
    mainroad.drawTrafficLights(traffLightRedImg,traffLightGreenImg);//!!!


 
    // (4) draw vehicles

    ramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			vmin_col,vmax_col,0,ramp.roadLen,
			movingObserver,0,
			center_xPhys-mainroad.traj_x(uObs)+ramp.traj_x(0),
			center_yPhys-mainroad.traj_y(uObs)+ramp.traj_y(0));


    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			  vmin_col,vmax_col,0,mainroad.roadLen,
			  movingObserver,uObs,center_xPhys,center_yPhys);

    // (5) !!! draw depot vehicles

   if(userCanDropObstaclesAndTL&&(!isSmartphone)){
	depot.draw(obstacleImgs,scale,canvas);
    }


    // (6) show simulation time and detector displays

    displayTime(time,textsize);
    for(var iDet=0; iDet<nDet; iDet++){
	mainDetectors[iDet].display(textsize);
    }

  if(false){
    ctx.setTransform(1,0,0,1,0,0); 
    var textsize=0.02*Math.min(canvas.width,canvas.height); // 2vw;
    ctx.font=textsize+'px Arial';


    /*
    var scaleStr=" scale="+Math.round(10*scale)/10;
    var scaleStr_xlb=9*textsize;
    var scaleStr_ylb=timeStr_ylb;
    var scaleStr_width=5*textsize;
    var scaleStr_height=1.2*textsize;
    ctx.fillStyle="rgb(255,255,255)";
    ctx.fillRect(scaleStr_xlb,scaleStr_ylb-scaleStr_height,
		 scaleStr_width,scaleStr_height);
    ctx.fillStyle="rgb(0,0,0)";
    ctx.fillText(scaleStr, scaleStr_xlb+0.2*textsize, 
		 scaleStr_ylb-0.2*textsize);
    */


      // (7) draw the speed colormap
      //!!! Now always false; drawn statically by html file!

    if(drawColormap){
      displayColormap(0.22*refSizePix,
                   0.43*refSizePix,
                   0.1*refSizePix, 0.2*refSizePix,
		   vmin_col,vmax_col,0,100/3.6);
    }
    // revert to neutral transformation at the end!
    ctx.setTransform(1,0,0,1,0,0); 
  }
}
 



//##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    updateSim();
    drawSim();
    userCanvasManip=false;
}
 

 //############################################
// start the simulation thread
// THIS function does all the things; everything else 
// only functions/definitions
// triggers:
// (i) automatically when loading the simulation 
// (ii) when pressing the start button in *gui.js
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");
showInfo();

var myRun=setInterval(main_loop, 1000/fps);
