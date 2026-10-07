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
  function openImage(src,title,description,world=false,scene=null) {
    dialog.dataset.world=String(world);dialog.dataset.scene=scene||'';
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
    openImage(m.image,m.name,`${m.location} · ${m.environment} · ${m.task_count} tasks · ${m.waypoint_count} catalogued waypoints. 6-second excerpt from a recorded run · Original speed. Cover photograph is a separate presentation view.`,m.id);
  });
  const tasks=data.journeys.examples;
  let taskIndex=0,taskStop=0,originalInstruction=true,taskView='map',taskRule='';
  const stopLabel=(s,i)=>i===0?'Starting point':s.role==='finish'?'04 / Final destination':`${String(i).padStart(2,'0')} / Checkpoint`;
  function renderTaskRule(){
    const task=tasks[taskIndex],stop=task.stops[taskStop];
    $('#task-explorer').dataset.rule=taskRule;
    $('#task-rule-feedback').hidden=!taskRule;
    text('#task-rule-caption',taskRule==='waypoint'?`${taskStop===0?'S':taskStop} · ${stop.name} · (x, y, z) = (${stop.position.join(', ')})`:
      taskRule==='order'?'Required visit order: S → 1 → 2 → 3 → 4':
      taskRule==='completion'?'Visit every required destination in order, then submit an accepted claim_done.':'');
  }
  function showTaskRule(rule,index=taskStop,scroll=true){
    taskRule=rule;
    setTaskStop(rule==='completion'?tasks[taskIndex].stops.length-1:rule==='order'?0:index);
    setTaskView('map');
    if(scroll){
      const target=rule==='completion'?$('#task-completion'):$('#task-explorer');
      target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:rule==='completion'?'center':'start'});
    }
  }
  function setInstruction() {
    const task=tasks[taskIndex],isEnglish=task.locale.startsWith('en');
    text('#task-prompt',originalInstruction?task.original_prompt:task.prompt);
    $('#task-prompt').lang=originalInstruction?task.locale:'en';
    text('#task-language-label',isEnglish?'Original · English':originalInstruction?`Original · ${task.language}`:`English translation · Original in ${task.language}`);
    text('#task-language',originalInstruction?'Read English translation':`Read ${task.language} original`);
    $('#task-language').hidden=isEnglish;
    $('#task-language').setAttribute('aria-pressed',String(originalInstruction));
  }
  function setTaskView(view,explicitPlay=false) {
    taskView=view;const task=tasks[taskIndex],m=data.maps.find(m=>m.id===task.map);
    if(view==='scene'){taskRule='';renderTaskRule();}
    $('#task-map').hidden=view!=='map';$('#task-scene').hidden=view!=='scene';
    $('.task-selected').hidden=view==='scene';$('#task-photo-caption').hidden=view==='scene';
    pressed('[data-task-view]','taskView',view);
    text('#task-photo-caption',view==='scene'?'':'Native map · Dashed lines show visit order, not a walkable route.');
    document.dispatchEvent(new CustomEvent('task-view-changed',{detail:{taskIndex,taskStop,view,explicitPlay}}));
  }
  function setTaskStop(index) {
    taskStop=Math.max(0,Math.min(tasks[taskIndex].stops.length-1,index));
    const task=tasks[taskIndex],s=task.stops[taskStop],dy=s.position[1]-task.stops[0].position[1];
    pressed('[data-task-stop]','taskStop',taskStop);
    text('#task-stop-role',stopLabel(s,taskStop));text('#task-stop-title',s.name);text('#task-stop-purpose',s.purpose);
    text('#task-stop-height',`${s.original_name} · ${dy===0?'Same target height as start':`${Math.abs(dy)} ${Math.abs(dy)===1?'block':'blocks'} ${dy>0?'above':'below'} the start`}`);
    $('#task-prev').disabled=taskStop===0;$('#task-next').disabled=taskStop===task.stops.length-1;
    $$('#task-map-lines [data-leg]').forEach(p=>p.classList.toggle('is-selected',Number(p.dataset.leg)===taskStop));
    $$('#task-map-lines [data-map-stop]').forEach(p=>p.classList.toggle('is-selected',Number(p.dataset.mapStop)===taskStop));
    renderTaskRule();
  }
  function renderTaskIntroduction() {
    const task=data.journeys.introduction,m=data.maps.find(m=>m.id===task.map);
    text('#contract-place',m.name);
    text('#contract-setting',task.setting.split(' · ').at(-1));
    text('#contract-instruction',task.summary);
    $('#contract-instruction').lang=task.locale;
    const [viewWidth,viewHeight]=task.map_viewbox;
    const [left,top,right,bottom]=task.crop,[dl,dt,dr,db]=task.display_crop||task.crop;
    const frame=[(dl-left)/(right-left)*viewWidth,(dt-top)/(bottom-top)*viewHeight,(dr-dl)/(right-left)*viewWidth,(db-dt)/(bottom-top)*viewHeight];
    $('.contract-native-map').style.aspectRatio=`${frame[2]} / ${frame[3]}`;
    $('#contract-map-overlay').setAttribute('viewBox',frame.join(' '));
    Object.assign($('#contract-map-image').style,{left:`${-frame[0]/frame[2]*100}%`,top:`${-frame[1]/frame[3]*100}%`,width:`${viewWidth/frame[2]*100}%`,height:`${viewHeight/frame[3]*100}%`});
    $('.task-contract-flow').setAttribute('aria-label',`Animated task format: start, visit ${task.stops.length-1} destinations in order, then claim completion`);
    $('#contract-map-image').src=task.map_image;$('#contract-map-image').alt=`Native map of ${m.name} with the task's ordered destinations`;
    $('#contract-destinations').lang=task.locale;
    $('#contract-destinations').innerHTML=task.stops.map((s,i)=>`<li class="contract-stop" data-contract-stop="${i}"><span class="contract-number">${i===0?'S':i}</span><span>${escapeHTML(s.original_name)}</span></li>`).join('');
    $('#contract-map-overlay').innerHTML=task.stops.slice(1).map((s,i)=>`<path class="contract-map-leg" d="M ${task.stops[i].anchor.join(' ')} L ${s.anchor.join(' ')}"/>`).join('')+task.stops.map((s,i)=>`<g data-contract-marker="${i}"><path class="contract-map-leader" d="M ${s.anchor.join(' ')} L ${s.marker.join(' ')}"/><circle class="contract-map-anchor" cx="${s.anchor[0]}" cy="${s.anchor[1]}" r="5"/><circle class="contract-map-pin" cx="${s.marker[0]}" cy="${s.marker[1]}" r="26"/><text x="${s.marker[0]}" y="${s.marker[1]}" dy=".35em">${i===0?'S':i}</text></g>`).join('');
  }
  function setTask(index) {
    taskIndex=index;originalInstruction=true;taskRule='';
    const task=tasks[index],m=data.maps.find(m=>m.id===task.map);
    text('#task-meta',task.id);text('#task-title',task.title);text('#task-setting',task.setting);
    setInstruction();
    $('#task-map-image').src=task.map_image;$('#task-map-image').alt=`Native top-down map of ${m.name}; numbered task destinations are listed alongside`;
    $('#task-stops').innerHTML=task.stops.map((s,i)=>`<li>${i?`<button type="button" class="task-watch-leg" data-watch-leg="${i-1}" aria-label="Watch ${escapeHTML(task.stops[i-1].name)} to ${escapeHTML(s.name)}"><span aria-hidden="true">▶</span> Watch ${i===1?'S':i-1} → ${i}<span class="leg-watch-duration">Full leg</span></button>`:''}<button type="button" data-task-stop="${i}" aria-pressed="false"><span class="stop-number" aria-hidden="true">${i===0?'S':i}</span><span><small>${escapeHTML(stopLabel(s,i))}</small><strong>${escapeHTML(s.name)}</strong><span>${escapeHTML(s.purpose)}</span></span><span class="stop-arrow" aria-hidden="true">↗</span></button></li>`).join('');
    $('#task-markers').innerHTML=task.stops.map((s,i)=>`<button type="button" data-task-stop="${i}" aria-pressed="false" class="task-marker ${s.role}" style="left:${s.marker[0]/10}%;top:${s.marker[1]/6.67}%;--visit-index:${i}" aria-label="${escapeHTML(`${stopLabel(s,i)}: ${s.name}`)}" title="${escapeHTML(s.name)}">${i===0?'S':i}</button>`).join('');
    $('#task-map-lines').innerHTML=task.stops.map((s,i)=>`${i?`<path class="task-leg" data-leg="${i}" style="--visit-index:${i}" d="M ${task.stops[i-1].anchor.join(' ')} L ${s.anchor.join(' ')}"/>`:''}<path class="task-marker-leader" data-map-stop="${i}" d="M ${s.anchor.join(' ')} L ${s.marker.join(' ')}"/><circle class="task-anchor" data-map-stop="${i}" cx="${s.anchor[0]}" cy="${s.anchor[1]}" r="4"/>`).join('');
    text('#task-arrival',`Position samples are checked every ${task.arrival.sample_interval_sec} second. Arrival requires both a 3D distance of less than ${task.arrival.radius_3d} blocks and a height difference of at most ${task.arrival.radius_y} blocks from the target.`);
    $('.task-completion details').open=false;
    setTaskStop(0);setTaskView('map');
    pressed('[data-task]','task',index);
  }
  $$('[data-task]').forEach(b=>b.addEventListener('click',()=>setTask(Number(b.dataset.task))));
  $('.journey-explorer').addEventListener('click',e=>{const b=e.target.closest('[data-task-stop]');if(b)showTaskRule('waypoint',Number(b.dataset.taskStop),false);});
  $('#task-rule-clear').addEventListener('click',()=>{taskRule='';renderTaskRule();$('[data-task-view="map"]').focus({preventScroll:true});});
  $('#task-stops').addEventListener('click',e=>{const b=e.target.closest('[data-watch-leg]');if(b){setTaskStop(Number(b.dataset.watchLeg)+1);setTaskView('scene',true);}});
  document.addEventListener('task-scene-leg-selected',e=>setTaskStop(e.detail.index+1));
  $$('[data-task-view]').forEach(b=>b.addEventListener('click',()=>setTaskView(b.dataset.taskView)));
  $('#task-language').addEventListener('click',()=>{originalInstruction=!originalInstruction;setInstruction();});
  $('#task-prev').addEventListener('click',()=>{setTaskStop(taskStop-1);if(taskView==='scene')setTaskView('scene',true);});
  $('#task-next').addEventListener('click',()=>{setTaskStop(taskStop+1);if(taskView==='scene')setTaskView('scene',true);});
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
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)video.pause();}).observe(video);
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
  $('#terrain-scenes').innerHTML=data.scenes.map(s=>`<button class="terrain-card" data-scene-detail="${escapeHTML(s.id)}" type="button" aria-label="Enlarge ${escapeHTML(s.title)}"><span class="terrain-visual"><img src="${escapeHTML(s.image)}" alt="${escapeHTML(`${s.title} in ${s.place}`)}" width="640" height="480" loading="lazy"><video class="terrain-loop" data-src="${escapeHTML(s.preview.video)}" muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video><span class="terrain-loop-label">${s.preview.kind==='observation_pair'?'Before / after':`${s.preview.seconds}s loop`}</span>${s.preview.kind==='observation_pair'?'<span class="terrain-pair-phase" aria-hidden="true">Closed</span>':''}</span><span class="terrain-card-copy"><strong>${escapeHTML(s.title)}</strong><span>${escapeHTML(s.place)}</span><small>${escapeHTML(s.kind)}</small></span><span class="terrain-open" aria-hidden="true">↗</span></button>`).join('');
  $('#terrain-scenes').addEventListener('click',e=>{const b=e.target.closest('[data-scene-detail]');if(!b)return;const s=data.scenes.find(s=>s.id===b.dataset.sceneDetail);openImage(s.image,s.title,`${s.place} · ${s.description}. ${s.preview.description}`,false,s.id);});
  const menu=$('.menu-toggle'),nav=$('#navigation');
  function closeMenu(){menu.setAttribute('aria-expanded','false');nav.classList.remove('is-open');}
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  nav.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('is-open')){closeMenu();menu.focus();}});
  renderWorlds();renderTaskIntroduction();setTask(0);setClip(0);renderResults();
})();

// The complete project film loads on play or an explicit chapter selection.
(() => {
  const film=window.MINE_ODYSSEY.film,$=s=>document.querySelector(s),video=$('#showcase-video');
  const stamp=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const seconds=Math.round(film.duration_seconds);
  $('#film-summary').textContent=`${Math.floor(seconds/60)} min ${String(seconds%60).padStart(2,'0')} sec · ${film.maps} worlds. Tasks, terrain, ablation settings, agent programs and model comparisons.`;
  const indices=film.chapters.map((_,i)=>i);let pendingSeek=null;
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
  function active(){return state.wantsPlay&&state.inView&&!document.hidden&&!$('#route-case-panel').hidden;}
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
  document.addEventListener('case-selected',sync);
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
    const scene=window.MINE_ODYSSEY.scenes.find(s=>s.id===dialog.dataset.scene),item=scene||world;
    large.hidden=!item;$('#dialog-image').hidden=Boolean(item);
    $('#dialog-video-status').textContent='';
    dialog.classList.toggle('world-preview-dialog',Boolean(item));
    if(!item)return;
    large.setAttribute('aria-label',scene?`${scene.title} — ${scene.kind}`:'Recorded world preview');
    large.poster=item.image;large.src=item.preview.video;large.muted=true;
    try{await large.play();if(!dialog.open&&ticket===dialogGeneration)large.pause();}
    catch{if(dialog.open&&ticket===dialogGeneration)$('#dialog-video-status').textContent='Press Play to start the recorded preview.';}
  });
  large.addEventListener('error',()=>{if(dialog.open)$('#dialog-video-status').textContent='The recording could not load. Close and reopen this preview to retry.';});
  dialog.addEventListener('close',()=>{dialogGeneration++;reset(large);large.removeAttribute('src');large.load();large.hidden=true;$('#dialog-image').hidden=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();large.pause();}});
  reduced.addEventListener('change',mount);touch.addEventListener('change',mount);
  mount();
})();

// Programming cases share the case selector and retain source-bound geometry.
(() => {
  const data=window.MINE_ODYSSEY?.appendixReplay;if(!data)return;
  const $=s=>document.querySelector(s),stage=$('#appendix-stage');
  const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const state={selected:null,progress:0,index:-1,wantsPlay:!motion.matches,raf:0,last:null,hold:0,segments:[],stops:[]};
  const command=v=>escapeHTML(v.replace(/ && /g,' &&\n').replace(/; /g,';\n'));
  const loopCommand=v=>{
    let level=0;
    return escapeHTML(v.split('; ').map(part=>{
      if(part.startsWith('done'))level=Math.max(0,level-1);
      const line='  '.repeat(level)+part;
      if(/^(?:do )?for /.test(part))level++;
      return line;
    }).join(';\n').replace(/;\n$/, ''));
  };
  const number=v=>Number(v).toFixed(2).replace('-', '−');
  function mountStairs(c){
    const profile=c.samples.map(s=>`${16+s.progress*348},${94-(s.position[1]-40)*2.25}`).join(' ');
    const cards=c.commands.map((cmd,i)=>`<article data-stair-command="${i}"${i?' hidden':''}>
      <div class="program-card-heading"><strong>Step ${cmd.step}</strong><span>${i?'Reuse the sequence':'Compose the sequence'}</span></div>
      <p>${escapeHTML(cmd.caption)}</p>
      <div class="heading-sequence" aria-label="Four movement headings"><span>90°</span><b>→</b><span>180°</span><b>→</b><span>−90°</span><b>→</b><span>0°</span>${i?'<strong class="repeat-count">× 3</strong>':''}</div>
      <p class="command-context">Four forward movements · 1.3 seconds each</p>
      ${i?`<div class="loop-iterations">${[1,2,3].map(n=>`<span data-loop="${n}">Loop ${n}</span>`).join('')}</div>`:''}
      <details class="stair-command-source"><summary>Original command</summary><pre${i?' class="loop-code"':''}>${i?loopCommand(cmd.text):command(cmd.text)}</pre></details>
    </article>`).join('');
    stage.innerHTML=`<div class="program-layout stair-layout">
      <figure class="program-scene"><div class="program-card-heading"><strong>Recorded ascent</strong><span>Native-world cutaway</span></div><div class="appendix-route-scene">${c.svg}</div><figcaption><span class="step-key">Step 35 · one circuit</span><span class="step-key repeated">Step 36 · three circuits</span></figcaption></figure>
      <div class="program-inspector"><div class="ascent-status"><div><span id="stair-step">Step 35</span><strong id="stair-circuit">Circuit 1 / 4</strong></div><div><span>Last sampled height</span><strong id="stair-height">Y40</strong></div></div>
      <div class="ascent-profile"><svg viewBox="0 0 380 120" role="img" aria-label="Recorded height across the displayed path"><path d="M16 22H364 M16 40H364 M16 58H364 M16 76H364 M16 94H364" stroke="#dce3d5" fill="none"/><polyline points="${profile}" fill="none" stroke="#c0cbbc" stroke-width="2"/><polyline id="stair-height-trace" points="${profile}" fill="none" stroke="#247c71" stroke-width="3"/><path id="stair-profile-cursor" d="M16 15V100" stroke="#a06f1c" stroke-width="1.5"/><circle id="stair-profile-dot" cx="16" cy="94" r="4" fill="#247c71"/><text x="16" y="115">Y40</text><text x="334" y="115">Y72</text></svg><span>Recorded samples · Displayed route progress</span></div>
      <div class="stair-landings">${c.landings.map((l,i)=>`<span data-landing="${i}"><i></i>Y${l.height}</span>`).join('')}</div>
      <div class="program-command-cards">${cards}</div></div></div>`;
    stage.querySelectorAll('.stair-command-source').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open){state.wantsPlay=false;sync();}}));
    stage.querySelectorAll('[data-appendix-background]').forEach(img=>img.setAttributeNS('http://www.w3.org/1999/xlink','href',data.images[img.dataset.appendixBackground]));
    state.segments=[...stage.querySelectorAll('[data-layer="line"]')].map(line=>({line,length:line.getTotalLength(),layers:[...stage.querySelectorAll(`[data-appendix-segment="${line.dataset.appendixSegment}"]`)]}));
    state.stops=c.landings.slice(0,-1).map(l=>l.progress);
  }
  function mountGrounding(c){
    const calc=c.calculation,t=calc.targets.find(t=>t.target==='U20'),s=calc.arrow_center,g=t.input_pixel_tip,frames=c.tracks[0].frames;
    const dx=g[0]-s[0],dy=g[1]-s[1];
    stage.innerHTML=`<div class="program-layout grounding-layout"><figure class="program-scene"><div class="program-card-heading"><strong>Ueno Park · U20</strong><span>Calculation illustration</span></div><div class="appendix-photo grounding-map"><img src="${data.images[frames[0].image]}" alt="Original contextual map of Ueno Park" width="800" height="600"><svg class="pixel-diagram" viewBox="0 0 800 600" role="img" aria-label="Logged pixel positions and offsets; not an executed route"><path id="pixel-offset-path" d="" fill="none" stroke="#ffe19a" stroke-width="4" stroke-dasharray="8 5"/><g class="pixel-marker" data-pixel-marker="start"><circle cx="${s[0]}" cy="${s[1]}" r="18" fill="none" stroke="#fff" stroke-width="2"/><circle cx="${s[0]}" cy="${s[1]}" r="11" fill="#187d65" stroke="white" stroke-width="2"/><text x="${s[0]}" y="${s[1]+5}" text-anchor="middle">S</text></g><g class="pixel-marker" data-pixel-marker="goal"><circle cx="${g[0]}" cy="${g[1]}" r="18" fill="none" stroke="#ffe19a" stroke-width="2"/><circle cx="${g[0]}" cy="${g[1]}" r="11" fill="#a06f1c" stroke="white" stroke-width="2"/><text x="${g[0]}" y="${g[1]+5}" text-anchor="middle">G</text></g><g id="pixel-x-label"><rect x="${s[0]-46}" y="${s[1]-49}" width="148" height="26" rx="4"/><text x="${s[0]+28}" y="${s[1]-31}" text-anchor="middle">Δu = ${number(dx)} px</text></g><g id="pixel-y-label"><rect x="${g[0]+25}" y="${s[1]+52}" width="151" height="26" rx="4"/><text x="${g[0]+100}" y="${s[1]+70}" text-anchor="middle">Δv = ${number(dy)} px</text></g></svg></div><figcaption><span>S · Player</span><span>G · Estimated U20 goal</span><small>Illustration of the recorded pixel calculation.</small></figcaption></figure><div class="program-inspector grounding-inspector"><div class="grounding-phase"><span id="grounding-step">Step 176</span><h4 id="grounding-phase-title">Capture the map</h4></div><div class="grounding-observe" data-grounding-phase="0"><p>Logged pixel positions</p><dl class="coordinate-list"><div><dt>Player S</dt><dd>(${number(s[0])}, ${number(s[1])})</dd></div><div><dt>Goal G</dt><dd>(${number(g[0])}, ${number(g[1])})</dd></div></dl><p class="command-context">Map capture command · Step 176<br>Pixel values returned at Step 177</p><pre>${command(c.code.capture)}</pre></div><div data-grounding-phase="1" hidden><p>Subtract the player position</p><div class="equation-row"><span>Δu</span><strong>${number(g[0])} − ${number(s[0])}</strong><b>${number(dx)} px</b></div><div class="equation-row"><span>Δv</span><strong>${number(g[1])} − ${number(s[1])}</strong><b>${number(dy)} px</b></div><p class="command-context">Dashed guides show the logged pixel offsets.</p></div><div data-grounding-phase="2" hidden><p>Convert using the adopted scale</p><div class="scale-value"><strong>${calc.scale}</strong><span>pixels / block · assumed scale</span></div><div class="equation-row"><span>Δx</span><strong>${number(dx)} ÷ ${calc.scale}</strong><b>${number(t.delta[0])}</b></div><div class="equation-row"><span>Δz</span><strong>${number(dy)} ÷ ${calc.scale}</strong><b>${number(t.delta[1])}</b></div><pre>${escapeHTML(c.code.formula)}</pre></div><div data-grounding-phase="3" hidden><figure class="execution-observation"><img src="${data.images[frames[2].image]}" alt="Original observation following Step 181" width="800" height="600"><figcaption>Original observation · Step 181</figcaption></figure><pre>${escapeHTML(c.code.orientation)}</pre><p class="command-context">Step 179 orients toward the estimate; Step 181 moves toward the rounded goal (${t.world[0].toFixed(1).replace('-', '−')}, ${t.world[1].toFixed(1)}).</p></div><div class="estimated-target" id="estimated-target"><span>Estimated world target · (x, z)</span><strong>(${number(t.world[0])}, ${number(t.world[1])})</strong><small>Origin (${number(calc.world_origin[0])}, ${number(calc.world_origin[1])}) + calculated offsets</small></div></div></div>`;
    state.stops=[0,.25,.5,.75];
  }
  function paint(){
    const c=state.selected;let index=0;
    if(c.kind==='route'){
      const total=state.segments.reduce((n,s)=>n+s.length,0),distance=state.progress*total;
      let consumed=0,active=state.segments[0],local=0,commandIndex=0;
      for(const [i,s] of state.segments.entries()){
        const part=Math.max(0,Math.min(s.length,distance-consumed));
        s.layers.forEach(p=>{p.style.strokeDasharray=`${s.length} ${s.length}`;p.style.strokeDashoffset=String(s.length-part);p.style.visibility=part>0?'visible':'hidden';});
        if(distance>=consumed){active=s;local=part;commandIndex=i;}consumed+=s.length;
      }
      const point=active.line.getPointAtLength(local),dot=stage.querySelector('[data-appendix-dot]');
      dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);
      index=Math.min(3,state.stops.filter(p=>state.progress>=p).length-1);
      const sample=c.samples.filter(s=>s.progress<=state.progress+1e-6).at(-1)||c.samples[0];
      $('#stair-height').textContent=`Y${Number(sample.position[1].toFixed(1))}`;
      $('#stair-step').textContent=`Step ${commandIndex?36:35}`;$('#stair-circuit').textContent=`Circuit ${index+1} / 4`;
      stage.querySelectorAll('[data-stair-command]').forEach((e,i)=>{e.classList.toggle('current',i===commandIndex);e.hidden=i!==commandIndex;if(e.hidden)e.querySelector('details').open=false;});
      stage.querySelectorAll('[data-loop]').forEach(e=>{e.classList.toggle('current',Number(e.dataset.loop)===index);e.classList.toggle('complete',Number(e.dataset.loop)<index||state.progress===1);});
      stage.querySelectorAll('[data-landing],[data-stair-landing]').forEach(e=>{const i=Number(e.dataset.landing??e.dataset.stairLanding);e.classList.toggle('reached',state.progress+1e-6>=c.landings[i].progress);});
      const trace=$('#stair-height-trace');
      // Clip by horizontal progress, rather than by chart path length.
      trace.style.clipPath=`inset(0 ${Math.max(0,100-(16+348*state.progress)/380*100)}% 0 0)`;
      const x=16+state.progress*348;
      $('#stair-profile-cursor').setAttribute('d',`M${x} 15V100`);
      $('#stair-profile-dot').setAttribute('cx',16+sample.progress*348);$('#stair-profile-dot').setAttribute('cy',94-(sample.position[1]-40)*2.25);
    }else{
      index=Math.min(3,Math.floor(state.progress*4));
      const names=['Capture the map','Measure pixel offsets','Compute a world target','Use the estimate'];
      $('#grounding-step').textContent=['Step 176 → 177','Step 177','Step 177','Steps 179 / 181'][index];
      $('#grounding-phase-title').textContent=names[index];
      stage.querySelectorAll('[data-grounding-phase]').forEach(e=>e.hidden=Number(e.dataset.groundingPhase)!==index);
      const calc=c.calculation,s=calc.arrow_center,g=calc.targets.find(t=>t.target==='U20').input_pixel_tip;
      const amount=index===0?0:index===1?Math.min(1,(state.progress*4-1)*1.4):1;
      const x=s[0]+Math.min(1,amount*2)*(g[0]-s[0]),y=s[1]+Math.max(0,amount*2-1)*(g[1]-s[1]);
      $('#pixel-offset-path').setAttribute('d',`M${s[0]} ${s[1]} L${x} ${s[1]}${amount>.5?` L${g[0]} ${y}`:''}`);
      $('#pixel-x-label').style.opacity=amount>.15?'1':'0';$('#pixel-y-label').style.opacity=amount>.65?'1':'0';
      $('#estimated-target').hidden=index<2;
      stage.querySelector('.grounding-map').classList.toggle('is-detail',index===1||index===2);
      stage.querySelectorAll('.pixel-marker').forEach(e=>e.classList.toggle('highlight',index<2));
    }
    state.index=index;
    document.querySelectorAll('[data-appendix-stop]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    $('#appendix-progress').value=String(Math.round(state.progress*1000));
    $('#appendix-progress').setAttribute('aria-valuetext',`${Math.round(state.progress*100)} percent; stage ${index+1} of ${state.stops.length}`);
    $('#appendix-percent').value=`${Math.round(state.progress*100)}%`;
  }
  function mount(id){
    const c=data.cases.find(x=>x.id===id);state.selected=c;state.index=-1;state.hold=0;state.progress=motion.matches?1:0;
    $('#appendix-place').textContent=c.place;$('#appendix-title').textContent=c.title;$('#appendix-description').textContent=c.description.split(/(?<=\.)\s/)[0];$('#appendix-note').textContent=c.note;
    $('#appendix-source-description').textContent=c.description;$('#appendix-source').open=false;
    $('#appendix-scope').textContent=c.kind==='route'?'Recorded path · Pauses omitted':'Coordinate estimate · Arrival not verified';
    $('#appendix-kind').textContent=c.kind==='route'?'Recorded route · Agent program':'Map observation · Agent calculation';stage.dataset.case=c.id;
    if(c.kind==='route')mountStairs(c);else mountGrounding(c);
    const labels=c.kind==='route'?['Step 35 · Y40 → Y48','Step 36 / Loop 1 · Y48 → Y56','Step 36 / Loop 2 · Y56 → Y64','Step 36 / Loop 3 · Y64 → Y72']:['01 / Map capture','02 / Pixel offsets','03 / World coordinates','04 / Execution'];
    $('#appendix-timeline').innerHTML=state.stops.map((_,i)=>`<button type="button" data-appendix-stop="${i}" aria-pressed="false">${labels[i]}</button>`).join('');
    paint();sync();
  }
  function active(){const r=$('.appendix-main').getBoundingClientRect();return state.wantsPlay&&!$('#appendix-cases').hidden&&!document.hidden&&r.bottom>80&&r.top<innerHeight;}
  function tick(now){
    state.raf=0;if(!active()){sync();return;}
    const dt=state.last===null?0:Math.min(100,now-state.last);state.last=now;
    const duration=state.selected.kind==='route'?data.route_seconds:data.frame_seconds*4;
    if(state.progress>=1){state.hold+=dt;if(state.hold>2200){state.progress=0;state.hold=0;}}
    else state.progress=Math.min(1,state.progress+dt/(duration*1000)*Number($('#appendix-speed').value));
    paint();state.raf=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(state.raf);state.raf=0;state.last=null;
    const playing=active();$('#appendix-play').textContent=playing?'Pause':'Play';$('#appendix-play').setAttribute('aria-pressed',String(playing));
    if(playing)state.raf=requestAnimationFrame(tick);
  }
  $('#case-menu').addEventListener('click',e=>{const b=e.target.closest('[data-appendix-case]');if(b){mount(b.dataset.appendixCase);$('#appendix-status').textContent=`${state.selected.title} selected.`;}});
  $('#appendix-timeline').addEventListener('click',e=>{const b=e.target.closest('[data-appendix-stop]');if(b){state.wantsPlay=false;state.hold=0;state.progress=state.stops[Number(b.dataset.appendixStop)]+.00001;paint();sync();}});
  $('#appendix-play').addEventListener('click',()=>{state.wantsPlay=!active();if(state.wantsPlay&&state.progress>=1){state.progress=0;state.hold=0;paint();}sync();});
  $('#appendix-restart').addEventListener('click',()=>{state.progress=0;state.hold=0;state.wantsPlay=true;paint();sync();});
  $('#appendix-progress').addEventListener('input',e=>{state.progress=Number(e.target.value)/1000;state.wantsPlay=false;state.hold=0;paint();sync();});
  $('#appendix-speed').addEventListener('change',()=>{state.last=null;});
  document.addEventListener('visibilitychange',sync);document.addEventListener('case-selected',sync);
  motion.addEventListener('change',e=>{if(e.matches){state.wantsPlay=false;state.progress=1;paint();sync();}});
  mount(data.cases[0].id);
  if('IntersectionObserver' in window)new IntersectionObserver(sync,{threshold:[0,.15]}).observe($('.appendix-main'));
})();

// Four cases, one accessible selector. Hidden panels cannot keep animating.
(() => {
  const menu=document.querySelector('#case-menu'),buttons=[...menu.querySelectorAll('[data-case]')];
  menu.setAttribute('aria-orientation','horizontal');
  function select(button){
    const programming=Boolean(button.dataset.appendixCase);
    document.querySelector('#route-case-panel').hidden=programming;
    document.querySelector('#appendix-cases').hidden=!programming;
    document.querySelector(programming?'#appendix-cases':'#route-case-panel').setAttribute('aria-labelledby',button.id);
    buttons.forEach(b=>{const selected=b===button;b.setAttribute('aria-selected',String(selected));b.setAttribute('aria-pressed',String(selected));b.tabIndex=selected?0:-1;});
    document.dispatchEvent(new Event('case-selected'));
  }
  menu.addEventListener('click',e=>{const b=e.target.closest('[data-case]');if(b)select(b);});
  menu.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    const i=buttons.indexOf(e.target);if(i<0)return;e.preventDefault();
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+buttons.length)%buttons.length;
    buttons[next].focus();buttons[next].click();
  });
  select(buttons[0]);
})();

// Task-specific scene clips: load only on Scene or Play, stop when hidden.
(() => {
  const $=s=>document.querySelector(s),video=$('#task-scene-video'),panel=$('#task-scene');
  const tasks=window.MINE_ODYSSEY.journeys.examples,motion=matchMedia('(prefers-reduced-motion: reduce)');
  let taskIndex=0,clipIndex=0,generation=0;
  const stamp=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const current=()=>tasks[taskIndex].scene.clips[clipIndex];
  function caption(){
    if(panel.hidden)return;
    const c=current();
    $('#task-scene-source').textContent=`${c.model} · ${c.hud_enabled?'HUD-enabled recording':'First-person recording'} · Source ${stamp(c.start_seconds)}–${stamp(c.start_seconds+c.length_seconds)} · ${video.playbackRate}×`;
  }
  function controls(){
    $('#task-scene-start').hidden=!video.paused;
    $('#task-scene-start').innerHTML=`<span aria-hidden="true">▶</span> ${video.ended?'Replay leg':video.currentTime>0?'Resume leg':'Play leg'}`;
  }
  async function play(){
    if(panel.hidden)return;
    video.scrollIntoView({behavior:'instant',block:'nearest'});
    const ticket=++generation;
    if(!video.getAttribute('src'))video.src=current().video;
    video.playbackRate=Number($('#task-scene-speed').value);
    $('#task-scene-status').textContent='Loading full leg…';
    try{
      await video.play();
      if(ticket!==generation||panel.hidden)return;
      $('#task-scene-status').textContent='';controls();
    }catch(error){
      if(ticket===generation&&!panel.hidden&&error.name!=='AbortError')$('#task-scene-status').textContent='Press Play to start this leg.';
      controls();
    }
  }
  function selectClip(index,autoplay=false){
    ++generation;video.pause();video.removeAttribute('src');video.load();clipIndex=index;
    const c=current();video.poster=c.poster;video.setAttribute('aria-label',`${c.title} · ${tasks[taskIndex].title} · ${c.model}`);
    $('#task-scene-title').textContent=c.title;$('#task-scene-description').textContent=c.description;
    $('#task-scene-duration').textContent=`${stamp(c.length_seconds)} · Full leg`;
    $('#task-scene-status').textContent='';
    $('#task-leg-counter').textContent=`${index===0?'S':index} → ${index+1} · ${index+1} / 4`;
    $('#task-leg-prev').disabled=index===0;$('#task-leg-next').disabled=index===3;
    if(!panel.hidden)document.dispatchEvent(new CustomEvent('task-scene-leg-selected',{detail:{index}}));
    document.querySelectorAll('[data-watch-leg]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.watchLeg)===index)));
    caption();controls();if(autoplay)play();
  }
  function mount(index){
    taskIndex=index;
    $('#task-scene-note').textContent=tasks[index].scene.note;
    $('#task-recording-options').open=false;
    selectClip(0);
  }
  document.addEventListener('task-view-changed',e=>{
    const index=Math.max(0,e.detail.taskStop-1);
    if(taskIndex!==e.detail.taskIndex)mount(e.detail.taskIndex);
    if(e.detail.view==='scene'){if(index!==clipIndex)selectClip(index);document.dispatchEvent(new CustomEvent('task-scene-leg-selected',{detail:{index}}));caption();if(e.detail.explicitPlay||!motion.matches)play();}
    else{++generation;video.pause();$('#task-scene-status').textContent='';}
  });
  $('#task-leg-prev').addEventListener('click',()=>selectClip(Math.max(0,clipIndex-1),true));
  $('#task-leg-next').addEventListener('click',()=>selectClip(Math.min(3,clipIndex+1),true));
  $('#task-scene-start').addEventListener('click',play);
  video.addEventListener('play',()=>{document.querySelectorAll('video').forEach(v=>{if(v!==video)v.pause();});controls();});
  video.addEventListener('playing',()=>{$('#task-scene-status').textContent='';controls();});
  video.addEventListener('pause',controls);
  video.addEventListener('ratechange',()=>{$('#task-scene-tag').textContent=`Full recording · ${video.playbackRate}×`;caption();});
  $('#task-scene-speed').addEventListener('change',e=>{video.playbackRate=Number(e.target.value);});
  video.addEventListener('ended',()=>{if(!panel.hidden&&$('#task-scene-autonext').checked&&clipIndex<tasks[taskIndex].scene.clips.length-1)selectClip(clipIndex+1,true);else{controls();$('#task-scene-status').textContent=clipIndex===3?'Final destination reached.':'Leg complete.';}});
  video.addEventListener('error',()=>{$('#task-scene-status').textContent='This scene could not load. Select a leg below to retry.';controls();});
  document.addEventListener('play',e=>{if(e.target instanceof HTMLVideoElement&&e.target!==video){++generation;video.pause();}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){++generation;video.pause();}});
  motion.addEventListener('change',()=>{if(motion.matches){++generation;video.pause();}});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{if(!entries[0].isIntersecting){++generation;video.pause();}},{threshold:0}).observe(video);
  mount(0);
})();

// Responsive diagram of the manuscript's agent loop and independent verifier.
(() => {
  const host=document.querySelector('#framework-diagram');
  const example=window.MINE_ODYSSEY.journeys.examples.find(t=>t.id==='copacabana-waterfront-001');
  const views={game:window.MINE_ODYSSEY.maps.find(m=>m.id===example.map).image,map:example.map_image};
  const box=(x,y,w,h,fill,stroke)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  const text=(x,y,value,size=14,color='var(--ink)',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${value}</text>`;
  function avatar(){
    return `<g class="framework-character" aria-hidden="true">
      <ellipse cx="55" cy="149" rx="44" ry="8" fill="#20212420"/>
      <path d="M34 100h21v42H34z" fill="#405f78"/><path d="M59 100h21v42H59z" fill="#344c65"/>
      <path d="M31 138h25v12H29v-8zM59 138h25l4 7v5H59z" fill="#202124"/>
      <path d="M31 50h48v55H31z" fill="#3b82f6"/><path d="m79 50 9-8v55l-9 8z" fill="#1d4ed8"/>
      <path d="m31 50 10-8h47l-9 8z" fill="#60a5fa"/>
      <path d="M14 54h17v36H14z" fill="#2563eb"/><path d="M15 87h16v20H15z" fill="#d6a477"/>
      <g class="avatar-arm"><path d="m79 53 15 1 5 25-17 4z" fill="#60a5fa"/><path d="m82 80 17-3 16 13-8 13-24-10z" fill="#e4b488"/><path d="m107 89 11-5 5 8-8 10-8 1z" fill="#edc297"/></g>
      <path d="M47 49h15v10H47z" fill="#cf996d"/><path d="m41 50 14 12 14-12" fill="none" stroke="#93c5fd" stroke-width="4"/>
      <rect x="46" y="70" width="22" height="14" rx="2" fill="var(--white)"/><text x="57" y="80" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink)">AI</text>
      <path d="m35 11 10-9h36l-10 9z" fill="#715143"/><path d="m71 11 10-9v35l-10 9z" fill="#bd875d"/>
      <path d="M35 11h36v35H35z" fill="#ecc49b"/><path d="M35 11h36v10H43v7h-8z" fill="#533e35"/><path d="m71 11 10-9v15l-10 10z" fill="#624638"/>
      <g class="avatar-eyes"><path d="M45 27h6v6h-6zM61 27h6v6h-6z" fill="#fff9e7"/><path d="M48 28h3v5h-3zM64 28h3v5h-3z" fill="var(--ink)"/></g>
      <path d="M53 39h8" stroke="#956848" stroke-width="2"/>
      <path d="M10 93h18v25H8V97z" fill="var(--white)" stroke="var(--line)"/><path d="M13 99h10M13 104h10M13 109h7" stroke="var(--flow-line)" stroke-width="1.5"/>
    </g>`;
  }
  function node(type,x,y,w,h){
    let content='';
    if(type==='agent'){
      const inset=w>240?32:8;
      content=text(22,28,'Agent',25)+
        `<circle cx="${inset+69}" cy="114" r="73" fill="var(--primary-soft)"/>`+
        `<g transform="translate(${inset} 51)">${avatar()}</g>`+
        `<g transform="translate(${w-78} 60)"><rect width="68" height="46" rx="5" fill="var(--white)" stroke="var(--line)"/><path d="M10 13h28M10 19h38" stroke="var(--flow-line)" stroke-width="2"/>${text(10,36,'Task',11)}</g>`+
        `<g transform="translate(${w-78} 129)"><rect x="4" y="-4" width="64" height="44" rx="5" fill="var(--surface-deep)"/><rect width="64" height="44" rx="5" fill="var(--white)" stroke="var(--line)"/><path d="M10 12h26M10 18h34" stroke="var(--flow-line)" stroke-width="2"/>${text(10,34,'History',11)}</g>`;
    }
    if(type==='bash')content=box(0,0,w,h,'var(--white)','var(--line)')+
      text(20,30,'Bash',23)+
      `<rect x="12" y="44" width="${w-24}" height="108" rx="7" fill="#202124"/><path d="M12 68H${w-12}" stroke="#4b5563"/><circle cx="27" cy="56" r="3" fill="#d99c83"/><circle cx="38" cy="56" r="3" fill="#d8c586"/><circle cx="49" cy="56" r="3" fill="#a0bd86"/>`+
      text(23,90,'$ mcapi look --yaw -90 &amp;&amp;',11.5,'#93c5fd','font-family="monospace"')+
      text(23,111,'  mcapi press MOVE_FORWARD 2.0',11.5,'#f8fafc','font-family="monospace"')+
      '<rect class="terminal-cursor" x="24" y="126" width="7" height="11" fill="#93c5fd"/>'+
      '<g transform="translate(20 173)" stroke="var(--flow-line)" stroke-width="1.5" fill="none"><path d="m5 0-5 6 5 6M18 0l5 6-5 6M14-2l-5 16"/></g>'+
      text(55,184,'mcapi → AgentBridge',13)+
      '<g transform="translate(20 195)" stroke="var(--flow-line)" fill="none"><rect width="23" height="12" rx="2"/><path d="M4 4h2m3 0h2m3 0h2m3 0h1M4 8h15"/></g>'+
      text(55,206,'xdo → keyboard &amp; mouse',12);
    if(type==='world'){
      const imageHeight=(w-16)*.625,tabWidth=(w-16)/2;
      const tab=(view,label,i)=>`<g class="client-view-tab" data-client-view="${view}" role="button" tabindex="0" aria-pressed="${i===0}" aria-label="Show ${label.toLowerCase()}" transform="translate(${8+i*tabWidth} 48)"><rect width="${tabWidth}" height="30" rx="4"/>${text(tabWidth/2,20,label,13,'currentColor','text-anchor="middle"')}</g>`;
      content=text(0,28,'Minecraft client',25)+
        `<rect class="client-window" x="0" y="42" width="${w}" height="${imageHeight+46}" rx="8" fill="var(--white)" stroke="var(--line)" stroke-width="1.5"/>`+
        tab('game','Game view',0)+tab('map','World map',1)+
        `<rect x="8" y="82" width="${w-16}" height="${imageHeight}" fill="var(--surface-deep)"/><image class="client-observation" href="${views.game}" x="8" y="82" width="${w-16}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="In-game presentation view of Copacabana"/><rect class="client-capture-outline" x="8" y="82" width="${w-16}" height="${imageHeight}" fill="none" stroke="var(--primary)" stroke-width="4" pointer-events="none"/>${text(8,imageHeight+112,'Copacabana Waterfront',13,'var(--muted)')}`;
    }
    if(type==='verifier'){
      const compact=w<300;
      content=box(0,0,w,h,'var(--primary-soft)','var(--line)')+
        '<g class="verifier-clipboard" transform="translate(20 21)"><rect width="43" height="65" rx="5" fill="var(--white)" stroke="var(--line)"/><rect x="11" y="-4" width="21" height="10" rx="3" fill="var(--primary)"/><path d="m8 21 4 4 7-9m-11 25 4 4 7-9m-11 25 4 4 7-9" fill="none" stroke="var(--primary)" stroke-width="2"/><path d="M24 21h11M24 41h11M24 60h11" stroke="var(--line)" stroke-width="2"/></g>'+
        (compact?text(81,31,'Independent',20)+text(81,54,'verifier',20):text(84,34,'Independent verifier',22))+
        text(compact?81:84,compact?77:62,'Ordered arrivals + claim',compact?11:14,'var(--muted)')+
        text(compact?81:84,compact?96:86,'Accepted claim → success',compact?11:14,'var(--muted)');
    }
    return `<g class="framework-node" data-framework-node="${type}" transform="translate(${x} ${y})">${content}</g>`;
  }
  function render(mobile){
    const id=mobile?'mobile':'desktop',w=mobile?360:1180,h=mobile?1115:650;
    const arrow=(d,channel,color='var(--flow-line)',reverse=false)=>`<path class="flow-edge" data-flow="${channel}" d="${d}" stroke="${color}" stroke-width="1.8" fill="none" marker-end="url(#fw-${id}-arrow)" ${reverse?`marker-start="url(#fw-${id}-arrow)"`:''}/>`;
    const paths=mobile?
      arrow('M180 264V320','exec')+arrow('M180 540V600','controls')+
      arrow('M315 745H343V135H315','observe')+arrow('M315 425H343','feedback')+
      text(198,300,'exec',13)+text(198,576,'controls',13)+
      text(351,518,'Screenshots + execution feedback',11,'var(--muted)','text-anchor="middle" transform="rotate(-90 351 518)"')+
      arrow('M180 890V975','position','var(--flow-line)')+text(196,930,'Position · 1 Hz',12,'var(--muted)')+
      arrow('M45 173H18V1030H45','claim','var(--flow-line)',true)+text(11,610,'claim_done / verifier feedback',11,'var(--muted)','text-anchor="middle" transform="rotate(-90 11 610)"'):
      arrow('M245 255H320','exec')+arrow('M635 255H720','controls')+
      text(264,240,'exec',13)+text(648,240,'controls',13)+
      arrow('M935 100V65H135V145','observe')+arrow('M477 145V65','feedback')+
      text(535,48,'Screenshots + execution feedback',15,'var(--muted)','text-anchor="middle"')+
      arrow('M935 480V566H900','position','var(--flow-line)')+
      text(957,509,'Position samples',13,'var(--muted)')+text(957,532,'1 Hz',13,'var(--muted)')+
      arrow('M135 365V566H450','claim','var(--flow-line)',true)+text(245,545,'claim_done',15,'var(--muted)','font-family="monospace"')+
      text(245,592,'Verifier feedback',13,'var(--muted)');
    const nodes=mobile?node('agent',45,44,270,220)+node('bash',45,320,270,220)+node('world',45,600,270,290)+node('verifier',45,975,270,116):
      node('agent',25,145,220,220)+node('bash',320,145,315,220)+node('world',720,100,430,380)+node('verifier',450,510,450,112);
    return `<svg class="framework-${id}" viewBox="0 0 ${w} ${h}" role="group" aria-labelledby="fw-${id}-title fw-${id}-desc"><title id="fw-${id}-title">Agent interaction and independent verification</title><desc id="fw-${id}-desc">The agent receives the task, screenshots and execution feedback. Bash runs mcapi through AgentBridge or xdo keyboard and mouse controls. The client shows an in-game presentation view or native map of Copacabana. A separate verifier samples player positions at one hertz throughout execution and checks ordered arrivals and the completion claim. Moving dots illustrate information flow.</desc><defs><marker id="fw-${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1 9 5 0 9" fill="none" stroke="var(--flow-line)" stroke-width="1.6"/></marker></defs>${paths}${nodes}<circle class="flow-packet" r="6" fill="var(--primary)" stroke="var(--white)" stroke-width="2" pointer-events="none"/><circle class="position-packet" r="4" fill="var(--primary)" pointer-events="none"/></svg>`;
  }
  host.innerHTML=render(false)+render(true);
  function selectView(view){
    host.querySelectorAll('[data-client-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clientView===view)));
    host.querySelectorAll('.client-observation').forEach(img=>{
      img.setAttribute('href',views[view]);
      img.setAttribute('aria-label',view==='game'?'In-game presentation view of Copacabana':'Native map of Copacabana');
    });
  }
  host.addEventListener('click',e=>{const b=e.target.closest('[data-client-view]');if(b)selectView(b.dataset.clientView);});
  host.addEventListener('keydown',e=>{const b=e.target.closest('[data-client-view]');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectView(b.dataset.clientView);}});

  const figure=host.closest('figure'),play=document.querySelector('#framework-play');
  const steps=[...document.querySelectorAll('[data-framework-step]')];
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const phases=[
    {channel:'observe',nodes:['agent','world'],copy:'The agent receives screenshots and execution feedback.'},
    {channel:'exec',nodes:['agent','bash'],copy:'The agent composes tool calls, shell commands or Python scripts in Bash.'},
    {channel:'controls',nodes:['bash','world'],copy:'API calls and keyboard or mouse input control the Minecraft client.'},
    {channel:'claim',nodes:['verifier'],copy:'The verifier checks ordered arrivals and the agent’s completion claim.'}
  ];
  let phase=0,elapsed=0,last=0,raf=0,visible=false,wantsPlay=!motion.matches;
  const duration=2600;
  function setPhase(next){
    phase=next;figure.dataset.phase=String(next);
    steps.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===next)));
    host.querySelectorAll('[data-framework-node]').forEach(n=>n.classList.toggle('is-active',phases[next].nodes.includes(n.dataset.frameworkNode)));
    host.querySelectorAll('[data-flow]').forEach(p=>p.classList.toggle('is-active',p.dataset.flow===phases[next].channel));
    document.querySelector('#framework-phase-number').textContent=String(next+1).padStart(2,'0');
    document.querySelector('#framework-phase-copy').textContent=phases[next].copy;
  }
  const tracks=[...host.querySelectorAll('svg.framework-desktop,svg.framework-mobile')].map(svg=>({svg,
    packet:svg.querySelector('.flow-packet'),position:svg.querySelector('.position-packet'),
    paths:Object.fromEntries([...svg.querySelectorAll('[data-flow]')].map(p=>[p.dataset.flow,{path:p,length:p.getTotalLength()}]))}));
  function draw(progress){
    for(const track of tracks){
      const flow=track.paths[phases[phase].channel];
      const p=flow.path.getPointAtLength(flow.length*progress);
      track.packet.setAttribute('cx',p.x);track.packet.setAttribute('cy',p.y);
      const sample=track.paths.position,sp=sample.path.getPointAtLength(sample.length*(elapsed%1000)/1000);
      track.position.setAttribute('cx',sp.x);track.position.setAttribute('cy',sp.y);
    }
  }
  function frame(now){
    if(last)elapsed+=Math.min(100,now-last);last=now;
    const next=Math.floor(elapsed/duration)%phases.length;if(next!==phase)setPhase(next);
    draw((elapsed%duration)/duration);raf=requestAnimationFrame(frame);
  }
  function sync(){
    cancelAnimationFrame(raf);last=0;
    const running=wantsPlay&&visible&&!document.hidden&&!motion.matches;
    figure.classList.toggle('is-playing',running);
    play.setAttribute('aria-pressed',String(wantsPlay&&!motion.matches));
    play.setAttribute('aria-label',wantsPlay&&!motion.matches?'Pause framework animation':'Play framework animation');
    play.innerHTML=wantsPlay&&!motion.matches?'Ⅱ <span>Pause</span>':'▶ <span>Play</span>';
    play.disabled=motion.matches;play.title=motion.matches?'Reduced motion is enabled; select a stage to explore.':'';
    if(running)raf=requestAnimationFrame(frame);
  }
  steps.forEach((button,i)=>button.addEventListener('click',()=>{wantsPlay=false;elapsed=i*duration;setPhase(i);draw(.5);sync();}));
  play.addEventListener('click',()=>{wantsPlay=!wantsPlay;sync();});
  document.addEventListener('visibilitychange',sync);
  motion.addEventListener('change',()=>{wantsPlay=!motion.matches;sync();});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.12}).observe(figure);
  else visible=true;
  setPhase(0);draw(0);sync();
})();

// Complete paired runs, replayed on one recorded-time clock without shortening pauses.
(() => {
  const data=window.MINE_ODYSSEY.fullTrajectories,host=document.querySelector('#full-trajectories');
  if(!data||!host)return;
  const $=s=>host.querySelector(s),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
  let current=0,elapsed=0,speed=data.default_speed,maximum=0,players=[],wantsPlay=!motion.matches,frame=0,last=null,lastPaint=0,hold=0,generation=0,mediaError=false;
  const pair=$('#trajectory-pair'),slider=$('#trajectory-progress'),play=$('#trajectory-play');
  const outcome={claim_done_arrived:'Completed',step_limit:'Step limit',death:'Died',out_of_bounds:'Boundary termination'};
  function recordingEnd(run){return run.recording?run.recording.offset_seconds+run.recording.source_duration:0;}
  function inView(){const r=pair.getBoundingClientRect();return !document.hidden&&r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;}
  function videoTime(player){const r=player.run.recording;return Math.max(0,Math.min((elapsed-r.offset_seconds)/r.encoded_speed,r.duration-1/30));}
  function syncMedia(force=false){
    if(!players.some(p=>p.video))return;
    const visible=inView(),playing=active();
    for(const player of players){
      const v=player.video,r=player.run.recording;if(!v)continue;
      if(!visible){v.pause();continue;}
      if(!v.getAttribute('src')){v.src=r.video;v.load();}
      if(v.readyState<1)continue;
      const target=videoTime(player);
      v.playbackRate=speed/r.encoded_speed;
      if(Math.abs(v.currentTime-target)>(force?.02:.2)&&!v.seeking)v.currentTime=target;
      const canPlay=playing&&elapsed>=r.offset_seconds&&elapsed<recordingEnd(player.run);
      if(canPlay&&v.paused&&!player.pendingPlay){
        player.pendingPlay=true;
        v.play().catch(e=>{if(e.name!=='AbortError'&&player.generation===generation){mediaError=true;wantsPlay=false;$('#trajectory-media-status').hidden=false;$('#trajectory-media-status').textContent='Press Play to start the recordings.';sync();}}).finally(()=>{player.pendingPlay=false;});
      }else if(!canPlay)v.pause();
      player.card.querySelector('.trajectory-video-rate').textContent=`${r.kind==='observation_replay'?'Observation replay':'Full recording'} · ${speed}×`;
    }
  }
  function point(task,sample){
    const [sx,bx,sz,bz]=task.projection,[l,t,r,b]=task.crop;
    return [(sample[1]*sx+bx-l)/(r-l)*1000,(sample[3]*sz+bz-t)/(b-t)*task.map_viewbox[1]];
  }
  function paint(force=false){
    const task=data.cases[current];
    host.dataset.elapsed=String(elapsed);
    for(const player of players){
      const run=player.run,recorded=Math.min(elapsed,run.duration);
      let low=0,high=run.samples.length;
      while(low<high){const mid=(low+high)>>1;if(run.samples[mid][0]<=recorded)low=mid+1;else high=mid;}
      const index=Math.max(0,low-1);
      if(force||player.index!==index){
        const d=player.commands.slice(0,index+1).join(' ');
        player.paths.forEach(p=>p.setAttribute('d',d));
        const [x,y]=player.points[index];player.dot.setAttribute('cx',x);player.dot.setAttribute('cy',y);
        player.index=index;player.card.dataset.sampleIndex=String(index);
      }
      const reached=new Set(run.arrivals.filter(a=>a.time<=recorded).map(a=>a.id));
      player.markers.forEach((m,i)=>m.classList.toggle('is-reached',i===0||reached.has(task.stops[i].id)));
      player.visits.textContent=`${reached.size} / ${task.stops.length-1} destinations`;
      player.time.textContent=clock(recorded);
      const ended=elapsed>=run.duration;
      player.outcome.textContent=ended?outcome[run.terminal_reason]:'Running';
      player.card.dataset.finished=String(ended);
    }
    slider.value=String(elapsed/maximum*1000);
    slider.setAttribute('aria-valuetext',`${clock(elapsed)} of ${clock(maximum)} recorded time`);
    $('#trajectory-clock').textContent=`${clock(elapsed)} / ${clock(maximum)}`;
  }
  function render(){
    generation++;players.forEach(p=>{if(p.video){p.video.pause();p.video.removeAttribute('src');p.video.load();}});
    const task=data.cases[current],hasVideo=task.runs.every(r=>r.recording),hasObservations=hasVideo&&task.runs.every(r=>r.recording.kind==='observation_replay');
    maximum=Math.max(...task.runs.flatMap(r=>[r.duration,recordingEnd(r)]));elapsed=motion.matches?maximum:0;hold=0;mediaError=false;
    speed=task.playback_speed||(hasVideo?32:128);$('#trajectory-speed').value=String(speed);pair.classList.toggle('has-recordings',hasVideo);
    $('#trajectory-title').textContent=task.label;
    $('#trajectory-subtitle').textContent=hasObservations?'Original observations and trajectory, synchronized.':hasVideo?'Recording and trajectory, synchronized.':'Trajectory replay · No game recording for these runs.';
    $('#trajectory-setting').textContent=task.setting_label||'';$('#trajectory-setting').hidden=!task.setting_label;
    $('#trajectory-media-status').hidden=true;
    host.dataset.taskId=task.id;
    $('#trajectory-task-id').textContent=task.id;
    $('#trajectory-prompt').textContent=task.prompt;$('#trajectory-prompt').lang=task.locale;
    $('#trajectory-stops').innerHTML=task.stops.map(s=>`<li><span>${s.label}</span>${escapeHTML(s.name)}</li>`).join('');
    pair.innerHTML=task.runs.map(run=>`<figure class="trajectory-run" data-model="${run.id}"><header><h4>${escapeHTML(run.model)}</h4><span class="trajectory-outcome"></span></header>${run.recording?`<div class="trajectory-video"><video muted playsinline preload="none" poster="${run.recording.poster}" aria-label="${run.recording.kind==='observation_replay'?'Original observation replay':'Full game recording'} for ${escapeHTML(run.model)} on ${escapeHTML(task.label)}"></video><span class="trajectory-video-rate">${run.recording.kind==='observation_replay'?'Observation replay':'Full recording'} · ${speed}×</span><button type="button" data-video-expand aria-label="Expand ${escapeHTML(run.model)} recording">↗</button></div>`:''}<div class="trajectory-map" style="aspect-ratio:${task.map_viewbox[0]}/${task.map_viewbox[1]}"><img src="${task.map_image}" alt="Native map of ${escapeHTML(task.label)}" loading="lazy" width="1000" height="${Math.round(task.map_viewbox[1])}"><svg viewBox="0 0 ${task.map_viewbox.join(' ')}" role="img" aria-label="Complete recorded horizontal trajectory for ${escapeHTML(run.model)}"><path data-trace fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/><path data-trace fill="none" stroke="var(--route)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle data-player r="8" fill="var(--route)" stroke="#fff" stroke-width="3"/></svg>${task.stops.map(s=>{const p=point(task,[0,...s.position]);return `<span class="trajectory-marker" style="left:${p[0]/10}%;top:${p[1]/task.map_viewbox[1]*100}%" title="${escapeHTML(s.name)}">${s.label}</span>`;}).join('')}</div><figcaption><p class="trajectory-run-summary">Full run: ${clock(run.duration)} · ${run.steps} steps</p><div class="trajectory-run-current"><span data-visits></span><strong data-time></strong></div></figcaption></figure>`).join('');
    players=task.runs.map((run,i)=>{
      const card=pair.children[i],points=run.samples.map(s=>point(task,s));
      return {run,card,points,index:-1,generation,video:card.querySelector('video'),pendingPlay:false,paths:[...card.querySelectorAll('[data-trace]')],dot:card.querySelector('[data-player]'),markers:[...card.querySelectorAll('.trajectory-marker')],visits:card.querySelector('[data-visits]'),time:card.querySelector('[data-time]'),outcome:card.querySelector('.trajectory-outcome'),commands:points.map((p,i)=>`${i===0||run.samples[i][0]-run.samples[i-1][0]>2.5?'M':'L'}${p.map(v=>v.toFixed(3)).join(' ')}`)};
    });
    players.forEach(p=>{if(p.video){
      const revision=generation;
      p.video.addEventListener('loadedmetadata',()=>{if(revision===generation)syncMedia(true);});
      p.video.addEventListener('seeked',()=>{if(revision===generation&&!active())syncMedia(true);});
      p.video.addEventListener('error',()=>{if(revision===generation&&p.video.getAttribute('src')){mediaError=true;wantsPlay=false;$('#trajectory-media-status').hidden=false;$('#trajectory-media-status').textContent='The recording could not load. Press Play to retry.';sync();}});
      p.card.querySelector('[data-video-expand]').addEventListener('click',()=>{if(p.video.requestFullscreen)p.video.requestFullscreen().catch(()=>{});else if(p.video.webkitEnterFullscreen)p.video.webkitEnterFullscreen();});
    }});
    host.querySelectorAll('[data-trajectory-case]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.trajectoryCase)===current)));
    paint(true);sync();
  }
  function active(){return wantsPlay&&!mediaError&&inView();}
  function tick(now){
    frame=0;if(!active()){sync();return;}
    let delta=last===null?0:Math.min(now-last,100);last=now;
    if(players.some(p=>p.video&&elapsed<recordingEnd(p.run)&&(p.video.readyState<3||p.video.seeking))){delta=0;players.forEach(p=>p.video?.pause());}
    if(elapsed>=maximum){hold+=delta;if(hold>=3000){elapsed=0;hold=0;}}
    else elapsed=Math.min(maximum,elapsed+delta/1000*speed);
    if(now-lastPaint>=50){paint();syncMedia();lastPaint=now;}
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(frame);last=null;const playing=active();
    play.textContent=playing?'Pause':'Play';play.setAttribute('aria-pressed',String(playing));
    syncMedia();if(playing)frame=requestAnimationFrame(tick);
  }
  host.querySelectorAll('[data-trajectory-case]').forEach(b=>b.addEventListener('click',()=>{current=Number(b.dataset.trajectoryCase);render();}));
  play.addEventListener('click',()=>{if(mediaError){mediaError=false;$('#trajectory-media-status').hidden=true;players.forEach(p=>p.video?.load());}wantsPlay=!active();if(wantsPlay&&elapsed>=maximum){elapsed=0;hold=0;paint();}syncMedia(true);sync();});
  $('#trajectory-restart').addEventListener('click',()=>{elapsed=0;hold=0;wantsPlay=true;paint();syncMedia(true);sync();});
  $('#trajectory-speed').addEventListener('change',e=>{speed=Number(e.target.value);syncMedia(true);});
  slider.addEventListener('input',()=>{wantsPlay=false;elapsed=Number(slider.value)/1000*maximum;hold=0;paint();syncMedia(true);sync();});
  $('.trajectory-source').addEventListener('toggle',e=>{if(e.target.open){wantsPlay=false;sync();}});
  motion.addEventListener('change',e=>{if(e.matches){wantsPlay=false;elapsed=maximum;paint();syncMedia(true);sync();}});
  document.addEventListener('visibilitychange',sync);
  render();new IntersectionObserver(sync,{threshold:[0,.15]}).observe(pair);
})();

// An automatic task-order illustration, independent from the interactive explorer.
(() => {
  const card=document.querySelector('.journey-contract'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const phaseMs=1400,stopCount=card.querySelectorAll('[data-contract-stop]').length,phaseCount=stopCount+1;
  let elapsed=0,last=null,frame=0,phase=-1,inView=false;
  function paint(next){
    if(next===phase)return;phase=next;card.dataset.phase=String(next);
    card.querySelectorAll('[data-contract-stop]').forEach(row=>row.classList.toggle('is-current',Number(row.dataset.contractStop)===next));
    card.querySelectorAll('[data-contract-marker]').forEach(pin=>pin.classList.toggle('is-selected',Number(pin.dataset.contractMarker)===next));
    card.querySelector('.contract-claim').classList.toggle('is-complete',next===stopCount);
  }
  function active(){return inView&&!document.hidden&&!motion.matches;}
  function tick(now){
    frame=0;if(!active())return;
    if(last!==null)elapsed=(elapsed+Math.min(now-last,100))%(phaseMs*phaseCount);
    last=now;paint(Math.floor(elapsed/phaseMs));frame=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(frame);frame=0;last=null;
    const r=card.getBoundingClientRect();inView=r.top<innerHeight&&r.bottom>0;
    if(motion.matches)paint(-1);
    else if(active())frame=requestAnimationFrame(tick);
  }
  function reset(){elapsed=0;phase=-2;paint(motion.matches?-1:0);sync();}
  document.addEventListener('visibilitychange',sync);
  motion.addEventListener('change',reset);
  new IntersectionObserver(sync,{threshold:[0,.1]}).observe(card);
  reset();
})();

// Terrain cards loop while visible; the enlarged player remains explicitly controlled.
(() => {
  const cards=[...document.querySelectorAll('.terrain-card')],button=document.querySelector('#terrain-motion');
  const dialog=document.querySelector('#image-dialog'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  let enabled=!motion.matches;
  const states=cards.map(card=>({card,video:card.querySelector('video'),visual:card.querySelector('.terrain-visual'),visible:false,ticket:0,pending:false}));
  function shouldPlay(s){return enabled&&s.visible&&!document.hidden&&!dialog.open;}
  function pause(s){s.ticket++;s.pending=false;s.video.pause();}
  async function play(s){
    if(s.pending||!s.video.paused)return;
    s.pending=true;const ticket=++s.ticket;
    s.video.muted=true;if(!s.video.getAttribute('src'))s.video.src=s.video.dataset.src;
    try{await s.video.play();if(ticket!==s.ticket){if(!shouldPlay(s))s.video.pause();return;}if(!shouldPlay(s)){s.video.pause();return;}s.visual.classList.add('is-playing');}
    catch{if(ticket===s.ticket)s.visual.classList.remove('is-playing');}
    finally{if(ticket===s.ticket)s.pending=false;}
  }
  function sync(){
    button.textContent=enabled?'Pause previews':'Play previews';button.setAttribute('aria-pressed',String(enabled));
    for(const s of states){if(shouldPlay(s))play(s);else pause(s);}
  }
  const observer=new IntersectionObserver(entries=>{
    for(const e of entries){const s=states.find(s=>s.visual===e.target);s.visible=e.isIntersecting&&e.intersectionRatio>=.12;}
    sync();
  },{threshold:[0,.12]});
  for(const s of states){
    observer.observe(s.visual);
    s.video.addEventListener('playing',()=>{if(!shouldPlay(s))pause(s);else s.visual.classList.add('is-playing');});
    const phase=s.card.querySelector('.terrain-pair-phase');
    if(phase)s.video.addEventListener('timeupdate',()=>{phase.textContent=s.video.currentTime>=2?'Open':'Closed';});
  }
  button.addEventListener('click',()=>{enabled=!enabled;sync();});
  document.addEventListener('visibilitychange',sync);document.addEventListener('preview-dialog-open',sync);dialog.addEventListener('close',sync);
  motion.addEventListener('change',()=>{if(motion.matches)enabled=false;sync();});
  sync();
})();
