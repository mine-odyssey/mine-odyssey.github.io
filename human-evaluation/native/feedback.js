'use strict';
(() => {
 const endpoint=window.HUMAN_EVAL_CONNECTION.feedback_endpoint;
 const el=id=>document.getElementById(id),key='mine-odyssey-feedback:'+endpoint;
 let session=sessionStorage.getItem(key)||'',busy=false,last='',requestId=null;
 const categories={connection:'连接问题',task:'任务问题',map:'地图问题',other:'其他问题'};
 const statuses={received:'已收到',investigating:'处理中',needs_information:'待补充信息',resolved:'已处理'};
 function notice(message,isError=false){el('support-notice').textContent=message;el('support-notice').classList.toggle('support-error',isError);}
 function signedIn(){el('support-login').hidden=!!session;el('support-form').hidden=!session;el('support-refresh').hidden=!session;}
 async function call(path,data,bearer=session){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch(endpoint+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal});
   const result=await response.json();
   if(!response.ok)throw Object.assign(new Error(result.error||'反馈服务暂时不可用。'),{status:response.status});
   return result;
  }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw new Error('暂时连接不上反馈服务，请稍后重试；填写内容仍保留在页面。');throw error;}
  finally{clearTimeout(timer);}
 }
 function remember(value){session=value;sessionStorage.setItem(key,session);signedIn();}
 function render(issues){
  const serialized=JSON.stringify(issues);if(serialized===last)return;last=serialized;
  const open=new Set([...el('support-list').querySelectorAll('details[open]')].map(n=>n.dataset.id));
  const drafts=new Map([...el('support-list').querySelectorAll('textarea')].map(n=>[n.id,n.value]));
  const focused=document.activeElement?.id,selection=document.activeElement?.selectionStart;
  const nodes=[];
  for(const issue of issues){
   const card=document.createElement('details');card.className='support-ticket';card.dataset.id=issue.id;card.open=open.has(issue.id)||issues.length===1;
   const title=document.createElement('summary');title.textContent=`${statuses[issue.status]||issue.status} · ${categories[issue.category]||issue.category} · ${issue.id}`;card.append(title);
   const meta=document.createElement('p');meta.className='hint';meta.textContent=`${new Date(issue.created).toLocaleString()}${issue.context.task_id?' · '+issue.context.task_id:''}`;card.append(meta);
   for(const message of issue.messages){
    const row=document.createElement('div');row.className='support-message '+(message.author==='operator'?'support-reply':'');
    const who=document.createElement('strong');who.textContent=message.author==='operator'?'工作人员回复':'我的反馈';
    const body=document.createElement('p');body.textContent=message.body;row.append(who,body);card.append(row);
   }
   const form=document.createElement('form'),label=document.createElement('label'),area=document.createElement('textarea'),button=document.createElement('button');
   area.id='reply-'+issue.id;area.rows=2;area.minLength=2;area.maxLength=4000;area.required=true;area.value=drafts.get(area.id)||'';
   label.textContent='补充说明';label.append(area);button.textContent='发送补充';button.className='quiet';form.append(label,button);
   form.onsubmit=async event=>{event.preventDefault();button.disabled=true;try{await call(`/api/issues/${issue.id}/messages`,{message:area.value});area.value='';notice('补充说明已保存。');await refresh();}catch(error){notice(error.message,true);}finally{button.disabled=false;}};
   card.append(form);nodes.push(card);
  }
  if(!issues.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='暂无反馈。提交后，可在这里查看处理回复。';nodes.push(empty);}
  el('support-list').replaceChildren(...nodes);
  if(focused&&document.getElementById(focused)){const target=document.getElementById(focused);target.focus({preventScroll:true});if(selection!==undefined)target.setSelectionRange(selection,selection);}
 }
 async function refresh(){
  if(!session||busy)return;busy=true;
  try{render((await call('/api/issues')).issues);}
  catch(error){if(error.status===401){remember('');last='';el('support-list').replaceChildren();}notice(error.message,true);}
  finally{busy=false;}
 }
 async function login(code){const result=await call('/api/login',{code},'');remember(result.access_token);el('support-code').value='';notice('反馈区已连接。');await refresh();}
 el('support-login').onsubmit=async event=>{event.preventDefault();try{await login(el('support-code').value);}catch(error){notice(error.message,true);}};
 el('login-form')?.addEventListener('submit',()=>{const code=el('code').value;if(code&&!session)login(code).catch(()=>{});},true);
 el('support-form').onsubmit=async event=>{
  event.preventDefault();el('support-submit').disabled=true;
  if(!requestId)requestId=crypto.randomUUID();
  const observed=typeof current==='object'&&current?current:{};
  const context={...Object.fromEntries(['task_id','status','client_ready','pack_ready'].filter(k=>k in observed).map(k=>[k,observed[k]])),error:el('error').textContent.slice(0,1000)};
  try{const result=await call('/api/issues',{category:el('support-category').value,message:el('support-message').value,request_id:requestId,context});el('support-message').value='';requestId=null;notice(`反馈已保存（${result.issue.id}）。处理回复会显示在下方。`);await refresh();}
  catch(error){notice(error.message,true);}
  finally{el('support-submit').disabled=false;}
 };
 el('support-refresh').onclick=()=>refresh();
 signedIn();
 if(!endpoint){notice('反馈服务尚未配置。',true);return;}
 if(session)refresh();
 else if(typeof token==='string'&&token)call('/api/session',{},token).then(result=>{remember(result.access_token);return refresh();}).catch(()=>{signedIn();});
 setInterval(()=>{if(!document.hidden)refresh();},15000);
})();
