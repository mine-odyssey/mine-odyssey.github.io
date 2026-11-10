'use strict';
const $=id=>document.getElementById(id);
const endpoint=(window.HUMAN_EVAL_CONNECTION?.endpoint||'').replace(/\/$/,'');
if(endpoint&&!/^https:\/\/[^/?#]+$/.test(endpoint))throw new Error('Invalid evaluation endpoint');
const tokenKey='mine-odyssey-human-session:'+endpoint;
let sessionToken=sessionStorage.getItem(tokenKey)||'',videoController=null,frameURL=null;
function requestHeaders(json=false){return {...(json?{'Content-Type':'application/json'}:{}),...(sessionToken?{'Authorization':'Bearer '+sessionToken}:{})};}
let current=null,lease=null,seq=0,busy=false,mapOpen=false,queue=Promise.resolve(),videoActive=false,dx=0,dy=0,mapHover=null;
const pressed=new Set();
let lookReadyAt=0;
const keyMap={KeyW:'MOVE_FORWARD',KeyS:'MOVE_BACK',KeyA:'MOVE_LEFT',KeyD:'MOVE_RIGHT',Space:'JUMP',ShiftLeft:'SNEAK',ShiftRight:'SNEAK',ControlLeft:'SPRINT',ControlRight:'SPRINT'};
function error(e){$('error').textContent=e?.message||String(e);}
function stopVideo(){if(videoController)videoController.abort();videoController=null;videoActive=false;$('screen').removeAttribute('src');if(frameURL)URL.revokeObjectURL(frameURL);frameURL=null;}
async function startVideo(){
 videoActive=true;const controller=new AbortController();videoController=controller;
 try{
  const response=await fetch(endpoint+'/api/video',{headers:requestHeaders(),credentials:'same-origin',signal:controller.signal});
  if(!response.ok)throw new Error('正在连接游戏画面……');
  const reader=response.body.getReader();let pending=new Uint8Array(0);const decoder=new TextDecoder();
  while(!controller.signal.aborted){
   const {done,value}=await reader.read();if(done)break;
   const joined=new Uint8Array(pending.length+value.length);joined.set(pending);joined.set(value,pending.length);pending=joined;
   let latest=null;
   while(true){
    let header=-1;for(let i=0;i+3<pending.length;i++){if(pending[i]===13&&pending[i+1]===10&&pending[i+2]===13&&pending[i+3]===10){header=i+4;break;}}
    if(header<0)break;
    const match=decoder.decode(pending.subarray(0,header)).match(/Content-Length:\s*(\d+)/i);
    if(!match)throw new Error('Invalid video frame');const length=Number(match[1]);if(length>2000000)throw new Error('Video frame too large');
    if(pending.length<header+length+2)break;
    latest=pending.slice(header,header+length);pending=pending.slice(header+length+2);
   }
   if(latest){const previous=frameURL;frameURL=URL.createObjectURL(new Blob([latest],{type:'image/jpeg'}));$('screen').src=frameURL;if(previous)setTimeout(()=>URL.revokeObjectURL(previous),1000);}
   if(pending.length>3000000)throw new Error('Invalid video stream');
  }
 }catch(e){if(e.name!=='AbortError'&&current?.status==='running')error(e);}
 finally{if(videoController===controller){videoActive=false;videoController=null;}}
}
async function api(path,body){const response=await fetch(endpoint+path,{method:body===undefined?'GET':'POST',headers:requestHeaders(body!==undefined),body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});const data=await response.json();if(!response.ok){if(response.status===401){sessionToken='';sessionStorage.removeItem(tokenKey);}throw Object.assign(new Error(data.error||'请求失败'),{status:response.status});}if(data.access_token){sessionToken=data.access_token;sessionStorage.setItem(tokenKey,sessionToken);delete data.access_token;}return data;}
function action(path,data={}){const work=queue.then(()=>{if(!lease)throw new Error('尚未取得操作权限');return api(path,{lease,seq:++seq,...data});});queue=work.catch(()=>{});return work;}
function release(){pressed.clear();dx=0;dy=0;}
async function control(){if(lease)return;const result=await api('/api/control',{});lease=result.lease;seq=0;}
function render(state){current=state;$('login').hidden=true;$('workspace').hidden=false;$('identity').textContent=state.participant;const labels={unassigned:'等待任务',preparing:'正在载入环境',ready:'环境已就绪',starting:'正在开始',running:'任务进行中',ending:'正在保存结果',finished:state.success?'本次任务成功':'本次任务结束',error:'环境异常 · 已记录'};$('status').textContent=labels[state.status]||state.status;$('kind').textContent=state.kind==='practice'?'练习 · 不计入正式成绩':state.kind==='evaluation'?'正式任务':'';$('prompt').textContent=state.prompt||'任务由后台分配，请等待环境准备。';const live=state.status==='running';$('prepare').hidden=!(state.status==='unassigned'||state.can_advance);$('start').hidden=state.status!=='ready';for(const id of ['map','state','claim','abandon'])$(id).hidden=!live;$('cover').hidden=live;$('cover').textContent=labels[state.status]||'等待开始';$('timer').textContent=state.started_at?`任务 ${state.index+1} / ${state.total} · ${Math.max(0,Math.floor(Date.now()/1000-state.started_at))} 秒`:'';if(live&&!videoActive)startVideo();if(!live&&videoActive){stopVideo();release();if(document.pointerLockElement)document.exitPointerLock();}if(state.last_claim_response){const r=state.last_claim_response;let text=r.accepted?'提交已通过。':r.terminal?'提交次数已用尽，本次任务结束。':'尚未完成全部要求。';if(r.feedback)text+=`\n仍需到达：${r.feedback.remaining_locations.join(' → ')}\n剩余提交次数：${r.feedback.remaining_attempts}`;$('feedback').textContent=text;}}
async function refresh(){try{render(await api('/api/status'));}catch(e){if(e.status===401){$('login').hidden=false;$('workspace').hidden=true;}else error(e);}}
$('login-form').onsubmit=async event=>{event.preventDefault();try{render(await api('/api/login',{code:$('code').value}));$('code').value='';$('error').textContent='';}catch(e){error(e);}};
$('prepare').onclick=async()=>{try{lease=null;mapOpen=false;release();$('feedback').textContent='';$('self-state').hidden=true;render(await api('/api/prepare',{}));}catch(e){error(e);}};
$('start').onclick=async()=>{try{await control();render(await action('/api/start'));}catch(e){error(e);}};
async function mapAction(kind,x=0,y=0){release();if(document.pointerLockElement)document.exitPointerLock();await action('/api/map',{action:kind,dx:x,dy:y});if(kind==='open'||kind==='close')mapOpen=kind==='open';$('map').textContent=mapOpen?'关闭地图':'打开地图';$('map-controls').hidden=!mapOpen;}
$('map').onclick=()=>mapAction(mapOpen?'close':'open').catch(error);
for(const button of document.querySelectorAll('[data-pan]'))button.onclick=()=>{const [x,y]=button.dataset.pan.split(',').map(Number);mapAction('pan',x,y).catch(error);};
for(const button of document.querySelectorAll('[data-zoom]'))button.onclick=()=>mapAction(button.dataset.zoom).catch(error);
$('state').onclick=async()=>{try{const result=await action('/api/self-state');$('self-state').textContent=JSON.stringify(result,null,2);$('self-state').hidden=false;}catch(e){error(e);}};
$('claim').onclick=async()=>{release();try{await action('/api/claim');$('feedback').textContent='正在验证提交……';}catch(e){error(e);}};
$('abandon').onclick=async()=>{if(!confirm('确认放弃本次任务？这次尝试会被保留，不能自行重开。'))return;release();try{render(await action('/api/abandon'));}catch(e){error(e);}};
$('screen').onclick=async()=>{if(current?.status!=='running'||mapOpen)return;try{await control();await $('screen').requestPointerLock();}catch(e){error(e);}};
document.addEventListener('keydown',e=>{if(current?.status!=='running'||e.target instanceof HTMLInputElement)return;if(e.code==='KeyM'&&!e.repeat){e.preventDefault();mapAction(mapOpen?'close':'open').catch(error);return;}if(e.code==='Escape'){release();if(document.pointerLockElement)document.exitPointerLock();mapAction('close').catch(error);return;}if(document.pointerLockElement===$('screen')&&/^Digit[1-9]$/.test(e.code)&&!e.repeat){action('/api/hotbar',{slot:Number(e.code.slice(-1))}).catch(error);return;}if(document.pointerLockElement===$('screen')&&keyMap[e.code]){e.preventDefault();pressed.add(keyMap[e.code]);}});
document.addEventListener('keyup',e=>{if(keyMap[e.code])pressed.delete(keyMap[e.code]);});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===$('screen')&&!mapOpen&&performance.now()>=lookReadyAt){dx+=e.movementX*.14;dy+=e.movementY*.14;}});
document.addEventListener('mousedown',e=>{if(document.pointerLockElement===$('screen')&&!mapOpen){if(e.button===0)pressed.add('CLICK_LEFT');if(e.button===2)pressed.add('CLICK_RIGHT');}});
document.addEventListener('mouseup',e=>{if(e.button===0)pressed.delete('CLICK_LEFT');if(e.button===2)pressed.delete('CLICK_RIGHT');});
document.addEventListener('contextmenu',e=>{if(e.target===$('screen'))e.preventDefault();});
document.addEventListener('pointerlockchange',()=>{release();lookReadyAt=performance.now()+100;});
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
setInterval(async()=>{if(current?.status!=='running'||!lease||busy||document.hidden)return;busy=true;const yaw=Math.max(-45,Math.min(45,dx)),pitch=Math.max(-45,Math.min(45,dy));dx-=yaw;dy-=pitch;try{await action('/api/input',{pressed:[...pressed],yaw,pitch});}catch(e){release();if(e.status===403){lease=null;error('操作权限已变更，请重新点击画面。');}else if(e.status!==409&&e.status!==429)error(e);}finally{busy=false;}},100);
$('screen').addEventListener('mousemove',e=>{if(!mapOpen)return;const r=$('screen').getBoundingClientRect();mapHover={dx:Math.max(40,Math.min(760,(e.clientX-r.left)*800/r.width)),dy:Math.max(45,Math.min(540,(e.clientY-r.top)*600/r.height))};});
setInterval(()=>{if(mapOpen&&mapHover&&lease){const p=mapHover;mapHover=null;action('/api/map',{action:'hover',...p}).catch(error);}},180);
setInterval(refresh,1000);refresh();
