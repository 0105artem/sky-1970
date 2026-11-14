/* Асцендент, MC и дома Плацидуса для 14.11.1970, Коряжма (UTC+3). */
(function(g){
  var RAD=Math.PI/180, LAT=61.316298, LON=47.168083;
  function n360(a){a%=360;return a<0?a+360:a}
  function houses(localHours){
    var jd=2440904.5+(localHours-3)/24, d=jd-2451545, T=d/36525;
    var ramc=n360(280.46061837+360.98564736629*d+0.000387933*T*T+LON);
    var eps=(23.4392911-0.0130042*T)*RAD, phi=LAT*RAD, r=ramc*RAD;
    var asc=n360(Math.atan2(Math.cos(r),-(Math.sin(r)*Math.cos(eps)+Math.tan(phi)*Math.sin(eps)))/RAD);
    var mc=n360(Math.atan2(Math.sin(r),Math.cos(r)*Math.cos(eps))/RAD);
    function cusp(start,f,below){
      var ra=(ramc+start)*RAD, lon=0;
      for(var i=0;i<60;i++){
        lon=Math.atan2(Math.sin(ra),Math.cos(ra)*Math.cos(eps));
        var dec=Math.asin(Math.sin(eps)*Math.sin(lon));
        var x=Math.max(-1,Math.min(1,Math.tan(phi)*Math.tan(dec)));
        ra=below?(ramc+180)*RAD-f*Math.acos(x):ramc*RAD+f*Math.acos(-x);
      }
      lon=Math.atan2(Math.sin(ra),Math.cos(ra)*Math.cos(eps));
      return n360(lon/RAD);
    }
    var c11=cusp(30,1/3,false), c12=cusp(60,2/3,false), c2=cusp(120,2/3,true), c3=cusp(150,1/3,true);
    var c=[asc,c2,c3,n360(mc+180),n360(c11+180),n360(c12+180),n360(asc+180),n360(c2+180),n360(c3+180),mc,c11,c12];
    return {asc:asc,mc:mc,cusps:c};
  }
  g.ASTRO={houses:houses};
})(typeof window!=='undefined'?window:globalThis);
