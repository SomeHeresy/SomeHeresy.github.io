const M = require('../coil-field-model.js');
const assert = require('assert');
console.time('field model'); const fields=M.buildField(); console.timeEnd('field model');
const rel=(a,b)=>Math.abs(a-b)/Math.max(1e-8,Math.abs(a),Math.abs(b));
const f=(x,y)=>M.rawField(x,y,M.COILS[0]);
for (const [x,y] of [[315,15],[240,60],[410,90],[150,120]]) {
 const a=f(x,y), b=f(x,-y); assert(rel(a[0],b[0])<1e-6); assert(rel(a[1],-b[1])<1e-6); assert(rel(a[2],b[2])<1e-6);
 const h=.05, xp=f(x+h,y),xm=f(x-h,y),yp=f(x,y+h),ym=f(x,y-h);
 const dx=(xp[0]-xm[0])/(2*h), dr=((y+h)*yp[1]-(y-h)*ym[1])/(2*h*y);
 assert(Math.abs(dx+dr)<.0004,'axisymmetric divergence check');
 const fluxBr=-(xp[2]-xm[2])/(2*h*y); assert(rel(fluxBr,a[1])<.01,'flux contour tangent must match Br');
 const fluxBx=(yp[2]-ym[2])/(2*h*y); assert(rel(fluxBx,a[0])<.02,'flux contour tangent must match Bx');
}
for(const field of fields)for(const key of ['bx','br','flux'])assert(field[key].every(Number.isFinite));
assert(Math.abs(M.sample(fields[0].bx,315,0)-1)<.025);
const states=M.trajectory();assert(states.at(-1).x>900);assert(states.at(-1).v>states[0].v*7);
for(let i=1;i<states.length;i++)assert(states[i].x>states[i-1].x);
for(let c=0;c<2;c++)assert(states.filter(s=>s.x>M.COILS[c]+30).every(s=>s.currents[c]<.015),'current removed after coil center');
const s=states.find(s=>s.x>450);assert(s.v>states[0].v*4);assert(states.at(-1).v>s.v*1.2);
console.time('contours');let n=0;for(const l of [5,12,23,39,62,92,130,178,237,310,397,500,620])n+=M.contours(fields[0].flux,l).length;console.timeEnd('contours');assert(n>1000);
console.log('PASS: B/flux symmetry, divergence, flux tangency, finite fields, interpolation, acceleration across both stages, current cutoff, and flux contours.', {speedGain:states.at(-1).v/states[0].v,segments:n});
