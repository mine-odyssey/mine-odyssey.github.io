'use strict';
const $=id=>document.getElementById(id),endpoint=window.HUMAN_EVAL_CONNECTION.endpoint||'',tokenKey='mine-odyssey-native:'+endpoint;
let token=sessionStorage.getItem(tokenKey)||'',lease=null,seq=0,current=null;
const headers=()=>({'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})});
function error(e){$('error').textContent=e.message||String(e);}
async function api(path,data){const r=await fetch(endpoint+path,{method:data===undefined?'GET':'POST',headers:headers(),body:data===undefined?undefined:JSON.stringify(data),credentials:'same-origin'});const out=await r.json();if(!r.ok)throw Object.assign(new Error(out.error||'请求失败'),{status:r.status});if(out.access_token){token=out.access_token;sessionStorage.setItem(tokenKey,token);delete out.access_token;}return out;}
async function action(path){if(!lease){lease=(await api('/api/control',{})).lease;seq=0;}return api(path,{lease,seq:++seq});}
function render(s){current=s;$('login').hidden=true;$('workspace').hidden=false;$('identity').textContent=s.participant;
 const labels={unassigned:'等待任务',preparing:'正在准备任务',server_starting:'正在启动游戏服务器',awaiting_player:'等待客户端连接',ready:'客户端已就绪',running:'任务进行中',ending:'正在保存结果',finished:s.success?'本次任务成功':'本次任务结束',error:'环境异常，已记录'};
 $('status').textContent=labels[s.status]||s.status;$('account').textContent=s.player_name?'绑定账号：'+s.player_name:'请先绑定参与者的 Minecraft Java 账号。';$('bind-form').hidden=!!s.player_name;$('address').textContent=s.game_address;
 $('kind').textContent=s.kind==='practice'?'练习 · 不计入正式成绩':s.kind==='evaluation'?'正式任务':'';$('prompt').textContent=s.prompt||'任务由后台分配。';
 $('prepare').hidden=!s.can_prepare||!(s.status==='unassigned'||s.can_advance);$('download').hidden=!s.pack_ready;$('start').hidden=s.status!=='ready';for(const id of ['state','claim','abandon'])$(id).hidden=s.status!=='running';
 $('timer').textContent=s.started_at?Math.max(0,Math.floor(Date.now()/1000-s.started_at))+' 秒':'';
 if(s.client_problem)$('error').textContent=s.client_problem;
 if(s.last_claim_response){const r=s.last_claim_response;$('feedback').textContent=r.accepted?'提交已通过。':r.terminal?'本次任务结束。':r.feedback?'仍需到达：'+r.feedback.remaining_locations.join(' → ')+'；剩余提交次数：'+r.feedback.remaining_attempts:'尚未完成全部要求。';}}
async function refresh(){try{render(await api('/api/status'));}catch(e){if(e.status===401){$('workspace').hidden=true;$('login').hidden=false;}else error(e);}}
$('login-form').onsubmit=async e=>{e.preventDefault();try{render(await api('/api/login',{code:$('code').value}));$('code').value='';$('error').textContent='';}catch(e){error(e);}};
$('bind-form').onsubmit=async e=>{e.preventDefault();try{render(await api('/api/bind',{username:$('username').value.trim()}));}catch(e){error(e);}};
$('prepare').onclick=async()=>{try{lease=null;$('feedback').textContent='';$('self-state').hidden=true;render(await api('/api/prepare',{}));}catch(e){error(e);}};
$('download').onclick=async()=>{try{const r=await fetch(endpoint+'/api/client-pack',{headers:headers(),credentials:'same-origin'});if(!r.ok)throw new Error((await r.json()).error);const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download='mine-odyssey-'+current.task_id+'.mrpack';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){error(e);}};
$('start').onclick=async()=>{try{render(await action('/api/start'));}catch(e){error(e);}};
$('claim').onclick=async()=>{try{await action('/api/claim');$('feedback').textContent='正在验证提交……';}catch(e){error(e);}};
$('state').onclick=async()=>{try{$('self-state').textContent=JSON.stringify(await action('/api/self-state'),null,2);$('self-state').hidden=false;}catch(e){error(e);}};
$('abandon').onclick=async()=>{if(!confirm('确认放弃？这次尝试会保留，不能自行重开。'))return;try{render(await action('/api/abandon'));}catch(e){error(e);}};
setInterval(refresh,1500);refresh();

$('helper').onclick=async()=>{try{const r=await fetch(endpoint+'/api/mac-helper',{headers:headers(),credentials:'same-origin'});if(!r.ok)throw new Error((await r.json()).error);const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download='mine-odyssey-mac-connection.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){error(e);}};
