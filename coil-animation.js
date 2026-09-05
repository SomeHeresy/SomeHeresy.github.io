/* Canvas renderer for the dimensionless coil field model. */
(() => {
  'use strict';
  const M = window.CoilFieldModel;
  const canvas = document.getElementById('coil-stage');
  if (!M || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const shell = canvas.closest('.field-shell');
  // Keep the desktop accent aligned with the width of “YANG.” above it.
  const name = document.querySelector('.nameplate > span');
  if (name) {
    const matchName = () => shell.style.setProperty('--name-width', `${name.getBoundingClientRect().width}px`);
    matchName();
    if ('ResizeObserver' in window) new ResizeObserver(matchName).observe(name);
    else addEventListener('resize', matchName, { passive: true });
  }
  const fire = shell.querySelector('[data-coil-fire]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fields = M.buildField(), states = M.trajectory();
  const duration = states.at(-1).time, maxV = states.at(-1).v;
  const W = 900, H = 340, top = 0;
  const fieldSurface = document.createElement('canvas'); fieldSurface.width=M.WIDTH; fieldSurface.height=M.HEIGHT;
  const fc = fieldSurface.getContext('2d');
  const heat = document.createElement('canvas'); heat.width=M.NX; heat.height=M.NY;
  const hc = heat.getContext('2d'), pixels = hc.createImageData(M.NX,M.NY);
  const flux = new Float32Array(M.NX*M.NY), bx = new Float32Array(flux.length), br = new Float32Array(flux.length);
  let surfaceKey = '', time = 0, frame = 0, last = null, playing = false, looping = false, inView = true;
  let scale = 1, ox = 0, oy = 0, pixelW = 0, pixelH = 0;
  const colors = [[42,67,80],[53,108,123],[95,151,146],[156,182,140],[216,190,122],[245,160,94],[255,220,160]];
  const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
  const css=c=>`rgb(${c.join(',')})`;
  function colorIndex(b) { return Math.floor(clamp(Math.log1p(b*7)/Math.log(15))*6); }
  function stateAt(t) { return states[Math.min(states.length-1,Math.max(0,Math.round(t*240)))]; }
  function line(x1,y1,x2,y2,color='#71806c',width=1) {ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function label(text,x,y,color='#bbc7b0',align='left',size=13) {ctx.fillStyle=color;ctx.font=`${size}px "Courier New", monospace`;ctx.textAlign=align;ctx.fillText(text,x,y);}
  function arrow(x,y,dx,dy,color='#eff2dc') {
    line(x,y,x+dx,y+dy,color,1.5);const a=Math.atan2(dy,dx),r=5;
    line(x+dx,y+dy,x+dx-r*Math.cos(a-.5),y+dy-r*Math.sin(a-.5),color,1.5);
    line(x+dx,y+dy,x+dx-r*Math.cos(a+.5),y+dy-r*Math.sin(a+.5),color,1.5);
  }
  function renderField(currents) {
    const amps=currents.map(v=>Math.round(v*20)/20), key=amps.join(',');
    if(key===surfaceKey) return;surfaceKey=key;
    for(let i=0;i<flux.length;i++) {
      flux[i]=fields[0].flux[i]*amps[0]+fields[1].flux[i]*amps[1];
      bx[i]=fields[0].bx[i]*amps[0]+fields[1].bx[i]*amps[1];
      br[i]=fields[0].br[i]*amps[0]+fields[1].br[i]*amps[1];
      const b=Math.hypot(bx[i],br[i]), c=colors[colorIndex(b)], alpha=clamp(Math.log1p(b*12)/Math.log(25))*.62;
      pixels.data[i*4]=c[0];pixels.data[i*4+1]=c[1];pixels.data[i*4+2]=c[2];pixels.data[i*4+3]=Math.round(alpha*255);
    }
    hc.putImageData(pixels,0,0);fc.clearRect(0,0,M.WIDTH,M.HEIGHT);
    fc.imageSmoothingEnabled=true;fc.drawImage(heat,0,0,M.WIDTH,M.HEIGHT);
    const paths=colors.map(()=>new Path2D());
    // Flux contours remain fixed in space while current changes their extent.
    for(const level of [5,12,23,39,62,92,130,178,237,310,397,500,620]) {
      for(const [a,b] of M.contours(flux,level)) {
        const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2-M.HEIGHT/2;
        const strength=Math.hypot(M.sample(bx,x,y),M.sample(br,x,y));
        const path=paths[colorIndex(strength)];path.moveTo(...a);path.lineTo(...b);
      }
    }
    fc.lineWidth=1.15;fc.globalAlpha=.86;
    paths.forEach((p,i)=>{fc.strokeStyle=css(colors[i]);fc.stroke(p)});fc.globalAlpha=1;
  }
  function draw() {
    const s=stateAt(time);renderField(s.currents);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    const dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
    // A quiet mesh supports the field without turning the accent into a dashboard.
    ctx.globalAlpha=.22;
    for(let x=20;x<W;x+=40)line(x,top,x,top+M.HEIGHT,'#65785f',.7);
    for(let y=top+10;y<top+M.HEIGHT;y+=40)line(20,y,W-20,y,'#65785f',.7);
    ctx.globalAlpha=1;ctx.drawImage(fieldSurface,0,top);
    const cy=top+M.HEIGHT/2;
    ctx.setLineDash([5,5]);line(20,cy,880,cy,'#97a18a',.6);ctx.setLineDash([]);
    // Winding cross-sections: dots above and crosses below show current direction.
    M.COILS.forEach((cx,i)=>{
      const a=s.currents[i];
      label('0'+(i+1),cx,top+70,a>.08?'#ffd3a0':'#a3b198','center',20);
      [cy-M.RADIUS,cy+M.RADIUS].forEach((y,side)=>{
        ctx.fillStyle='#29322a';ctx.fillRect(cx-43,y-9,86,18);
        ctx.strokeStyle=a>.08?'#e5b07c':'#6c7762';ctx.lineWidth=1;ctx.strokeRect(cx-43,y-9,86,18);
        for(let n=0;n<10;n++) {
          const x=cx-36+n*8;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.strokeStyle=a>.08?'#f4bc82':'#7b846f';ctx.stroke();
          if(side) {line(x-1.5,y-1.5,x+1.5,y+1.5,'#d1a077');line(x-1.5,y+1.5,x+1.5,y-1.5,'#d1a077');}
          else {ctx.fillStyle='#d1a077';ctx.fillRect(x-.7,y-.7,1.4,1.4);}
        }
      });
    });
    line(120,cy-13,825,cy-13,'#a8b49b',1);line(120,cy+13,825,cy+13,'#a8b49b',1);
    // Equal-time strobe positions get farther apart as speed increases.
    for(let t=.15;t<time;t+=.15) {
      const past=stateAt(t);if(past.x>845)break;
      ctx.globalAlpha=.2+clamp(t/duration)*.18;ctx.fillStyle='#e8edd8';ctx.fillRect(past.x-1,cy-4,2,8);
    }
    ctx.globalAlpha=1;
    if(s.x<875) {
      const gradient=ctx.createLinearGradient(0,cy-7,0,cy+7);gradient.addColorStop(0,'#f6f7e6');gradient.addColorStop(.5,'#aebba1');gradient.addColorStop(1,'#e8eedb');
      ctx.fillStyle=gradient;ctx.fillRect(s.x-18,cy-7,36,14);ctx.strokeStyle='#f5f4da';ctx.strokeRect(s.x-18,cy-7,36,14);
      arrow(s.x,cy-27,18+110*s.v/maxV,0,'#f9cea1');
    }
    ctx.restore();
  }

  function updateButton() {
    fire.setAttribute('aria-pressed', String(looping));
    if (looping) {
      fire.textContent = 'Stop loop ■';
      fire.setAttribute('aria-label', 'Stop looping after the current run');
    } else if (playing) {
      fire.textContent = 'Finishing…';
      fire.setAttribute('aria-label', 'Keep looping after this run');
    } else {
      fire.textContent = 'Start loop ↗';
      fire.setAttribute('aria-label', 'Start looping the coilgun animation');
    }
  }
  function schedule() {
    if (!frame && playing && !document.hidden && inView) frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = 0;
    if (last !== null) time = Math.min(duration, time + Math.min((now-last)/1000, .05) * .7);
    last = now;
    draw();
    if (time >= duration) {
      if (looping) time = 0;
      else { playing = false; last = null; updateButton(); }
    }
    schedule();
  }
  // This is the only playback control. Turning looping off never interrupts
  // the projectile mid-flight; another click can cancel that pending stop.
  fire.addEventListener('click', () => {
    looping = !looping;
    if (looping && !playing) { time = 0; playing = true; last = null; }
    updateButton();
    schedule();
  });
  // Playback always requires an explicit click, even when the accent enters
  // the viewport. A new reduced-motion preference stops after this run.
  reduced.addEventListener('change', () => {
    if (reduced.matches) { looping = false; updateButton(); }
  });
  document.addEventListener('visibilitychange', () => {
    last = null;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; last = null;
    if (inView) schedule();
    else { cancelAnimationFrame(frame); frame = 0; }
  }, { threshold: .15 }).observe(canvas);
  function resize(){const r=canvas.parentElement.getBoundingClientRect();pixelW=r.width;pixelH=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(pixelW*dpr);canvas.height=Math.round(pixelH*dpr);scale=Math.min(pixelW/W,pixelH/H);ox=(pixelW-W*scale)/2;oy=(pixelH-H*scale)/2;draw();}
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas.parentElement);else addEventListener('resize',resize,{passive:true});
  resize(); updateButton();
})();
