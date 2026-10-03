'use strict';
(() => {
  const data = window.MINE_ODYSSEY;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pressed = (selector, attr, value) => $$(selector).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value))));
  const text = (selector, value) => { $(selector).textContent = value; };
  if (!data?.maps?.length) { text('#world-count', 'The world inventory could not be loaded. Keep the data folder alongside this page.'); return; }
  const state = { filter:'all', query:'', expanded:false, cohort:'main', sort:'sr', direction:-1, clip:0 };
  const featured = ['cape-town','versailles','ueno-park','hagia-sophia','zurich','rms-titanic'];
  const worlds = [...data.maps].sort((a,b) => {
    const ai=featured.indexOf(a.id), bi=featured.indexOf(b.id);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.name.localeCompare(b.name);
  });
  const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function renderWorlds() {
    const query = fold(state.query.trim());
    const matched = worlds.filter(m => (state.filter==='all'||m.environment===state.filter) && fold(`${m.name} ${m.location} ${m.continent}`).includes(query));
    const visible = state.expanded || state.filter!=='all' || query ? matched : matched.slice(0,6);
    text('#world-count', `Showing ${visible.length} of ${matched.length} worlds${query ? ` matching “${state.query.trim()}”` : ''}`);
    $('#world-grid').innerHTML = visible.length ? visible.map(m => `<button type="button" class="world-card" data-world="${escapeHTML(m.id)}" aria-label="Explore ${escapeHTML(m.name)}"><div class="world-photo"><img src="${escapeHTML(m.image)}" alt="Minecraft reconstruction of ${escapeHTML(m.name)}" width="960" height="600" loading="lazy"><video class="world-preview-video" data-src="${escapeHTML(m.preview.video)}" muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video><span>${escapeHTML(m.environment==='indoor'?'Indoor':'Outdoor')}</span><small class="world-preview-hint"><span aria-hidden="true">▶</span> <span class="hover-instruction">Hover to play</span></small></div><div class="world-card-top"><h3>${escapeHTML(m.name)}</h3><span aria-hidden="true">↗</span></div><p>${escapeHTML(m.location)}</p><div class="world-card-meta"><span>${m.task_count} ${m.task_count===1?'task':'tasks'}</span><span>${m.waypoint_count} waypoints</span></div></button>`).join('') : '<div class="empty-state"><p>No worlds match this search.</p><button type="button" class="button outline" id="reset-worlds">Reset filters</button></div>';
    $('#show-worlds').hidden = Boolean(query) || state.filter!=='all';
    $('#show-worlds').innerHTML = state.expanded ? 'Show featured worlds <span aria-hidden="true">↑</span>' : 'Explore all 30 worlds <span aria-hidden="true">↓</span>';
    pressed('[data-world-filter]','worldFilter',state.filter);
    document.dispatchEvent(new Event('worlds-rendered'));
  }
  $$('[data-world-filter]').forEach(b => b.addEventListener('click', () => { state.filter=b.dataset.worldFilter; renderWorlds(); }));
  $('#world-search').addEventListener('input', e => {state.query=e.target.value;renderWorlds();});
  $('#show-worlds').addEventListener('click', () => {
    state.expanded=!state.expanded;renderWorlds();
    if (!state.expanded) $('#worlds').scrollIntoView({behavior:'instant'});
  });
  const dialog=$('#image-dialog');
  function openImage(src,title,description,world=false) {
    dialog.dataset.world=String(world);
    text('#dialog-title',title);text('#dialog-description',description);
    $('#dialog-image').src=src;$('#dialog-image').alt=title;
    dialog.showModal(); document.body.style.overflow='hidden';
    document.dispatchEvent(new Event('preview-dialog-open'));
  }
  $('#close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.style.overflow='';});
  dialog.addEventListener('click', e => {
    const r=dialog.getBoundingClientRect();
    if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();
  });
  $('#world-grid').addEventListener('click',e=>{
    if(e.target.closest('#reset-worlds')){state.query='';state.filter='all';$('#world-search').value='';renderWorlds();return;}
    const button=e.target.closest('[data-world]');if(!button)return;
    const m=data.maps.find(m=>m.id===button.dataset.world);
    openImage(m.image,m.name,`${m.location} · ${m.environment} · ${m.task_count} tasks · ${m.waypoint_count} catalogued waypoints. 6-second excerpt from a recorded navigation run · Original speed. Cover photograph is a separate presentation view.`,m.id);
  });
  $$('[data-scene]').forEach(b=>b.addEventListener('click',()=>{
    const m=data.maps.find(m=>m.id===b.dataset.scene);
    const img=$('.hero-panorama > img');
    img.src=m.id==='versailles'?'assets/hero-versailles.webp':m.image;
    img.alt=`Minecraft reconstruction of ${m.name}`;
    $('.scene-caption').innerHTML=`<span>${String(data.maps.findIndex(x=>x.id===m.id)+1).padStart(2,'0')} / 30</span><span>${escapeHTML(m.name)} <small>${escapeHTML(m.location.split(' · ').at(-1))} · ${m.environment==='indoor'?'Indoor':'Outdoor'} world</small></span><span class="capture-tag">In-game presentation capture</span>`;
    pressed('[data-scene]','scene',m.id);
  }));
  const tasks=data.journeys.examples;
  let taskIndex=0,taskStop=0,originalInstruction=false,taskView='map';
  const stopLabel=(s,i)=>i===0?'Starting point':s.role==='finish'?'04 / Final destination':`${String(i).padStart(2,'0')} / Checkpoint`;
  function setInstruction() {
    const task=tasks[taskIndex],isEnglish=task.locale.startsWith('en');
    text('#task-prompt',originalInstruction?task.original_prompt:task.prompt);
    $('#task-prompt').lang=originalInstruction?task.locale:'en';
    text('#task-language-label',isEnglish?'Original · English':originalInstruction?`Original · ${task.language}`:`English rendering · Original in ${task.language}`);
    text('#task-language',originalInstruction?'Read in English':`Read ${task.language} original`);
    $('#task-language').hidden=isEnglish;
    $('#task-language').setAttribute('aria-pressed',String(originalInstruction));
  }
  function setTaskView(view) {
    taskView=view;const task=tasks[taskIndex],m=data.maps.find(m=>m.id===task.map);
    $('#task-map').hidden=view!=='map';$('#task-scene').hidden=view!=='scene';
    pressed('[data-task-view]','taskView',view);
    text('#task-photo-caption',view==='scene'?`${m.name} · In-game presentation capture`:'Native map · Dashed lines show visit order, not a walkable route.');
  }
  function setTaskStop(index) {
    taskStop=Math.max(0,Math.min(tasks[taskIndex].stops.length-1,index));
    const task=tasks[taskIndex],s=task.stops[taskStop],dy=s.position[1]-task.stops[0].position[1];
    pressed('[data-task-stop]','taskStop',taskStop);
    text('#task-stop-role',stopLabel(s,taskStop));text('#task-stop-title',s.name);text('#task-stop-purpose',s.purpose);
    text('#task-stop-height',`${s.original_name} · ${dy===0?'Same target height as start':`${Math.abs(dy)} ${Math.abs(dy)===1?'block':'blocks'} ${dy>0?'above':'below'} the start`}`);
    $('#task-prev').disabled=taskStop===0;$('#task-next').disabled=taskStop===task.stops.length-1;
    $$('#task-map-lines [data-leg]').forEach(p=>p.classList.toggle('is-selected',Number(p.dataset.leg)===taskStop));
  }
  function setTask(index) {
    taskIndex=index;originalInstruction=false;
    const task=tasks[index],m=data.maps.find(m=>m.id===task.map);
    text('#task-meta',task.id);text('#task-title',task.title);text('#task-setting',task.setting);
    setInstruction();
    $('#task-image').src=m.image;$('#task-image').alt=`Minecraft reconstruction of ${m.name}`;
    $('#task-map-image').src=task.map_image;$('#task-map-image').alt=`Native top-down map of ${m.name}; numbered task destinations are listed alongside`;
    $('#task-stops').innerHTML=task.stops.map((s,i)=>`<li><button type="button" data-task-stop="${i}" aria-pressed="false"><span class="stop-number" aria-hidden="true">${i===0?'S':i}</span><span><small>${escapeHTML(stopLabel(s,i))}</small><strong>${escapeHTML(s.name)}</strong><span>${escapeHTML(s.purpose)}</span></span><span class="stop-arrow" aria-hidden="true">↗</span></button></li>`).join('');
    $('#task-markers').innerHTML=task.stops.map((s,i)=>`<button type="button" data-task-stop="${i}" aria-pressed="false" class="task-marker ${s.role}" style="left:${s.marker[0]/10}%;top:${s.marker[1]/6.67}%" aria-label="${escapeHTML(`${stopLabel(s,i)}: ${s.name}`)}" title="${escapeHTML(s.name)}">${i===0?'S':i}</button>`).join('');
    $('#task-map-lines').innerHTML=task.stops.map((s,i)=>`${i?`<path class="task-leg" data-leg="${i}" d="M ${task.stops[i-1].anchor.join(' ')} L ${s.anchor.join(' ')}"/>`:''}<path class="task-marker-leader" d="M ${s.anchor.join(' ')} L ${s.marker.join(' ')}"/><circle class="task-anchor" cx="${s.anchor[0]}" cy="${s.anchor[1]}" r="4"/>`).join('');
    $('#task-challenges').innerHTML=task.challenges.map(([title,body],i)=>`<article><span>0${i+1}</span><h4>${escapeHTML(title)}</h4><p>${escapeHTML(body)}</p></article>`).join('');
    text('#task-arrival',`Position samples are checked every ${task.arrival.sample_interval_sec} second. Arrival requires both a 3D distance of less than ${task.arrival.radius_3d} blocks and a height difference of at most ${task.arrival.radius_y} blocks from the target.`);
    $('.task-completion details').open=false;
    setTaskStop(0);setTaskView(taskView);
    pressed('[data-task]','task',index);
  }
  $$('[data-task]').forEach(b=>b.addEventListener('click',()=>setTask(Number(b.dataset.task))));
  $('.journey-explorer').addEventListener('click',e=>{const b=e.target.closest('[data-task-stop]');if(b){setTaskView('map');setTaskStop(Number(b.dataset.taskStop));}});
  $$('[data-task-view]').forEach(b=>b.addEventListener('click',()=>setTaskView(b.dataset.taskView)));
  $('#task-language').addEventListener('click',()=>{originalInstruction=!originalInstruction;setInstruction();});
  $('#task-prev').addEventListener('click',()=>setTaskStop(taskStop-1));
  $('#task-next').addEventListener('click',()=>setTaskStop(taskStop+1));
  const video=$('#demo-video');
  const stamp=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  function setClip(index) {
    video.pause();state.clip=index;const clip=data.clips[index];
    video.removeAttribute('src');video.load();video.poster=clip.poster;
    video.setAttribute('aria-label',`${clip.title} Recorded agent interaction in ${clip.place}`);
    $('#video-start').hidden=false;text('#video-status','');
    text('#clip-place',`${clip.place} / Recorded interaction`);text('#clip-title',clip.title);text('#clip-description',clip.description);
    text('#clip-source',`Source window ${stamp(clip.start)}–${stamp(clip.start+clip.length)} · Original-speed excerpt. Keyframe alignment may include a short lead-in.`);
    $('#clip-phases').innerHTML=clip.phases.map(p=>`<li>${escapeHTML(p)}</li>`).join('');
    pressed('[data-clip]','clip',index);
  }
  async function playClip() {
    if(!video.getAttribute('src'))video.src=data.clips[state.clip].video;
    video.playbackRate=Number($('#playback-speed').value);
    try{await video.play();$('#video-start').hidden=true;text('#video-status','');}
    catch {text('#video-status','Playback could not start. Try the video controls or another browser.');}
  }
  $('#video-start').addEventListener('click',playClip);
  video.addEventListener('play',()=>{$('#video-start').hidden=true;});
  video.addEventListener('error',()=>text('#video-status','The recording could not be loaded. Keep the assets folder alongside the page.'));
  $('#playback-speed').addEventListener('change',e=>{video.playbackRate=Number(e.target.value);});
  $$('[data-clip]').forEach(b=>b.addEventListener('click',()=>setClip(Number(b.dataset.clip))));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
  function renderResults() {
    const rows=data.results.filter(r=>state.cohort==='main'?r.cohort==='main':r.model==='Claude Opus 5').sort((a,b)=>state.direction*(a[state.sort]-b[state.sort]));
    $('#results-body').innerHTML=rows.map(r=>`<tr class="${r.sr===Math.max(...rows.map(x=>x.sr))?'leading':''}"><th scope="row"><span class="model-name">${escapeHTML(r.model)}</span><span class="model-effort">${escapeHTML(r.effort)} effort · 180 tasks</span></th><td><div class="score-wrap"><span>${r.sr.toFixed(2)}%</span><span class="score-bar" aria-hidden="true"><i style="width:${r.sr}%"></i></span></div></td><td>${r.outdoor_sr.toFixed(2)}%</td><td>${r.indoor_sr.toFixed(2)}%</td><td>${r.cc.toFixed(2)}%</td><td>${r.spl.toFixed(2)}%</td><td>${r.mean_steps.toFixed(1)}</td><td>${r.mean_path_3d_blocks.toFixed(1)}</td></tr>`).join('');
    $$('[data-sort-column]').forEach(h=>h.setAttribute('aria-sort',h.dataset.sortColumn===state.sort?(state.direction===-1?'descending':'ascending'):'none'));
    const label=$(`[data-sort="${state.sort}"]`).textContent.replace(/[↑↓]/g,'').trim();
    text('#results-status',`${rows.length} configurations · Sorted by ${label.toLowerCase()}, ${state.direction===-1?'highest':'lowest'} first`);
    pressed('[data-cohort]','cohort',state.cohort);
  }
  $$('[data-sort]').forEach(b=>b.addEventListener('click',()=>{
    const key=b.dataset.sort;
    state.direction=state.sort===key?-state.direction:(['mean_steps','mean_path_3d_blocks'].includes(key)?1:-1);state.sort=key;renderResults();
  }));
  $$('[data-cohort]').forEach(b=>b.addEventListener('click',()=>{state.cohort=b.dataset.cohort;renderResults();}));
  $('#terrain-scenes').innerHTML=data.scenes.map(s=>`<button class="terrain-card" data-scene-detail="${escapeHTML(s.id)}" type="button"><img src="${escapeHTML(s.image)}" alt="${escapeHTML(`${s.title} in ${s.place}`)}" width="800" height="600" loading="lazy"><span class="terrain-card-copy"><strong>${escapeHTML(s.title)}</strong><span>${escapeHTML(s.place)}</span><small>${escapeHTML(s.kind)}</small></span><span class="terrain-open" aria-hidden="true">↗</span></button>`).join('');
  $('#terrain-scenes').addEventListener('click',e=>{const b=e.target.closest('[data-scene-detail]');if(!b)return;const s=data.scenes.find(s=>s.id===b.dataset.sceneDetail);openImage(s.image,s.title,`${s.place} · ${s.description} · ${s.kind}`);});
  const menu=$('.menu-toggle'),nav=$('#navigation');
  function closeMenu(){menu.setAttribute('aria-expanded','false');nav.classList.remove('is-open');}
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('is-open')){closeMenu();menu.focus();}});
  renderWorlds();setTask(0);setClip(0);renderResults();
})();

// The complete project film loads on play or an explicit chapter selection.
(() => {
  const film=window.MINE_ODYSSEY.film,$=s=>document.querySelector(s),video=$('#showcase-video');
  const stamp=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const indices=[0,1,2,3,5,8,10];let pendingSeek=null;
  video.poster=film.poster;
  $('#film-chapters').innerHTML=indices.map(i=>`<button type="button" data-film-chapter="${i}" aria-pressed="${i===0}"><span>${stamp(film.chapters[i].start)}</span><strong>${film.chapters[i].title}</strong><span aria-hidden="true">↗</span></button>`).join('');
  async function play(time=null){
    document.querySelector('#demo-video').pause();
    if(time!==null)pendingSeek=time;
    if(!video.getAttribute('src'))video.src=film.video;
    if(video.readyState>=1&&pendingSeek!==null){video.currentTime=pendingSeek;pendingSeek=null;}
    try{await video.play();$('#film-start').hidden=true;$('#film-status').textContent='';}
    catch{$('#film-status').textContent='Use the player controls to start the film.';}
  }
  video.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){video.currentTime=pendingSeek;pendingSeek=null;}});
  video.addEventListener('play',()=>{$('#film-start').hidden=true;});
  video.addEventListener('error',()=>{$('#film-status').textContent='The film could not load. Try again using the player controls.';});
  video.addEventListener('timeupdate',()=>{
    const selected=indices.filter(i=>film.chapters[i].start<=video.currentTime+.1).at(-1)??0;
    document.querySelectorAll('[data-film-chapter]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.filmChapter)===selected)));
  });
  $('#film-start').addEventListener('click',()=>play());
  $('#film-chapters').addEventListener('click',e=>{const b=e.target.closest('[data-film-chapter]');if(b){video.scrollIntoView({behavior:'instant',block:'center'});play(film.chapters[Number(b.dataset.filmChapter)].start);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)video.pause();}).observe(video);
  document.querySelector('#demo-video').addEventListener('play',()=>video.pause());
})();

// Animate only the source-bound SVG polylines, inside native web cards.
(() => {
  'use strict';
  const replay=window.MINE_ODYSSEY?.recoveryReplay;
  const stage=document.querySelector('#recovery-stage');
  if(!replay||!stage)return;
  const $=s=>document.querySelector(s);
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const state={caseId:'white-house',progress:motion.matches?1:0,wantsPlay:!motion.matches,inView:false,frame:0,last:null,hold:0,routes:[]};
  const status=message=>{$('#recovery-status').textContent=message;};
  function paint(){
    for(const route of state.routes){
      const distance=state.progress*route.length;
      let consumed=0,active=route.segments[0],localDistance=0;
      for(const segment of route.segments){
        const part=Math.max(0,Math.min(segment.length,distance-consumed));
        for(const path of segment.layers){
          path.style.strokeDasharray=`${segment.length} ${segment.length}`;
          path.style.strokeDashoffset=String(segment.length-part);
          path.style.visibility=part>0?'visible':'hidden';
        }
        if(distance>=consumed){active=segment;localDistance=part;}
        consumed+=segment.length;
      }
      const point=active.line.getPointAtLength(localDistance);
      route.dot.setAttribute('cx',point.x);route.dot.setAttribute('cy',point.y);
    }
    const percent=Math.round(state.progress*100);
    $('#recovery-progress').value=String(Math.round(state.progress*1000));
    $('#recovery-progress').setAttribute('aria-valuetext',`${percent} percent of displayed route`);
    $('#recovery-percent').value=`${percent}%`;
  }
  function mount(caseId){
    const selected=replay.cases.find(c=>c.id===caseId);
    state.caseId=caseId;state.hold=0;
    // Only scene geometry is SVG; responsive cards, headings and notes are HTML.
    const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    $('#recovery-case-title').textContent=selected.title;
    $('#recovery-case-description').textContent=selected.description;
    $('#recovery-case-task').textContent=selected.task;
    stage.innerHTML=selected.routes.map((route,i)=>`<article class="route-card ${i?'route-recovered':'route-searching'}"><header><h4>${escapeHTML(route.model)}</h4><span>${escapeHTML(route.outcome)}</span></header><div class="route-scene">${route.svg}</div><p class="route-span">${escapeHTML(route.span)}</p></article>`).join('');
    stage.querySelectorAll('[data-background]').forEach(img=>{
      img.setAttributeNS('http://www.w3.org/1999/xlink','href',replay.images[img.dataset.background]);
    });
    state.routes=selected.routes.map(route=>{
      const lines=[...stage.querySelectorAll(`[data-replay-route="${route.id}"][data-replay-layer="line"]`)];
      const segments=lines.map(line=>({line,length:line.getTotalLength(),layers:[...stage.querySelectorAll(`[data-replay-route="${route.id}"][data-replay-segment="${line.dataset.replaySegment}"]`)]}));
      return {segments,length:segments.reduce((n,s)=>n+s.length,0),dot:stage.querySelector(`[data-replay-dot="${route.id}"]`)};
    });
    document.querySelectorAll('[data-recovery-case]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.recoveryCase===caseId)));
    paint();
  }
  function active(){return state.wantsPlay&&state.inView&&!document.hidden;}
  function tick(now){
    state.frame=0;if(!active())return;
    const delta=state.last===null?0:Math.min(now-state.last,100);state.last=now;
    if(state.progress>=1){
      state.hold+=delta;
      if(state.hold>=2200){state.progress=0;state.hold=0;}
    }else{
      state.progress=Math.min(1,state.progress+delta/(replay.duration_seconds*1000)*Number($('#recovery-speed').value));
    }
    paint();state.frame=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(state.frame);state.frame=0;state.last=null;
    // Observer deliveries can be queued across resizes or screenshot captures.
    // Recheck current geometry so a visible Play/Restart always takes effect.
    const rect=$('.recovery-player').getBoundingClientRect();
    state.inView=rect.bottom>0&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth;
    const playing=active();
    $('#recovery-play').textContent=playing?'Pause':'Play';
    $('#recovery-play').setAttribute('aria-pressed',String(playing));
    if(playing)state.frame=requestAnimationFrame(tick);
  }
  $('#recovery-play').addEventListener('click',()=>{
    state.wantsPlay=!active();if(state.wantsPlay&&state.progress>=1){state.progress=0;state.hold=0;paint();}
    status(state.wantsPlay?'Route replay playing.':'Route replay paused.');sync();
  });
  $('#recovery-restart').addEventListener('click',()=>{
    state.progress=0;state.hold=0;state.wantsPlay=true;paint();sync();status('Route replay restarted.');
  });
  $('#recovery-progress').addEventListener('input',e=>{
    state.wantsPlay=false;state.progress=Number(e.target.value)/1000;state.hold=0;paint();sync();
  });
  $('#recovery-speed').addEventListener('change',()=>{state.last=null;});
  document.querySelectorAll('[data-recovery-case]').forEach(b=>b.addEventListener('click',()=>{
    state.progress=motion.matches?1:0;mount(b.dataset.recoveryCase);sync();
    status(`${replay.cases.find(c=>c.id===state.caseId).label} route comparison selected.`);
  }));
  document.addEventListener('visibilitychange',sync);
  motion.addEventListener('change',e=>{
    if(e.matches){state.wantsPlay=false;state.progress=1;paint();sync();}
  });
  mount(state.caseId);
  if('IntersectionObserver' in window){
    new IntersectionObserver(sync,{threshold:0.15}).observe($('.recovery-player'));
  }else{state.inView=true;state.wantsPlay=false;sync();}
})();

// Short original recordings play only while a card is hovered or keyboard-focused.
(() => {
  const $=s=>document.querySelector(s),dialog=$('#image-dialog'),large=$('#dialog-world-video');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),touch=matchMedia('(hover: none)');
  let active=null,cards=[],generation=0,dialogGeneration=0,listeners=new AbortController();
  function reset(video){video.pause();if(video.readyState>0)video.currentTime=0;}
  function stop(){
    generation++;
    if(active){active.classList.remove('is-previewing');reset(active.querySelector('video'));active=null;}
  }
  async function start(card){
    if(reduced.matches||document.hidden||dialog.open||!card.isConnected)return;
    if(active===card)return;
    stop();active=card;const ticket=generation,video=card.querySelector('video');
    video.muted=true;
    if(!video.getAttribute('src'))video.src=video.dataset.src;
    try{
      await video.play();
      if(ticket!==generation||active!==card){if(active!==card)video.pause();return;}
      card.classList.add('is-previewing');
    }catch{
      if(ticket===generation&&active===card){card.classList.remove('is-previewing');active=null;}
    }
  }
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const entry of entries)if(!entry.isIntersecting&&entry.target===active){
      // Filtering and scrolling can leave queued entries for an earlier layout.
      const r=active.getBoundingClientRect();
      if(r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)stop();
    }
  }):null;
  function mount(){
    stop();observer?.disconnect();listeners.abort();listeners=new AbortController();
    const options={signal:listeners.signal};
    for(const card of cards){const video=card.querySelector('video');video.removeAttribute('src');video.load();}
    cards=[...document.querySelectorAll('.world-card')];
    for(const card of cards){
      card.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')start(card);},options);
      card.addEventListener('pointerleave',()=>{if(active===card)stop();},options);
      card.addEventListener('focus',()=>{if(card.matches(':focus-visible'))start(card);},options);
      card.addEventListener('blur',()=>{if(active===card)stop();},options);
      card.querySelector('video').addEventListener('playing',()=>{if(active!==card)reset(card.querySelector('video'));},options);
      observer?.observe(card);
    }
    document.querySelectorAll('.hover-instruction').forEach(el=>el.textContent=touch.matches||reduced.matches?'Click to play':'Hover to play');
  }
  document.addEventListener('worlds-rendered',mount);
  document.addEventListener('preview-dialog-open',async()=>{
    const ticket=++dialogGeneration;
    stop();reset(large);large.removeAttribute('src');large.load();
    const world=window.MINE_ODYSSEY.maps.find(m=>m.id===dialog.dataset.world);
    large.hidden=!world;$('#dialog-image').hidden=Boolean(world);
    $('#dialog-video-status').textContent='';
    dialog.classList.toggle('world-preview-dialog',Boolean(world));
    if(!world)return;
    large.poster=world.image;large.src=world.preview.video;large.muted=true;
    try{await large.play();if(!dialog.open&&ticket===dialogGeneration)large.pause();}
    catch{if(dialog.open&&ticket===dialogGeneration)$('#dialog-video-status').textContent='Press Play to start the recorded preview.';}
  });
  large.addEventListener('error',()=>{if(dialog.open)$('#dialog-video-status').textContent='The recording could not load. Close and reopen this preview to retry.';});
  dialog.addEventListener('close',()=>{dialogGeneration++;reset(large);large.removeAttribute('src');large.load();large.hidden=true;$('#dialog-image').hidden=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();large.pause();}});
  reduced.addEventListener('change',mount);touch.addEventListener('change',mount);
  mount();
})();

// Appendix replays: chronological observations and the exact adopted stair path.
(() => {
  const data=window.MINE_ODYSSEY?.appendixReplay;if(!data)return;
  const $=s=>document.querySelector(s), stage=$('#appendix-stage');
  const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const state={selected:null,progress:0,index:-1,wantsPlay:!motion.matches,raf:0,last:null,hold:0,segments:[],stops:[]};
  $('#appendix-menu').innerHTML=data.cases.map((c,i)=>`<button type="button" data-appendix-case="${c.id}" aria-pressed="false"><span>${String(i+1).padStart(2,'0')}</span><strong>${escapeHTML(c.title)}</strong><small>${escapeHTML(c.place.split(' · ')[0])}</small></button>`).join('');
  const command=v=>escapeHTML(v.replace(/ && /g,' &&\n').replace(/; /g,';\n'));
  function renderFrame(index){
    const c=state.selected;
    stage.innerHTML=`<div class="appendix-frames ${c.tracks.length===2?'paired':''}">${c.tracks.map(t=>{
      const f=t.frames[Math.min(index,t.frames.length-1)];
      return `<figure><div class="appendix-frame-heading"><strong>${escapeHTML(t.model)}</strong><span>${escapeHTML(f.label)}</span></div><div class="appendix-photo"><img src="${data.images[f.image]}" alt="${escapeHTML(f.caption)}" width="800" height="600">${f.overlay?'<svg class="pixel-diagram" viewBox="0 0 800 600" aria-label="Logged pixel offsets to an estimated goal, not a travelled path"><path id="pixel-offset-path" fill="none" stroke="#ffe19a" stroke-width="4" stroke-dasharray="8 5"/><circle cx="401.67" cy="305.21" r="11" fill="#187d65" stroke="white" stroke-width="2"/><circle cx="462.5" cy="439" r="11" fill="#b5680a" stroke="white" stroke-width="2"/><text x="401.67" y="310" text-anchor="middle" fill="white" font-size="14">S</text><text x="462.5" y="444" text-anchor="middle" fill="white" font-size="14">G</text></svg>':''}</div><figcaption>${escapeHTML(f.caption)}</figcaption>${f.command?`<details class="appendix-command"><summary>Original command</summary><pre>${command(f.command)}</pre></details>`:''}</figure>`;
    }).join('')}</div>`;
  }
  function paint(){
    const c=state.selected;
    let index=0;
    if(c.kind==='route'){
      const total=state.segments.reduce((n,s)=>n+s.length,0),distance=state.progress*total;
      let consumed=0,active=state.segments[0],local=0;
      state.segments.forEach((s,i)=>{
        const part=Math.max(0,Math.min(s.length,distance-consumed));
        s.layers.forEach(p=>{p.style.strokeDasharray=`${s.length} ${s.length}`;p.style.strokeDashoffset=String(s.length-part);p.style.visibility=part>0?'visible':'hidden';});
        if(distance>=consumed){active=s;local=part;index=i;}consumed+=s.length;
      });
      const point=active.line.getPointAtLength(local),dot=stage.querySelector('[data-appendix-dot]');
      dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);
      stage.querySelectorAll('[data-stair-command]').forEach((e,i)=>e.classList.toggle('current',i===index));
    }else{
      const count=c.tracks[0].frames.length;
      index=Math.min(count-1,Math.floor(state.progress*count));
      if(index!==state.index)renderFrame(index);
      const offset=$('#pixel-offset-path');
      if(offset){
        const amount=Math.min(1,(state.progress*count-index)*1.4),x=401.67+Math.min(1,amount*2)*60.83,y=305.21+Math.max(0,amount*2-1)*133.79;
        offset.setAttribute('d',`M401.67 305.21 L${x} 305.21${amount>.5?` L462.5 ${y}`:''}`);
      }
    }
    state.index=index;
    document.querySelectorAll('[data-appendix-stop]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    $('#appendix-progress').value=String(Math.round(state.progress*1000));
    $('#appendix-progress').setAttribute('aria-valuetext',`${Math.round(state.progress*100)} percent; stage ${index+1} of ${state.stops.length}`);
    $('#appendix-percent').value=`${Math.round(state.progress*100)}%`;
  }
  function mount(id){
    const c=data.cases.find(x=>x.id===id);state.selected=c;state.index=-1;state.hold=0;state.progress=motion.matches&&c.kind==='route'?1:0;
    $('#appendix-place').textContent=c.place;$('#appendix-title').textContent=c.title;$('#appendix-description').textContent=c.description;$('#appendix-note').textContent=c.note;
    $('#appendix-kind').textContent=c.kind==='route'?'Recorded route · Progressive replay':'Original observations · Step sequence';
    stage.dataset.case=c.id;
    if(c.kind==='route'){
      stage.innerHTML=`<div class="appendix-route"><div class="appendix-route-scene">${c.svg}</div><div class="appendix-route-commands">${c.commands.map((cmd,i)=>`<article data-stair-command="${i}"><p class="eyebrow">Step ${cmd.step}</p><h4>${escapeHTML(cmd.caption)}</h4><pre>${command(cmd.text)}</pre></article>`).join('')}</div></div>`;
      stage.querySelectorAll('[data-appendix-background]').forEach(img=>img.setAttributeNS('http://www.w3.org/1999/xlink','href',data.images[img.dataset.appendixBackground]));
      state.segments=[...stage.querySelectorAll('[data-layer="line"]')].map(line=>({line,length:line.getTotalLength(),layers:[...stage.querySelectorAll(`[data-appendix-segment="${line.dataset.appendixSegment}"]`)]}));
      const total=state.segments.reduce((n,s)=>n+s.length,0);
      state.stops=[0,state.segments[0].length/total];
    }else{
      state.stops=c.tracks[0].frames.map((_,i,a)=>i/a.length);
      c.tracks.flatMap(t=>t.frames).forEach(f=>{const img=new Image();img.src=data.images[f.image];});
    }
    $('#appendix-timeline').innerHTML=state.stops.map((_,i)=>`<button type="button" data-appendix-stop="${i}" aria-pressed="false">${c.kind==='route'?`Step ${c.commands[i].step}`:`${String(i+1).padStart(2,'0')} / ${c.tracks[0].frames[i].label}`}</button>`).join('');
    document.querySelectorAll('[data-appendix-case]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.appendixCase===id)));
    paint();sync();
  }
  function active(){const r=$('.appendix-main').getBoundingClientRect();return state.wantsPlay&&!document.hidden&&r.bottom>80&&r.top<innerHeight;}
  function tick(now){
    state.raf=0;if(!active()){sync();return;}
    const dt=state.last===null?0:Math.min(100,now-state.last);state.last=now;
    const duration=state.selected.kind==='route'?data.route_seconds:data.frame_seconds*state.stops.length;
    if(state.progress>=1){state.hold+=dt;if(state.hold>1600){state.progress=0;state.hold=0;}}
    else state.progress=Math.min(1,state.progress+dt/(duration*1000)*Number($('#appendix-speed').value));
    paint();state.raf=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(state.raf);state.raf=0;state.last=null;
    const playing=active();$('#appendix-play').textContent=playing?'Pause':'Play';$('#appendix-play').setAttribute('aria-pressed',String(playing));
    if(playing)state.raf=requestAnimationFrame(tick);
  }
  $('#appendix-menu').addEventListener('click',e=>{const b=e.target.closest('[data-appendix-case]');if(b){mount(b.dataset.appendixCase);$('#appendix-status').textContent=`${state.selected.title} selected.`;}});
  $('#appendix-timeline').addEventListener('click',e=>{const b=e.target.closest('[data-appendix-stop]');if(b){state.wantsPlay=false;state.hold=0;state.progress=state.stops[Number(b.dataset.appendixStop)]+.00001;paint();sync();}});
  $('#appendix-play').addEventListener('click',()=>{state.wantsPlay=!active();if(state.wantsPlay&&state.progress>=1){state.progress=0;state.hold=0;paint();}sync();});
  $('#appendix-restart').addEventListener('click',()=>{state.progress=0;state.hold=0;state.wantsPlay=true;paint();sync();});
  $('#appendix-progress').addEventListener('input',e=>{state.progress=Number(e.target.value)/1000;state.wantsPlay=false;state.hold=0;paint();sync();});
  $('#appendix-speed').addEventListener('change',()=>{state.last=null;});
  document.addEventListener('visibilitychange',sync);
  motion.addEventListener('change',e=>{if(e.matches){state.wantsPlay=false;sync();}});
  mount(data.cases[0].id);
  if('IntersectionObserver' in window)new IntersectionObserver(sync,{threshold:[0,.15]}).observe($('.appendix-main'));
})();
