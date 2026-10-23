// 문서는 유지하고 페이지 콘텐츠의 효과만 정리·다시 연결한다.
const havenPageMounts=[],havenPageCleanups=[];
function registerPageMount(mount){havenPageMounts.push(mount);const dispose=mount();if(typeof dispose==='function')havenPageCleanups.push(dispose);}
window.HavenMountPage=()=>{
 havenPageCleanups.splice(0).reverse().forEach(dispose=>dispose());
 havenPageMounts.forEach(mount=>{const dispose=mount();if(typeof dispose==='function')havenPageCleanups.push(dispose);});
 document.dispatchEvent(new CustomEvent('haven:page-mounted'));
};
window.HavenBeforePageSwap=()=>{document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());closePet();stopChase();pets.forEach(cancelVisit);trailLayer.replaceChildren();nextVisit=elapsed+2;};

'use strict';
const members = window.HAVEN_MEMBERS;
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let paused=motionQuery.matches;
// 움직임 설정 버튼을 없앴으므로 과거의 숨은 일시정지 값은 읽지 않는다.
const petLayer=document.querySelector('.pet-layer');
const trailLayer=document.querySelector('.trail-layer');

const popover=document.querySelector('#pet-popover');
const live=document.querySelector('#interaction-status');
let selectedPet=null,lastTime=0,elapsed=0,frameRequest=0,nextScene=18;
let chaseScene=null;
const eventLog=(event,extra={})=>{
  // 별도 gtag를 초기화하지 않는다. 기존 GTM dataLayer를 사용한다.
  if(location.protocol!=='file:'&&location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')
    (window.dataLayer=window.dataLayer||[]).push({event,...extra});
};
function announce(text){live.textContent=text}
const pets=members.map((member,i)=>{
 const el=document.createElement('div');el.className='pet';el.style.setProperty('--member',member.color);el.dataset.member=member.id;el.dataset.state='walk';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='pet-trigger';trigger.dataset.name=member.ko;trigger.setAttribute('aria-label',member.ko+'와 상호작용');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','pet-popover');
 const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;canvas.setAttribute('aria-hidden','true');trigger.append(canvas);
 const emote=document.createElement('span');emote.className='emote';emote.setAttribute('aria-hidden','true');emote.textContent=member.emote;trigger.append(emote);el.append(trigger);petLayer.append(el);
 const image=new Image();image.src=member.atlas;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 const p={member,el,trigger,canvas,ctx,image,x:0,y:0,clock:i*7+Math.random()*35,hover:false,focus:false,action:null,actionUntil:0,lastEmit:0,ready:false,index:i,dash:null,nextDash:12+i*7,present:false,nextMeeting:0,meetingUntil:0};
 el.dataset.present='false';
 image.onload=()=>{p.ready=true;draw(p,0)};
 if(member.extraAtlas){p.extraImage=new Image();p.extraImage.src=member.extraAtlas;p.extraImage.onload=()=>{p.lastDrawn=null}}
 trigger.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'){p.hover=true;if(!p.drag)react(p,'hover')}});
 trigger.addEventListener('pointerleave',()=>{p.hover=false;if(!p.focus&&selectedPet!==p&&!p.action)el.dataset.state='walk'});
 trigger.addEventListener('focus',()=>{p.focus=trigger.matches(':focus-visible');react(p,'hover')});
 trigger.addEventListener('blur',()=>{p.focus=false});
 trigger.addEventListener('click',e=>{if(performance.now()<(p.suppressClickUntil||0)){e.preventDefault();return}openPet(p)});
 installDrag(p);
 return p;
});
function rectFor(p,index){return p.member.frames[Math.min(index,p.member.frames.length-1)]}
function draw(p,index,kind='motion'){
 const key=kind+'-'+index;if(!p.ready||p.lastDrawn===key)return;
 let im=p.image,r=rectFor(p,index);
 if(kind!=='motion'&&p.extraImage?.complete&&p.extraImage.naturalWidth){const frames=p.member.extraFrames?.[kind];if(frames?.length){im=p.extraImage;r=frames[index%frames.length]}}
 p.lastDrawn=key;p.ctx.clearRect(0,0,192,192);p.ctx.drawImage(im,r.x,r.y,r.w,r.h,0,0,192,192);
}
function installDrag(p){
 p.trigger.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  p.dragCandidate={id:e.pointerId,startX:e.clientX,startY:e.clientY,offsetX:e.clientX-p.x,offsetY:e.clientY-p.y,lastX:e.clientX,lastY:e.clientY};
  p.trigger.setPointerCapture(e.pointerId);
 });
 p.trigger.addEventListener('pointermove',e=>{
  const d=p.dragCandidate;if(!d||d.id!==e.pointerId)return;
  if(!p.drag&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>5){
   if(p.gatherScene)releaseGatherPet(p);
   closePet();cancelVisit(p);if(chaseScene&&(chaseScene.leader===p||chaseScene.follower===p))stopChase();
   p.dash=null;p.el.classList.remove('dashing');p.action=null;p.drag=true;p.el.dataset.state='drag';p.el.classList.add('dragging');p.el.style.opacity='1';p.el.style.pointerEvents='';setEmote(p,'!');
   eventLog('haven_character_drag_start',{member_id:p.member.id});
  }
  if(!p.drag)return;e.preventDefault();
  const {w,h,size}=bounds();p.x=Math.max(-size*.25,Math.min(w-size*.75,e.clientX-d.offsetX));p.y=Math.max(30,Math.min(h-size*.6,e.clientY-d.offsetY-9));
  const angle=Math.max(-20,Math.min(20,(e.clientX-d.lastX)*.7));p.el.style.setProperty('--drag-tilt',angle+'deg');
  p.el.style.transform='translate('+Math.round(p.x)+'px,'+Math.round(p.y)+'px)';d.lastX=e.clientX;d.lastY=e.clientY;
 });
 const release=e=>{
  const d=p.dragCandidate;if(!d||d.id!==e.pointerId)return;p.dragCandidate=null;
  if(p.trigger.hasPointerCapture(e.pointerId))p.trigger.releasePointerCapture(e.pointerId);
  if(!p.drag)return;p.drag=false;p.suppressClickUntil=performance.now()+500;p.hover=false;p.focus=false;p.trigger.blur();p.el.classList.remove('dragging');p.el.classList.add('landing');p.landUntil=performance.now()+430;
  const {w,h,size}=bounds();p.x=Math.max(8,Math.min(w-size-8,p.x));p.y=Math.max(95,Math.min(h-size-45,p.y));p.el.style.transform='translate('+p.x+'px,'+p.y+'px)';
  p.returnHold=elapsed+1.2;p.resumeFrom={x:p.x,y:p.y,at:p.returnHold};p.nextDash=elapsed+15;p.nextMeeting=elapsed+4;react(p,'hover');setEmote(p,p.member.id==='riela'?'앗!':'♡');
  const drop=document.elementsFromPoint(Math.max(0,Math.min(innerWidth-1,p.x+35)),Math.max(0,Math.min(innerHeight-1,p.y+60))).find(el=>el.matches?.('.member-card'))||[...document.querySelectorAll('.member-card')].find(el=>{const r=el.getBoundingClientRect();return p.x+80>r.left&&p.x<r.right&&p.y+90>r.top&&p.y<r.bottom});if(drop)startVisit(p,drop);
  announce(p.member.ko+'를 내려놓았습니다.');eventLog('haven_character_drag_end',{member_id:p.member.id});
 };
 p.trigger.addEventListener('pointerup',release);p.trigger.addEventListener('pointercancel',release);
}
function react(p,state){
 p.el.dataset.state=state;setEmote(p,state==='sing'?'♪ ♫':state==='heart'?'♥':state==='wave'?'안녕':p.member.emote);
}
function setEmote(p,text){const bubble=p.el.querySelector('.emote');if(bubble.textContent!==text)bubble.textContent=text;bubble.dataset.short=String(text.trim().length<=4)}
function fitPetBubble(p){
 const bubble=p.el.querySelector('.emote'),text=bubble.textContent;if(!text)return;
 const key=text+'|'+innerWidth+'|'+bubble.dataset.short+'|'+p.el.classList.contains('visiting')+'|'+p.protesting;
 if(p.bubbleLayoutKey!==key){p.bubbleLayoutKey=key;p.bubbleWidth=bubble.offsetWidth;p.bubbleHeight=bubble.offsetHeight}
 const width=p.bubbleWidth,height=p.bubbleHeight,center=p.x+bounds().size/2;
 const left=center-width/2,top=p.y+12-height;
 const dx=Math.max(12,Math.min(innerWidth-width-12,left))-left,dy=Math.max(12,Math.min(innerHeight-height-12,top))-top;
 const offset=dx.toFixed(1)+','+dy.toFixed(1);if(p.bubbleOffset!==offset){p.bubbleOffset=offset;bubble.style.setProperty('--bubble-x',dx.toFixed(1)+'px');bubble.style.setProperty('--bubble-y',dy.toFixed(1)+'px')}
}
document.fonts?.ready.then(()=>pets.forEach(p=>{p.bubbleLayoutKey=''}));
function setPaused(value,persist=true){
 paused=value;document.body.classList.toggle('motion-paused',value);

 if(persist)try{localStorage.setItem('haven-motion',value?'paused':'playing')}catch{}
 if(value){stopChase();pets.forEach(cancelVisit);trailLayer.replaceChildren();pets.forEach(p=>{p.dash=null;p.el.classList.remove('dashing');if(p.present)position(p);p.el.style.opacity='1';p.el.style.pointerEvents='';if(!p.action)draw(p,0)})}
 eventLog('haven_motion_toggle',{motion_state:value?'paused':'playing'});
}

motionQuery.addEventListener('change',e=>setPaused(e.matches,false));
function bounds(){return {w:innerWidth,h:innerHeight,size:innerWidth<=800?80:100}}
function position(p){
 const {w,h,size}=bounds(),t=p.clock*.045,i=p.index;
 // 긴 여백과 화면 가장자리를 연결하며 멤버마다 속도와 보폭을 다르게 한다.
 const x=.5+.43*Math.sin(t*(1+i*.08)+i*1.62);
 const y=.5+.32*Math.sin(t*.72+i*1.83);
 p.x=Math.max(8,Math.min(w-size-8,x*(w-size)));
 p.y=Math.max(110,Math.min(h-size-85,y*(h-size)));
 if(p.resumeFrom){
  const blend=Math.max(0,Math.min(1,(elapsed-p.resumeFrom.at)/1.2));
  p.x=p.resumeFrom.x+(p.x-p.resumeFrom.x)*blend;p.y=p.resumeFrom.y+(p.y-p.resumeFrom.y)*blend;
  if(blend>=1)p.resumeFrom=null;
 }
 p.el.style.transform='translate('+Math.round(p.x)+'px,'+Math.round(p.y)+'px)';
}
let blockerCache=[],blockerStamp=-1;
function blocked(p){
 if(p.visitScene)return false;
 if(elapsed-blockerStamp>.15){
  blockerCache=[...document.querySelectorAll('.site-header nav,.section-jump,.hero-actions a,.hero-tagline,.member-card,.channel-card,.coming-copy,.site-footer')].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);blockerStamp=elapsed;
 }
 const {size}=bounds();return blockerCache.some(r=>p.x+size-16>r.left&&p.x+16<r.right&&p.y+size>r.top&&p.y+12<r.bottom);
}
let scrollingUntil=0;
addEventListener('scroll',()=>{blockerStamp=-1;scrollingUntil=performance.now()+140},{passive:true});
addEventListener('resize',()=>{blockerStamp=-1});
function emit(p,kind){
 if(paused||trailLayer.childElementCount>52)return;
 const s=document.createElement('span');s.className='mote power-'+p.member.id+(kind==='heart'?' heart':'');s.style.setProperty('--member',p.member.color);
 s.style.setProperty('--drift',(Math.random()*54-27)+'px');s.style.setProperty('--spin',(Math.random()*180-90)+'deg');
 if(p.member.id==='riela'){s.textContent='✦';s.style.color=['#b9dde3','#f4dcaa','#d9b8eb','#f0b5bf'][Math.floor(Math.random()*4)];s.style.animationDuration=(1.2+Math.random()*1.3)+'s'}
 s.style.left=(p.x+24+Math.random()*35)+'px';s.style.top=(p.y+75)+'px';
 if(kind==='heart')s.textContent='♥';
 trailLayer.append(s);s.addEventListener('animationend',()=>s.remove(),{once:true});setTimeout(()=>s.remove(),1800);
}
function startDash(p){
 if(paused||p.gatherScene)return false;
 const {w,h,size}=bounds();
 const exitRight=p.index%2===0;
 const targetY=Math.max(125,Math.min(h-size-90,170+(p.index*.19+.11)*(h-360)));
 p.dash={phase:0,t:0,from:{x:p.x,y:p.y},exit:{x:exitRight?w+size+35:-size-35,y:targetY},entry:{x:exitRight?-size-35:w+size+35,y:targetY+25},home:{x:w*(exitRight?.27:.68),y:Math.max(125,Math.min(h-size-95,targetY+40))},duration:.42};
 p.el.classList.add('dashing');p.el.dataset.state='dash';p.el.style.opacity='1';
 eventLog('haven_character_interact',{member_id:p.member.id,interaction_type:'dash'});return true;
}
function enterPet(p,instant=false){
 p.present=true;p.el.dataset.present='true';p.el.style.opacity='1';p.el.style.pointerEvents='';p.clock=Math.random()*120;
 position(p);const home={x:p.x,y:p.y};
 if(!instant){const {w,size}=bounds(),right=Math.random()>.5;
  p.x=right?w+size+30:-size-30;p.el.style.transform='translate('+p.x+'px,'+p.y+'px)';
  p.dash={phase:2,t:0,from:{x:p.x,y:p.y},home,duration:Math.random()<.2?.55:1.4,entry:{x:p.x,y:p.y},departOnly:false};
 }
}
function leavePet(p){
 if(!startDash(p))return;p.dash.departOnly=true;p.dash.duration=Math.random()<.22?.42:1.3;p.el.dataset.state='depart';
}
function randomPresence(initial=false){
 const shuffled=[...pets].sort(()=>Math.random()-.5),count=1+Math.floor(Math.random()*4),chosen=new Set(shuffled.slice(0,count));
 pets.forEach(p=>{if(chosen.has(p)&&!p.present)enterPet(p,initial);else if(!chosen.has(p)&&p.present&&!p.hover&&!p.focus&&!p.action&&!p.drag&&!p.visitScene&&selectedPet!==p&&!p.dash)leavePet(p)});
 nextScene=elapsed+14+Math.random()*10;
}
function advanceDash(p,dt){
 const d=p.dash,{w,h}=bounds();d.t+=dt;
 if(d.phase===1){
  // 화면 바깥에서 잠시 머문 뒤 반대 가장자리에서 같은 멤버가 돌아온다.
  if(d.t<.8)return;
  d.phase=2;d.t=0;d.duration=.85;d.from=d.entry;
 }
 const target=d.phase===0?d.exit:d.home;
 const t=Math.min(d.t/d.duration,1),q=d.phase===0?t:1-Math.pow(1-t,2);
 p.x=d.from.x+(target.x-d.from.x)*q;p.y=d.from.y+(target.y-d.from.y)*q;
 p.el.style.transform='translate('+Math.round(p.x)+'px,'+Math.round(p.y)+'px)';
 if(t>=1){
  if(d.phase===0){d.phase=1;d.t=0}
  else{p.dash=null;p.el.classList.remove('dashing');p.nextDash=elapsed+20+p.index*4;react(p,'walk');
   // 재진입 지점에서 일반 이동으로 자연스럽게 이어갈 시간을 둔다.
   p.returnHold=elapsed+1.4;p.resumeFrom={x:p.x,y:p.y,at:p.returnHold};
  }
 }
 if(d.departOnly&&d.phase===1){p.present=false;p.el.dataset.present='false';p.dash=null;p.el.classList.remove('dashing')}
}
function available(p){return p.present&&!p.gatherScene&&!p.visitScene&&!p.drag&&!p.hover&&!p.focus&&!p.action&&!p.dash&&selectedPet!==p&&elapsed>p.nextMeeting}
function stopChase(){if(!chaseScene)return;for(const p of [chaseScene.leader,chaseScene.follower]){p.protesting=false;p.el.classList.remove('protesting','chase-answer','dashing');p.resumeFrom={x:p.x,y:p.y,at:elapsed};react(p,'walk')}chaseScene=null}
function startChase(follower){
 const leader=pets.find(p=>p.member.id==='riela');if(paused||!leader||!available(leader)||!available(follower))return false;
 const {w,h,size}=bounds();chaseScene={leader,follower,t:0,duration:4.2,x:leader.x,y:leader.y,followerRawX:follower.x,dir:leader.x<w/2?1:-1,history:[{t:0,x:leader.x,y:leader.y}]};
 leader.nextMeeting=elapsed+28;follower.nextMeeting=elapsed+28;leader.el.dataset.state='chase';follower.el.dataset.state='chase';leader.el.classList.add('dashing');follower.el.classList.add('dashing');
 return true;
}
function advanceChase(dt){
 if(!chaseScene)return;const c=chaseScene,a=c.leader,b=c.follower;
 if(a.hover||b.hover||a.focus||b.focus||a.drag||b.drag||selectedPet===a||selectedPet===b||paused)return;
 c.t+=dt;const {w,h,size}=bounds(),progress=Math.min(c.t/c.duration,1);
 const cx=c.x+c.dir*progress*(w*.7),span=w+size*2;
 a.x=((cx+size)%span+span)%span-size;a.y=Math.max(125,Math.min(h-size-95,c.y+Math.sin(c.t*2.5)*36));
 c.history.push({t:c.t,x:cx,y:a.y});const target=c.history.findLast(q=>q.t<=c.t-.48)||c.history[0];
 c.followerRawX+=(target.x-c.followerRawX)*Math.min(dt*9,1);b.x=((c.followerRawX+size)%span+span)%span-size;b.y+=(target.y-b.y)*Math.min(dt*9,1);
 for(const p of [a,b]){p.el.style.transform='translate('+Math.round(p.x)+'px,'+Math.round(p.y)+'px)';p.el.style.opacity=blocked(p)?'.55':'1';p.el.style.pointerEvents=blocked(p)?'none':'';}
 const protest=c.t>1.15&&c.t<2.65;
 if(protest&&!a.protesting){a.protesting=true;a.el.classList.add('protesting');setEmote(a,'언니, 그만 쫓아와!');b.el.dataset.state='wave';setEmote(b,'♡');b.el.classList.add('chase-answer')}
 if(!protest&&a.protesting){a.protesting=false;a.el.classList.remove('protesting');b.el.classList.remove('chase-answer')}
 if(c.t>=c.duration){chaseScene=null;for(const p of [a,b]){p.x=Math.max(12,Math.min(w-size-12,p.x));p.y=Math.max(125,Math.min(h-size-95,p.y));p.el.style.transform='translate('+p.x+'px,'+p.y+'px)';p.el.classList.remove('dashing');p.action='heart';p.actionUntil=performance.now()+2300;react(p,'heart');p.returnHold=elapsed+3;p.resumeFrom={x:p.x,y:p.y,at:p.returnHold}}}
}
function meeting(now){
 if(paused||chaseScene||document.querySelector('dialog[open]'))return;
 for(let i=0;i<pets.length;i++)for(let j=i+1;j<pets.length;j++){
  const a=pets[i],b=pets[j];if(!available(a)||!available(b)||blocked(a)||blocked(b))continue;
  if(Math.hypot(a.x-b.x,a.y-b.y)>100)continue;
  const young=a.member.id==='riela'?a:b.member.id==='riela'?b:null,other=young==a?b:a;
  if(young&&['loen','serian'].includes(other.member.id)&&Math.random()<.6&&startChase(other))return;
  const warm=a.member.id==='yuria'||b.member.id==='yuria'||young;
  for(const p of [a,b]){p.action=warm?'heart':'wave';p.actionUntil=now+3000;p.nextMeeting=elapsed+22;p.el.dataset.meeting='true';p.meetingUntil=now+3000;react(p,p.action);p.el.style.setProperty('--meet-tilt',(p.x<(p===a?b.x:a.x)?'5':'-5')+'deg')}
  return;
 }
}
function animate(now){
 if(!lastTime)lastTime=now;const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;elapsed+=dt;
 const modalOpen=!!document.querySelector('dialog[open]')||!!window.HavenRouteBusy;
 if(!paused&&!modalOpen&&elapsed>nextScene&&!chaseScene&&!pets.some(p=>p.gatherScene))randomPresence();
 if(!paused&&!modalOpen)advanceChase(dt);
 pets.forEach(p=>{
  if(!p.present)return;
  if(p.gatherScene){advanceGather(p,dt,now,modalOpen);fitPetBubble(p);return;}
  if(p.visitScene&&!paused&&!modalOpen&&!p.drag)advanceVisit(p,dt);
  const chasing=chaseScene&&(chaseScene.leader===p||chaseScene.follower===p);
  const held=p.visitScene||p.drag||p.hover||p.focus||selectedPet===p||p.action||modalOpen;
  if(!chasing&&!paused&&!held&&!p.dash&&elapsed>p.nextDash&&!pets.some(q=>q!==p&&q.dash)){startDash(p)}
  if(!chasing&&!paused&&!held&&p.dash){advanceDash(p,dt)}
  else if(!chasing&&!paused&&!held&&(!p.returnHold||elapsed>p.returnHold)){
   p.clock+=dt*1.8*(p.index===1?1.45:p.index===2?.8:1);
   position(p);
   // 넘나드는 경로에서도 링크·버튼 위에 머무르지 않는다.
   if(blocked(p)){p.el.style.pointerEvents='none';p.el.style.opacity='.55'}else{p.el.style.pointerEvents='';p.el.style.opacity='1'}
  }
  if(!p.el.style.transform)position(p);
  if(p.landUntil&&now>p.landUntil){p.el.classList.remove('landing');p.landUntil=0;react(p,p.hover?'hover':'walk')}
  if(p.meetingUntil&&now>p.meetingUntil){p.el.dataset.meeting='false';p.meetingUntil=0}
  if(p.action&&now>p.actionUntil){p.action=null;react(p,selectedPet===p||p.hover||p.focus?'hover':'walk')}
  let state=p.action||(p.hover||p.focus||selectedPet===p?'hover':'walk');
  if(paused&&!p.action)state=p.hover||p.focus||selectedPet===p?'hover':'idle';
  const frames=state==='sing'?[6,7]:state==='wave'||state==='hover'?[4,5]:state==='heart'?[4,5]:state==='idle'?[0]:p.dash||chasing?[1,3,2,3]:p.index===1?[1,3,2,3]:[0,1,0,2];
  const ix=paused?frames[0]:frames[Math.floor(elapsed*(state==='sing'?4:p.dash||chasing?10:8))%frames.length];
  if(p.drag)draw(p,paused?0:Math.floor(elapsed*7)%4,'drag');
  else if(chasing&&p.member.id==='riela'&&p.protesting)draw(p,Math.floor(elapsed*7)%4,'chase');
  else draw(p,ix);
  if(!paused&&!modalOpen&&!held&&elapsed-p.lastEmit>.3){emit(p,p.action);p.lastEmit=elapsed}
  fitPetBubble(p);
 });
 if(!paused&&!modalOpen)visitSceneScheduler(now);
 meeting(now);
 frameRequest=requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){cancelAnimationFrame(frameRequest);frameRequest=0}else if(!frameRequest){lastTime=0;frameRequest=requestAnimationFrame(animate)}
});
function placePopover(p){
 const r=p.trigger.getBoundingClientRect();
 popover.style.left=Math.max(16,Math.min(innerWidth-264,r.left-65))+'px';
 const ph=popover.offsetHeight,below=r.bottom+12;popover.style.top=Math.max(95,Math.min(innerHeight-ph-75,below+ph<innerHeight-70?below:r.top-ph-10))+'px';
}
function openPet(p){
 if(selectedPet===p&&!popover.hidden){closePet();return}
 if(selectedPet)selectedPet.trigger.setAttribute('aria-expanded','false');
 selectedPet=p;popover.hidden=false;popover.querySelector('strong').textContent=p.member.ko;popover.style.setProperty('--member',p.member.color);
 p.trigger.setAttribute('aria-expanded','true');react(p,'hover');placePopover(p);
 announce(p.member.ko+'의 동작을 골라주세요.');eventLog('haven_character_interact',{member_id:p.member.id,interaction_type:'open'});
}
function closePet(returnFocus=false){
 if(!selectedPet)return;const p=selectedPet;selectedPet=null;popover.hidden=true;p.trigger.setAttribute('aria-expanded','false');
 if(returnFocus)p.trigger.focus();if(!p.action)react(p,p.hover||p.focus?'hover':'walk');
}
popover.querySelector('[data-close-pet]').addEventListener('click',()=>closePet(true));
popover.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{
 if(!selectedPet)return;const p=selectedPet;
 if(p.gatherScene)releaseGatherPet(p);
 if(b.dataset.action==='dash'){
  if(paused){announce('움직임을 켜면 질주를 볼 수 있습니다.');return}
  closePet();p.trigger.blur();p.hover=false;p.focus=false;p.action=null;startDash(p);announce(p.member.ko+'가 화면 밖으로 나갔다가 다시 들어옵니다.');return;
 }
 p.action=b.dataset.action;p.actionUntil=performance.now()+4500;react(p,p.action);
 activateResonance(p.member,null,'character_action');
 announce(p.member.ko+(p.action==='sing'?'가 노래하는 동작을 보여줍니다. 소리는 재생되지 않습니다.':p.action==='wave'?'가 손을 흔듭니다.':'가 하트를 보냅니다.'));
 eventLog('haven_character_interact',{member_id:p.member.id,interaction_type:p.action});
}));
document.addEventListener('pointerdown',e=>{if(selectedPet&&!popover.contains(e.target)&&!selectedPet.el.contains(e.target)&&!e.target.closest('[data-summon]'))closePet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selectedPet)closePet(true)});
addEventListener('resize',()=>{pets.forEach(position);if(selectedPet)placePopover(selectedPet)});
const profile=document.querySelector('#profile-dialog');
registerPageMount(()=>{
document.querySelectorAll('.member-card').forEach(b=>b.addEventListener('click',async e=>{
 if(e.pointerType==='touch'&&!motionQuery.matches){b.classList.add('is-photo-preview');await new Promise(resolve=>setTimeout(resolve,360));}
 closePet();const m=members.find(m=>m.id===b.dataset.member);
 profile.querySelector('.profile-photo').src=m.portrait;
 profile.style.setProperty('--member',m.color);
 profile.querySelector('.profile-photo').alt=m.ko+' 캐릭터 이미지';
 profile.querySelector('#profile-title').textContent=m.name;
 profile.querySelector('.ko-name').textContent=m.ko+' · '+m.age+'세'+(m.id==='loen'?' · 리더':'');
 profile.querySelector('.identity').textContent=m.identity;
 profile.querySelector('.power').textContent=m.power;
 profile.querySelector('.story').textContent=m.story;

 profile.showModal();eventLog('haven_member_open',{member_id:m.id});
}));
});

document.querySelectorAll('dialog').forEach(d=>{
 d.querySelector('.close').addEventListener('click',()=>d.close());
 d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}});
});
registerPageMount(()=>document.querySelectorAll('main [data-platform]').forEach(a=>a.addEventListener('click',()=>eventLog('haven_channel_click',{platform:a.dataset.platform}))));
randomPresence(true);setPaused(paused,false);frameRequest=requestAnimationFrame(animate);


registerPageMount(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const fine=matchMedia('(hover:hover) and (pointer:fine)');
 const hero=document.querySelector('.hero-center');
 const cards=[...document.querySelectorAll('.member-card')];
 function reset(el,keys){keys.forEach(k=>el.style.removeProperty(k))}
 const heroKeys=['--typo-rx','--typo-ry','--typo-x','--typo-y'];
hero?.addEventListener('pointerleave',()=>reset(hero,heroKeys));
 cards.forEach((card,i)=>{
  const keys=['--photo-rx','--photo-ry','--photo-x','--photo-y','--light-x','--light-y'];
  card.style.setProperty('--reveal-delay',(i*85)+'ms');
  card.addEventListener('pointermove',e=>{
   if(reduced.matches||!fine.matches)return;
   const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
   card.style.setProperty('--light-x',((x+.5)*100)+'%');card.style.setProperty('--light-y',((y+.5)*100)+'%');
  });
  card.addEventListener('pointerleave',()=>reset(card,keys));
 });
 let observer=null;
 if(!reduced.matches&&'IntersectionObserver' in window){
  document.documentElement.classList.add('motion-ready');
  observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target)}}),{threshold:.12});
  cards.forEach(c=>observer.observe(c));
 }
 const change=()=>{if(hero)reset(hero,heroKeys);cards.forEach(c=>{c.classList.add('is-visible');reset(c,['--photo-rx','--photo-ry','--photo-x','--photo-y'])})};
 reduced.addEventListener('change',change);
 return ()=>{observer?.disconnect();reduced.removeEventListener('change',change);};
});

;(()=>{
 const links=[...document.querySelectorAll('.section-jump a')];
 if(document.body.dataset.page)return;
 const sections=links.map(a=>document.querySelector(a.getAttribute('href')));
 let scheduled=false;
 function update(){
  scheduled=false;let active=0;const marker=innerHeight*.45;
  sections.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<=marker)active=i});
  if(scrollY+innerHeight>=document.documentElement.scrollHeight-8)active=links.length-1;
  links.forEach((a,i)=>{if(i===active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
 }
 function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(update)}}
 addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);addEventListener('hashchange',queue);update();
})();

// 작은 멤버가 페이지 속 사진·타이포·장식을 발견하는 짧은 장면.
let nextVisit=6;
function activePetSurface(){const marker=innerHeight*.55;return [...document.querySelectorAll('.hero,.chapter-layer>.section')].reverse().find(el=>{const r=el.getBoundingClientRect();return r.top<marker&&r.bottom>marker})||document.querySelector('.hero')}
let lastPetSurface=null;
document.addEventListener('haven:surface',()=>{const surface=activePetSurface();if(surface!==lastPetSurface){lastPetSurface=surface;nextVisit=Math.min(nextVisit,elapsed+2.2)}});
function cancelVisit(p){
 const v=p.visitScene;if(!v)return;
 if(!pets.some(q=>q!==p&&q.visitScene?.target===v.target)){v.target.classList.remove('little-visited');delete v.target.dataset.littleVisitor;}
 p.visitScene=null;p.el.classList.remove('visiting','talking');p.action=null;p.resumeFrom={x:p.x,y:p.y,at:elapsed};
}
function startVisit(p,target,options={}){
 if(paused||!p.present||p.drag)return false;
 const r=target.getBoundingClientRect(),{size,h}=bounds();
 if(r.bottom<80||r.top>h-80)return false;
 cancelVisit(p);if(chaseScene&&(chaseScene.leader===p||chaseScene.follower===p))stopChase();
 const own=target.dataset.member===p.member.id,other=target.dataset.member;
 let text=own?selfPortraitLines[p.member.id]:other==='riela'&&p.member.id==='yuria'?'우리 막내 ♡':p.member.id==='riela'&&other?'언니, 여기 봐!':other?'같이 놀자!':p.member.id==='riela'?'별아, 이리 와!':p.member.id==='yuria'?'반짝!':p.member.id==='serian'?'살짝 띄워볼까?':'빛을 더해볼까?';
 if(!own&&other&&!options.deferDialogue)text=variedReaction(p,target,0,1,new Set());
 p.dash=null;p.el.classList.remove('dashing');p.hover=false;p.focus=false;
 p.visitScene={target,t:0,from:{x:p.x,y:p.y},text,own};p.el.classList.add('visiting');p.el.style.opacity='1';p.el.style.pointerEvents='';p.nextMeeting=elapsed+12;
 eventLog('haven_character_page_interact',{member_id:p.member.id,target_member:other||'page',interaction_type:own?'self_portrait':other?'member_portrait':'page_power'});return true;
}
function advanceVisit(p,dt){
 const v=p.visitScene;if(p.hover||p.focus||selectedPet===p||v.group?.some(q=>q.hover||q.focus||selectedPet===q))return;v.t+=dt;const r=v.target.getBoundingClientRect(),{w,h,size}=bounds();
 if(r.bottom<60||r.top>h-50||v.t>(v.group?2+v.group.length*1.1:4.4)){cancelVisit(p);p.nextDash=elapsed+12;react(p,'walk');return}
 // 카드의 얼굴 중앙이 아닌 모서리에 잠깐 걸터앉는다.
 const tx=Math.max(5,Math.min(w-size-6,v.group?r.left+(v.slot+.5)*r.width/v.group.length-size*.45:r.right-size*.72)),ty=Math.max(90,Math.min(h-size-20,r.bottom-size*.9));
 const q=1-Math.pow(1-Math.min(v.t/.65,1),3);
 p.x=v.from.x+(tx-v.from.x)*q;p.y=v.from.y+(ty-v.from.y)*q;
 p.el.style.transform='translate('+Math.round(p.x)+'px,'+Math.round(p.y)+'px)';p.el.style.opacity='1';p.el.style.pointerEvents='';
 if(v.t>.65){
  v.target.classList.add('little-visited');v.target.dataset.littleVisitor=p.member.id;v.target.style.setProperty('--visitor-color',p.member.color);
  p.action=v.own?'heart':'wave';p.actionUntil=performance.now()+200;p.el.dataset.state=p.action;setEmote(p,v.text);const talking=!v.group||(v.t>1+(v.turn??v.slot)*1.1&&v.t<2.15+(v.turn??v.slot)*1.1);p.el.classList.toggle('talking',talking);if(talking&&!v.powerStarted){v.powerStarted=true;activateResonance(p.member,v.target,'autonomous')}
  if(elapsed-p.lastEmit>.22){emit(p,v.own?'heart':null);p.lastEmit=elapsed}
 }
}
function visitSceneScheduler(now){
 if(now<scrollingUntil||elapsed<nextVisit||chaseScene||pets.some(p=>p.drag||p.visitScene))return;
 nextVisit=elapsed+8+Math.random()*6;
 const candidates=pets.filter(available);if(!candidates.length)return;
 const p=candidates[Math.floor(Math.random()*candidates.length)];
 const surface=activePetSurface();
 const visible=[...surface.querySelectorAll('.member-card,.channel-card,.hero h1,.coming-art,.section-heading h2')].filter(el=>{const r=el.getBoundingClientRect();return r.top>40&&r.bottom<innerHeight-25});
 if(!visible.length)return;
 const own=visible.find(el=>el.dataset.member===p.member.id);
 const cards=visible.filter(el=>el.matches('.member-card,.channel-card'));
 const pool=cards.length&&Math.random()<.8?cards:visible;
 const target=own&&Math.random()<.5?own:pool[Math.floor(Math.random()*pool.length)];
 if(target.matches('.member-card')&&candidates.length>1&&Math.random()<.7){const count=2+Math.floor(Math.random()*(Math.min(4,candidates.length)-1));startPortraitGroup(target,[p,...candidates.filter(q=>q!==p).sort(()=>Math.random()-.5)].slice(0,count))}else startVisit(p,target);
}

// 자기 사진의 첫마디는 사용자 지정 문구. 그 외 대사는 성격별 연출 시안.
const selfPortraitLines={loen:'나야!',riela:'저에요!',serian:'나야.',yuria:'나네.'};
const reactionBank={
 loen:['여기서 만나니까 반갑네.','좋아, 같이 보고 가자.','리엘라, 이쪽에서도 보여.','서두르지 않아도 괜찮아.','우리 같이 서볼까?','네 표정, 잘 나왔는데?','다들 여기 있었구나.','자, 한 명씩 봐줄게.','오늘도 반짝이네.','네가 웃으니까 좋다.','이쪽 자리 비워둘게.','우리 다음 장면도 같이 가자.'],
 yuria:['어, 여기 다 모였네!','잠깐, 나도 볼래!','이쪽에서 보면 더 잘 보여!','우리 막내 찾았다!','나랑 같이 구경하자!','여기서 사진 찍을까?','이 장면 마음에 드는데?','한 바퀴 더 돌고 올까?','좋아, 다음은 어디야?','내가 먼저 가서 볼게!','어때, 꽤 근사하지?','다들 이쪽으로 와봐!'],
 serian:['잘 나왔네.','그 자리 괜찮네.','조금만 옆으로.','여기서 보면 되겠네.','응, 보고 있어.','잠깐 쉬어도 되겠어.','이 장면은 기억해둘게.','같이 보니까 좋네.','먼저 보고 있어.','그쪽 빛이 괜찮아.','괜찮아. 천천히 봐.','나도 여기 있을게.'],
 riela:['언니, 이것 좀 보세요!','저도 같이 볼래요.','여기 별 하나 놓을까요?','이쪽에도 자리 있어요!','제 사진 찾으셨어요?','같이 있으니까 좋네요.','언니도 잘 나왔어요!','조금만 더 보고 가요.','별들도 구경하고 싶대요.','여기, 반짝이는 거 보세요!','이번엔 제가 먼저 찾았어요.','그럼 다음은 제가 안내할게요!']
};
const reactionHistory=new Map();
function variedReaction(p,target,slot,count,used){
 const key=p.member.id;let history=reactionHistory.get(key)||[];
 const targetId=target.dataset.member;
 const positional=p.member.id==='riela'?(slot===0?'이쪽에서 같이 봐요!':'언니, 옆에 있어도 돼요?'):p.member.id==='serian'?(slot===0?'이쪽은 내가 볼게.':'옆에 있을게.'):p.member.id==='yuria'?(slot===0?'내 옆으로 모여봐!':'여기 자리 있다!'):slot===0?'이쪽으로 와도 돼.':'옆에서 같이 보자.';
 const groupLine=p.member.id==='riela'?({2:'둘이 보니까 더 좋네요!',3:'셋이서 별을 찾아볼까요?',4:'네 명 다 모였어요!'})[count]:p.member.id==='serian'?({2:'둘이서 보는 것도 좋네.',3:'셋 다 여기 있었네.',4:'다 모였네.'})[count]:p.member.id==='yuria'?({2:'둘이 한 바퀴 돌까?',3:'셋이니까 더 신나는데!',4:'우리 넷, 여기 모였다!'})[count]:({2:'우리 둘이 잠깐 볼까?',3:'셋이 같이 보고 가자.',4:'네 명 다 있으니까 좋다.'})[count];
 let bank=[...reactionBank[key],positional,groupLine].filter(Boolean);
 if(targetId!==p.member.id)bank=bank.filter(t=>!t.includes('제 사진'));
 // 관계에 맞지 않는 호칭은 그 장면에서 제외한다.
 if(!['riela'].includes(targetId))bank=bank.filter(t=>!t.includes('막내')&&!t.startsWith('리엘라,'));
 let options=bank.filter(t=>!used.has(t)&&!history.includes(t));
 if(!options.length){history=history.slice(-3);options=bank.filter(t=>!used.has(t)&&!history.includes(t))}
 const text=options[Math.floor(Math.random()*options.length)]||positional;
 history.push(text);reactionHistory.set(key,history);used.add(text);return text;
}
function startPortraitGroup(target,cast){
 const usable=cast.filter(p=>p.present&&!p.drag).slice(0,4);if(!usable.length)return false;
 const order=usable.sort((a,b)=>a.x-b.x),used=new Set();const speaking=[...order].sort((a,b)=>{const rank=p=>p.member.id===target.dataset.member?0:p.member.id==='loen'?1:2;return rank(a)-rank(b)});
 order.forEach((p,slot)=>{if(!startVisit(p,target,{deferDialogue:true}))return;const v=p.visitScene;v.group=order;v.slot=slot;v.turn=speaking.indexOf(p);v.text=v.own?selfPortraitLines[p.member.id]:variedReaction(p,target,slot,order.length,used);used.add(v.text)});
 return true;
}

;(()=>{
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 if(document.body.dataset.page)return;
 let animation=0,transitioning=false,targetIndex=0,direction=0,lastWheel=0,accum=0,lastInput=0;
 function points(){const max=document.documentElement.scrollHeight-innerHeight;const values=[0,...['members','next','channels'].map(id=>scrollY+document.getElementById(id).getBoundingClientRect().top)];if(max-values.at(-1)>80)values.push(max);return [...new Set(values.map(y=>Math.max(0,Math.min(max,Math.round(y)))))];}
 function nearest(ys){let best=0;ys.forEach((y,i)=>{if(Math.abs(y-scrollY)<Math.abs(ys[best]-scrollY))best=i});return best;}
 function go(index){
  const ys=points();targetIndex=Math.max(0,Math.min(ys.length-1,index));const to=ys[targetIndex],from=scrollY;
  cancelAnimationFrame(animation);
  if(reduce.matches){scrollTo({top:to,behavior:'instant'});transitioning=false;return;}
  transitioning=true;document.documentElement.classList.add('is-section-scrolling');
  const start=performance.now(),duration=520;
  function frame(now){const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);scrollTo({top:from+(to-from)*ease,behavior:'instant'});if(t<1)animation=requestAnimationFrame(frame);else{transitioning=false;document.documentElement.classList.remove('is-section-scrolling')}}
  animation=requestAnimationFrame(frame);
 }
 addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)||Math.abs(e.deltaY)<1||document.querySelector('dialog[open]')||e.target.closest?.('.pet-popover'))return;
  if(reduce.matches)return;
  const amount=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);
  const now=performance.now(),dir=Math.sign(amount),quiet=now-lastWheel;lastWheel=now;
  e.preventDefault();
  if(transitioning){if(dir!==direction){direction=dir;go(targetIndex+dir)}return;}
  if(quiet<170&&dir===direction&&accum===0)return;
  accum=quiet>150||dir!==lastInput?amount:accum+amount;lastInput=dir;
  if(Math.abs(accum)<22)return;
  direction=dir;accum=0;const ys=points(),current=nearest(ys);go(current+dir);
 },{passive:false});
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
  const id=a.getAttribute('href').slice(1);if(!['home','members','next','channels','page-end'].includes(id))return;const to=id==='home'?0:id==='page-end'?document.documentElement.scrollHeight-innerHeight:scrollY+document.getElementById(id).getBoundingClientRect().top;const ys=points();let index=0;ys.forEach((y,i)=>{if(Math.abs(y-to)<Math.abs(ys[index]-to))index=i});
  e.preventDefault();history.replaceState(null,'','#'+id);direction=0;go(index);
 }));
 // 스크롤바나 터치를 직접 잡으면 전환을 즉시 넘겨준다.
 addEventListener('pointerdown',()=>{if(!transitioning)return;cancelAnimationFrame(animation);transitioning=false;document.documentElement.classList.remove('is-section-scrolling')},{passive:true});
 addEventListener('touchstart',()=>{cancelAnimationFrame(animation);transitioning=false;document.documentElement.classList.remove('is-section-scrolling')},{passive:true});
 reduce.addEventListener('change',()=>{cancelAnimationFrame(animation);transitioning=false;document.documentElement.classList.remove('is-section-scrolling')});
})();

// 내려오는 빛과 멤버의 4초 공명. 장식 레이어는 입력·읽기를 가리지 않는다.
let resonanceTimer=0;
const resonanceLayers=new Set();
const powerMotionTimers=new Map();
function activateResonance(member,anchor=null,source='hover'){
 if(motionQuery.matches)return;
 if(source!=='card_preview')window.HavenAmbient?.interact(member.id,source);
 clearTimeout(resonanceTimer);
 document.body.dataset.resonance=member.id;document.documentElement.style.setProperty('--resonance-color',member.color);
 const target=anchor||[...activePetSurface().querySelectorAll('.section-heading h2,.wordmark-wrap')].find(el=>{const r=el.getBoundingClientRect();return r.top>10&&r.bottom<innerHeight-15});
 if(target){
  if(target.matches('.member-card,.channel-card')){
   target.classList.add('is-light-active');
   setTimeout(()=>target.classList.remove('is-light-active'),4000);
  }
  if(source!=='card_preview'){
  const fx=document.createElement('span');fx.className='resonance-fx resonance-'+member.id;fx.setAttribute('aria-hidden','true');
  fx.dataset.ability=member.id;fx.style.setProperty('--resonance-color',member.color);
  for(let i=0;i<6;i++){const dot=document.createElement('i');dot.style.setProperty('--i',i);dot.textContent=member.id==='riela'?'✦':'';fx.append(dot)}
  target.classList.add('resonance-anchor');target.append(fx);resonanceLayers.add(fx);
  if(resonanceLayers.size>8){const oldest=resonanceLayers.values().next().value;oldest.remove();resonanceLayers.delete(oldest)}
  setTimeout(()=>{fx.remove();resonanceLayers.delete(fx)},4000);
  }
 }
 resonanceTimer=setTimeout(()=>{delete document.body.dataset.resonance;document.documentElement.style.removeProperty('--resonance-color')},4000);
 eventLog('haven_member_resonance',{member_id:member.id,source});
}
registerPageMount(()=>{
document.querySelectorAll('.section-heading h2').forEach((h,i)=>{
 const light=document.createElement('span');light.className='heading-downlight';light.setAttribute('aria-hidden','true');light.textContent=h.textContent;light.style.animationDelay=(i*.8)+'s';h.append(light);
});
});

pets.forEach(p=>{
 p.trigger.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')activateResonance(p.member)});
 p.trigger.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')activateResonance(p.member)});
});
motionQuery.addEventListener('change',e=>{if(e.matches){for(const [surface,timer] of powerMotionTimers){clearTimeout(timer);delete surface.dataset.powerMotion}powerMotionTimers.clear();clearTimeout(resonanceTimer);delete document.body.dataset.resonance;document.documentElement.style.removeProperty('--resonance-color');document.querySelectorAll('.resonance-fx:not(.card-hover-fx)').forEach(e=>e.remove())}});

function addAbilityEdge(layer,member){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.classList.add('ability-edge');
 for(let i=0;i<2;i++){
  const flow=layer.classList.contains('card-flow-fx'),inset=flow?(i?24:9):9;
  const rect=document.createElementNS(ns,'rect');rect.setAttribute('x',inset);rect.setAttribute('y',inset);rect.setAttribute('width',1000-inset*2);rect.setAttribute('height',1000-inset*2);rect.setAttribute('rx',layer.parentElement?.matches('.member-card')?'90':'40');rect.setAttribute('pathLength','1000');rect.setAttribute('vector-effect','non-scaling-stroke');rect.setAttribute('fill','none');rect.classList.add('edge-streak');rect.style.setProperty('--edge-phase',i?'-500':'0');if(flow)rect.style.setProperty('--flow-start',i?'-500px':'0px');svg.append(rect);
 }
 if(member.id==='loen'||member.id==='riela'){
  [[60,12],[990,310],[660,990],[12,720]].forEach(([x,y],i)=>{const star=document.createElementNS(ns,'path');star.setAttribute('d',`M ${x} ${y-13} L ${x+3} ${y-3} L ${x+13} ${y} L ${x+3} ${y+3} L ${x} ${y+13} L ${x-3} ${y+3} L ${x-13} ${y} L ${x-3} ${y-3} Z`);star.setAttribute('vector-effect','non-scaling-stroke');star.classList.add('edge-sparkle');star.style.animationDelay=(i*.24)+'s';svg.append(star)});
 }
 layer.append(svg);
}

// 소개를 열기 전부터 보이는 멤버별 호버·키보드 초점 연출.
registerPageMount(()=>{
document.querySelectorAll('.member-card').forEach(card=>{
 const member=members.find(m=>m.id===card.dataset.member);if(!member)return;
 const alternate=card.querySelector('.portrait-alternate');
 if(alternate){const ready=()=>{card.dataset.previewReady='true'};alternate.addEventListener('load',ready,{once:true});if(alternate.complete&&alternate.naturalWidth)ready();}
 card.addEventListener('pointerleave',()=>card.classList.remove('is-photo-preview'));
 const fx=document.createElement('span');fx.className='resonance-fx card-hover-fx card-flow-fx resonance-'+member.id;fx.setAttribute('aria-hidden','true');fx.style.setProperty('--resonance-color',member.color);card.append(fx);addAbilityEdge(fx,member);
 const preview=()=>{if(motionQuery.matches)return;activateResonance(member,card,'card_preview');};
 card.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')preview()});
 card.addEventListener('focus',()=>{if(card.matches(':focus-visible'))preview()});
});
});

const profileVisual=document.querySelector('.profile-visual');
if(profileVisual){
 const fx=document.createElement('span');fx.className='resonance-fx card-hover-fx card-flow-fx';fx.setAttribute('aria-hidden','true');profileVisual.append(fx);addAbilityEdge(fx,members[0]);
}

// 원문을 읽을 수 있게 유지하고 짧은 안내·메뉴·버튼에만 빛의 획을 얹는다.
function addTypeLight(el){
 if(el.classList.contains('type-shimmer'))return;
 el.classList.add('type-shimmer');
 el.dataset.typeLight=el.innerText||el.textContent;
}
registerPageMount(()=>{
document.querySelectorAll('.eyebrow,.section-note,.member-caption small,.member-caption strong,.channel strong,.jump-label,.jump-index,.status-tag,.brand').forEach(addTypeLight);
document.querySelectorAll('.site-header nav a,.btn,.text-button,.scroll-mark,.popover-top strong,.actions button').forEach(el=>{
 [...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()).forEach(n=>{
  const label=document.createElement('span');label.textContent=n.textContent;el.replaceChild(label,n);addTypeLight(label);
 });
});
});

const profileCopy=document.querySelector('.profile-copy');
if(profileCopy){
 const observer=new MutationObserver(()=>profileCopy.querySelectorAll('h2,.ko-name').forEach(el=>{addTypeLight(el);el.dataset.typeLight=el.innerText||el.textContent}));
 observer.observe(profileCopy,{childList:true,subtree:true,characterData:true});
}

// 원화 네 장과 기존 단체 무대 이미지의 전환. 캐릭터 보행을 흉내 내지 않는다.
registerPageMount(()=>{
 const hero=document.querySelector('.hero'),slides=[...document.querySelectorAll('.hero-member-slide')];
 if(!hero||slides.length!==4)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let index=0,timer=0,onScreen=true,frontVisible=true;
 function show(next){
  index=next;
  slides.forEach((slide,i)=>slide.classList.toggle('is-current',i===index));
  hero.dataset.galleryMember=slides[index]?.dataset.character||'stage';
 }
 function schedule(){
  clearTimeout(timer);
  if(reduce.matches||document.hidden||!onScreen||!frontVisible)return;
  timer=setTimeout(()=>{show((index+1)%(slides.length+1));schedule()},4800);
 }
 const change=()=>{show(reduce.matches?4:0);schedule()};
 reduce.addEventListener('change',change);
 document.addEventListener('visibilitychange',schedule);
 const surface=e=>{frontVisible=e.detail.home;schedule()};
 document.addEventListener('haven:surface',surface);
 const observer=new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;schedule()},{threshold:.1});observer.observe(hero);
 show(reduce.matches?4:0);schedule();
 return ()=>{clearTimeout(timer);observer.disconnect();reduce.removeEventListener('change',change);document.removeEventListener('visibilitychange',schedule);document.removeEventListener('haven:surface',surface);};
});

// 7번 타이포만 움직이는 배경 광원. 본문·카드·클릭 영역의 위치는 바꾸지 않는다.
registerPageMount(()=>{
 const source=new URL('assets/typography-07.webp',location.href).href;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const surfaces=[...document.querySelectorAll('.hero,.chapter-layer>.section')];
 const scenes=surfaces.map((surface,index)=>{
  const layer=document.createElement('div');layer.className='type-seven-scene';layer.setAttribute('aria-hidden','true');
  const word=document.createElement('div');word.className='type-seven-wrap';
  const image=new Image();image.src=source;image.alt='';image.width=1440;image.height=412;
  const ink=document.createElement('span');ink.className='type-seven-ink';ink.style.maskImage=`url("${source}")`;ink.style.webkitMaskImage=`url("${source}")`;
  const glow=document.createElement('span');glow.className='type-seven-glow';ink.append(glow);word.append(image,ink);layer.append(word);surface.prepend(layer);
  return {surface,layer,word,ink,phase:index*1.8,nextSpark:0,powerUntil:0,power:'',baseX:0,baseY:0,pushX:0,pushY:0};
 });
 let mask=null,last=0,nextAuto=performance.now()+6500,raf=0;
 const maskImage=new Image();maskImage.src=source;
 maskImage.onload=()=>{try{const c=document.createElement('canvas');c.width=360;c.height=103;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(maskImage,0,0,360,103);mask=ctx.getImageData(0,0,360,103).data;}catch{mask=null;}};
 function visibleScene(){return [...scenes].reverse().find(s=>{const r=s.surface.getBoundingClientRect();return r.top<innerHeight*.55&&r.bottom>innerHeight*.55})||scenes[0]}
 function spark(scene,x=Math.random()*100,y=Math.random()*100,large=false){
  if(scene.ink.querySelectorAll('.type-seven-spark').length>=10)return;
  const dot=document.createElement('i');dot.className='type-seven-spark';dot.style.left=x+'%';dot.style.top=y+'%';dot.style.setProperty('--spark-size',(large?110:30+Math.random()*50)+'px');dot.style.setProperty('--spark-drift',(Math.random()*60-30)+'px');dot.style.animationDuration=(1.3+Math.random()*1.1)+'s';scene.ink.append(dot);dot.addEventListener('animationend',()=>dot.remove(),{once:true});
 }
 function interact(id,source='contact',scene=visibleScene(),point=null){
  if(reduce.matches||document.hidden)return;
  const member=members.find(m=>m.id===id);if(!member)return;
  scene.power=id;scene.powerUntil=performance.now()+4200;scene.word.dataset.power=id;
  scene.word.dataset.interaction=source;scene.word.style.setProperty('--seven-color',member.color);
  scene.pushX=(id==='serian'?42:id==='riela'?-24:id==='yuria'?18:8)*(Math.random()<.5?-1:1);
  scene.pushY=id==='serian'?-34:id==='riela'?-18:id==='yuria'?12:-5;
  for(let i=0;i<4;i++)spark(scene,point?point.x+Math.random()*8-4:Math.random()*100,point?point.y+Math.random()*10-5:20+Math.random()*60,true);
 }
 function sampleHit(scene,p,r){
  const x=p.x+45,y=p.y+45;
  if(x<r.left||x>r.right||y<r.top||y>r.bottom||!mask)return null;
  const u=(x-r.left)/r.width,v=(y-r.top)/r.height;
  if(mask[(Math.min(102,Math.floor(v*103))*360+Math.min(359,Math.floor(u*360)))*4+3]<55)return null;
  return {x:u*100,y:v*100};
 }
 function frame(now){
  if(reduce.matches){raf=0;return;}
  if(now-last>80){
   last=now;const scene=visibleScene();
   for(const s of scenes){
    if(reduce.matches||s!==scene)continue;
    const remaining=Math.max(0,(s.powerUntil-now)/4200),boost=Math.sin(Math.PI*remaining),t=now/1000;
    s.word.style.setProperty('--seven-x',(Math.sin(t*.17+s.phase)*18+s.pushX*boost).toFixed(2)+'px');
    s.word.style.setProperty('--seven-y',(Math.cos(t*.13+s.phase)*8+s.pushY*boost).toFixed(2)+'px');
    s.word.style.setProperty('--seven-r',(Math.sin(t*.11+s.phase)*.55).toFixed(2)+'deg');
    if(s.power&&remaining===0){s.power='';delete s.word.dataset.power;}
   }
   if(!reduce.matches&&!paused&&!document.querySelector('dialog[open]')){
    if(now>scene.nextSpark){spark(scene);scene.nextSpark=now+650+Math.random()*1450;}
    const contactRect=scene.word.getBoundingClientRect();
    for(const p of pets){
     if(!p.present||now<(p.nextWordmarkContact||0))continue;
     const hit=sampleHit(scene,p,contactRect);if(hit){interact(p.member.id,p.drag?'drag-contact':'contact',scene,hit);p.nextWordmarkContact=now+6500;}
    }
    if(now>nextAuto&&!chaseScene){
     const candidates=pets.filter(p=>available(p));
     if(candidates.length){const p=candidates[Math.floor(Math.random()*candidates.length)];interact(p.member.id,'ability');react(p,p.member.id==='serian'?'wave':'heart');p.action='wave';p.actionUntil=now+1400;setEmote(p,{loen:'빛을 더해볼까?',yuria:'살짝 흘려볼까?',serian:'조금 옮길게.',riela:'별들아, 같이 놀아요!'}[p.member.id]);}
     nextAuto=now+15000+Math.random()*10000;
    }
   }
  }
  if(!document.hidden)raf=requestAnimationFrame(frame);
 }
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else if(!raf&&!reduce.matches){last=0;nextAuto=performance.now()+6500;raf=requestAnimationFrame(frame)}};
 document.addEventListener('visibilitychange',visibility);
 const change=()=>{scenes.forEach(s=>{delete s.word.dataset.power;s.power='';s.powerUntil=0;s.word.style.removeProperty('--seven-x');s.word.style.removeProperty('--seven-y');s.word.style.removeProperty('--seven-r');s.ink.querySelectorAll('.type-seven-spark').forEach(i=>i.remove())});if(reduce.matches){cancelAnimationFrame(raf);raf=0}else if(!raf&&!document.hidden)raf=requestAnimationFrame(frame)};
 reduce.addEventListener('change',change);
 window.HavenAmbient={interact,get state(){const s=visibleScene();return {member:s.word.dataset.power||null,source:s.word.dataset.interaction||null,scene:s.surface.id||'home'}}};
 raf=requestAnimationFrame(frame);
 return ()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);reduce.removeEventListener('change',change);};
});

// 사진 자체를 이동하지 않고 표정에 맞는 작은 반응만 겹친다.
registerPageMount(()=>{
 const observers=[];
 const ns='http://www.w3.org/2000/svg';
 const art={
  loen:`<defs><radialGradient id="loen-cheek"><stop stop-color="#f26c91" stop-opacity=".65"/><stop offset=".55" stop-color="#ef7095" stop-opacity=".3"/><stop offset="1" stop-color="#f68ca8" stop-opacity="0"/></radialGradient></defs><g class="reaction-blush"><ellipse cx="305" cy="655" rx="82" ry="39" fill="url(#loen-cheek)"/><ellipse cx="665" cy="628" rx="75" ry="37" fill="url(#loen-cheek)"/><path d="M 252 642 l -9 19 M 275 642 l -9 19 M 650 616 l -8 18 M 674 615 l -8 18" fill="none" stroke="#f6a1b2" stroke-width="4" stroke-linecap="round" opacity=".48"/></g><path class="reaction-mark reaction-warm" d="M 775 410 C 755 390 731 417 775 449 C 819 417 795 390 775 410" fill="#efbdba"/>`,
  riela:`<g fill="#f3a0ba" stroke="#ffe7ed" stroke-width="2"><path class="reaction-mark reaction-heart heart-one" d="M 755 405 C 728 378 702 413 755 453 C 808 413 782 378 755 405"/><path class="reaction-mark reaction-heart heart-two" d="M 810 353 C 790 333 772 359 810 388 C 848 359 830 333 810 353"/><path class="reaction-mark reaction-heart heart-three" d="M 828 460 C 812 444 796 465 828 490 C 860 465 844 444 828 460"/></g>`,
  yuria:`<g class="reaction-water" fill="none" stroke="#b6f1f1" stroke-width="4"><circle class="reaction-mark bubble-one" cx="780" cy="564" r="19"/><circle class="reaction-mark bubble-two" cx="815" cy="493" r="10"/><ellipse class="reaction-mark water-ring" cx="775" cy="623" rx="38" ry="11"/></g><path class="reaction-mark reaction-clear" d="M 755 420 l 6 20 20 6 -20 6 -6 20 -6 -20 -20 -6 20 -6 Z" fill="#d9fffa"/>`,
  serian:`<g class="reaction-psychic" fill="none" stroke="#f2b7cb" stroke-width="4"><path class="reaction-mark psychic-one" d="M 135 416 l 15 24 -15 24 -15 -24 Z"/><path class="reaction-mark psychic-two" d="M 806 350 l 11 18 -11 18 -11 -18 Z"/><ellipse class="reaction-mark psychic-ring" cx="135" cy="478" rx="30" ry="9"/></g>`
 };
 document.querySelectorAll('.member-card').forEach(card=>{
  const id=card.dataset.member,svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 960 1200');svg.setAttribute('aria-hidden','true');svg.classList.add('portrait-reaction');svg.dataset.reaction=id;svg.innerHTML=art[id]||'';card.append(svg);
  const fit=()=>{const scale=Math.max(card.clientWidth/960,card.clientHeight/1200),w=960*scale,h=1200*scale;svg.style.width=w+'px';svg.style.height=h+'px';svg.style.left=(card.clientWidth-w)/2+'px';svg.style.top=(card.clientHeight-h)*.28+'px';};
  const observer=new ResizeObserver(fit);observer.observe(card);observers.push(observer);fit();
  const activate=()=>card.classList.add('expression-active');
  const deactivate=()=>card.classList.remove('expression-active');
  card.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')activate()});
  card.addEventListener('pointerleave',()=>{if(!card.matches(':focus-visible'))deactivate()});
  card.addEventListener('focus',()=>{if(card.matches(':focus-visible'))activate()});card.addEventListener('blur',deactivate);
  card.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')activate()});card.addEventListener('pointercancel',deactivate);
 });
 const close=()=>document.querySelectorAll('.member-card').forEach(card=>card.classList.remove('expression-active','is-photo-preview'));
 document.querySelector('#profile-dialog').addEventListener('close',close);
 return ()=>{observers.forEach(o=>o.disconnect());document.querySelector('#profile-dialog').removeEventListener('close',close);};
});

;(()=>{
 const data=window.HAVEN_CHANNELS,dialog=document.querySelector('#channel-dialog'),viewer=dialog.querySelector('.channel-viewer');let current=0,gesture=null,lastKey=0;
 function render(index,animate=true){
  current=(index+data.length)%data.length;const channel=data[current];dialog.dataset.channel=channel.id;dialog.style.setProperty('--member',channel.color);
  dialog.querySelector('#channel-title').textContent=channel.name;dialog.querySelector('.channel-dialog-description').textContent=channel.description;
  dialog.querySelector('.channel-dialog-symbol').textContent=channel.symbol;dialog.querySelector('.channel-counter').textContent=(current+1)+' / '+data.length;
  const link=dialog.querySelector('.channel-visit');link.href=channel.url;link.dataset.platform=channel.name;link.setAttribute('aria-label',channel.name+' 공식 채널 새 창에서 열기');
  if(animate&&!motionQuery.matches)viewer.animate([{opacity:.5,transform:'translateX(10px)'},{opacity:1,transform:'translateX(0)'}],{duration:240,easing:'ease-out'});
 }
registerPageMount(()=>{
 document.querySelectorAll('.channel-card').forEach(card=>{
  const c=data.find(c=>c.id===card.dataset.channel),fx=document.createElement('span');fx.className='resonance-fx card-hover-fx card-flow-fx';fx.setAttribute('aria-hidden','true');card.append(fx);addAbilityEdge(fx,{id:'channel',color:c.color});
  card.addEventListener('click',()=>{closePet();render(Number(card.dataset.channel),false);dialog.showModal();eventLog('haven_channel_preview',{platform:c.name})});
 });
});

 dialog.querySelector('.channel-prev').addEventListener('click',()=>render(current-1));dialog.querySelector('.channel-next').addEventListener('click',()=>render(current+1));
 dialog.querySelector('.channel-visit').addEventListener('click',()=>eventLog('haven_channel_click',{platform:data[current].name}));
 viewer.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('a,button'))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,drag:false};viewer.setPointerCapture(e.pointerId)});
 viewer.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.2){gesture.drag=true;if(e.cancelable)e.preventDefault()}});
 viewer.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(gesture.drag&&Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.2)render(current+(dx<0?1:-1));gesture=null;if(viewer.hasPointerCapture(e.pointerId))viewer.releasePointerCapture(e.pointerId)});
 viewer.addEventListener('pointercancel',()=>{gesture=null});
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const code=e.code,now=performance.now();if(now-lastKey<180)return;
  if(dialog.open){
   const direction=['KeyA','KeyW','ArrowLeft','ArrowUp'].includes(code)?-1:['KeyD','KeyS','ArrowRight','ArrowDown'].includes(code)?1:0;
   if(direction){e.preventDefault();lastKey=now;render(current+direction)}return;
  }
  if(document.querySelector('dialog[open]')||!['KeyW','KeyS'].includes(code))return;
  e.preventDefault();lastKey=now;
  const targets=[{id:'home',y:0},...['members','next','channels','page-end'].filter(id=>document.getElementById(id)).map(id=>({id,y:Math.min(document.documentElement.scrollHeight-innerHeight,scrollY+document.getElementById(id).getBoundingClientRect().top)}))];
  const direction=code==='KeyS'?1:-1,candidate=direction>0?targets.find(t=>t.y>scrollY+20):[...targets].reverse().find(t=>t.y<scrollY-20);
  if(candidate){const a=document.querySelector(`a[href="#${candidate.id}"]`);if(a)a.click();}
 });
})();

// 글자 위치는 고정하고 마스킹한 빛만 아래·위·대각선·끝점 순서로 반복한다.
registerPageMount(()=>{
 const entries=[...document.querySelectorAll('.wordmark-light,.type-seven-ink')];
 for(const ink of entries){
  ink.classList.add('banner-light-sequence');
  const backdrop=ink.classList.contains('type-seven-ink'),host=ink.parentElement;
  ink.setAttribute('aria-hidden','true');
  for(const direction of ['down','up','diagonal']){const pass=document.createElement('i');pass.className='banner-light-pass pass-'+direction;pass.dataset.pass=direction;ink.append(pass)}
  const terminals=document.createElement('span');terminals.className='banner-terminals';terminals.setAttribute('aria-hidden','true');
  const points=backdrop?[[92.5,14],[87,83]]:[[92.1,13],[86.6,84.8]];
  points.forEach(([x,y],i)=>{const glint=document.createElement('i');glint.className='banner-end-glint';glint.style.left=x+'%';glint.style.top=y+'%';glint.style.setProperty('--tip-delay',i?'.32s':'0s');terminals.append(glint)});
  host.append(terminals);
 }
});

// 화면 밖의 장식은 멈추고, 사용자 조작과 리틀 HAVEN의 동작은 별도로 유지한다.
registerPageMount(()=>{
 const surfaces=[...document.querySelectorAll('.hero,.chapter-layer>.section')];let pending=false,disposed=false,request=0;
 function update(){if(disposed)return;pending=false;const marker=innerHeight*.55,current=[...surfaces].reverse().find(el=>{const r=el.getBoundingClientRect();return r.top<marker&&r.bottom>marker})||surfaces[0];surfaces.forEach(el=>el.classList.toggle('fx-idle',el!==current));document.dispatchEvent(new CustomEvent('haven:surface',{detail:{home:current===surfaces[0]}}));}
 function schedule(){if(!pending){pending=true;request=requestAnimationFrame(update)}}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);const visibility=()=>{document.documentElement.classList.toggle('page-hidden',document.hidden);if(!document.hidden)schedule()};document.addEventListener('visibilitychange',visibility);
 const observer=new IntersectionObserver(schedule,{threshold:[0,.5,1]});observer.observe(document.querySelector('.chapter-layer'));update();
 return ()=>{disposed=true;cancelAnimationFrame(request);observer.disconnect();removeEventListener('scroll',schedule);removeEventListener('resize',schedule);document.removeEventListener('visibilitychange',visibility);};
});

// 기존 이동 상태에 집합 상태를 더한다. 별도 RAF나 강제 스크롤은 만들지 않는다.
let gatherDeadline=0;
const gatherButton=document.querySelector('#little-gather');
const gatherLines={loen:['다들 이쪽으로 와볼까?','좋아, 잠깐 같이 있자.','우리 여기서 만났네.'],yuria:['나도 왔지!','여기 자리 있다!','다 같이 있으니까 좋네!'],serian:['여기 있으면 되지.','다 모였네.','잠깐 쉬어갈까.'],riela:['저도 왔어요!','언니들, 같이 있어요!','별들도 데려왔어요!']};
let gatherRound=0;
function gatherSlots(){
 const {w,h,size}=bounds(),mobile=w<600,cols=mobile?2:4;
 const gap=mobile?20:12,width=cols*size+(cols-1)*gap;
 const left=Math.max(12,w-width-(mobile?64:80));
 const top=Math.max(105,h-(mobile?2*size+126:size+142));
 return pets.map((p,i)=>({x:left+(i%cols)*(size+gap),y:top+Math.floor(i/cols)*(size+38)}));
}
function releaseGatherPet(p){
 if(!p.gatherScene)return;
 p.gatherScene=null;p.el.classList.remove('gathering','gathered','gather-speaking');p.action=null;
 p.resumeFrom={x:p.x,y:p.y,at:elapsed+.3};p.returnHold=elapsed+.3;p.nextDash=elapsed+14+p.index*2;p.nextMeeting=elapsed+7;react(p,'walk');
}
function releaseGather(){
 pets.forEach(releaseGatherPet);gatherDeadline=0;nextScene=elapsed+12;
 gatherButton?.setAttribute('aria-pressed','false');
 if(gatherButton){const label=gatherButton.querySelector('.gather-label');label.textContent='리틀 HAVEN 집합';label.dataset.typeLight=label.textContent;}
 announce('리틀 HAVEN이 다시 산책합니다.');
}
function gatherPets(){
 if(pets.some(p=>p.gatherScene)){releaseGather();return;}
 closePet();stopChase();const slots=gatherSlots();gatherRound++;
 pets.forEach((p,i)=>{
  cancelVisit(p);p.dash=null;p.action=null;p.el.classList.remove('dashing','protesting','chase-answer','landing');
  if(!p.present){enterPet(p,true);p.x=innerWidth+100+i*45;p.y=slots[i].y;}
  p.hover=false;p.focus=false;p.el.style.pointerEvents='';p.el.style.opacity='1';
  p.gatherScene={from:{x:p.x,y:p.y},t:0,slot:i,arrived:false};p.el.classList.add('gathering');
 });
 gatherDeadline=performance.now()+12500;gatherButton.setAttribute('aria-pressed','true');
 const label=gatherButton.querySelector('.gather-label');label.textContent='다시 산책';label.dataset.typeLight=label.textContent;
 announce('로엔, 유리아, 세리안, 리엘라가 오른쪽 아래로 모입니다.');eventLog('haven_character_gather',{interaction_type:'gather',member_count:4});
}
function advanceGather(p,dt,now,modalOpen){
 const scene=p.gatherScene;if(!scene)return;
 if(now>gatherDeadline&&!modalOpen&&!p.drag){releaseGather();return;}
 if(p.drag){releaseGatherPet(p);return;}
 if(!modalOpen)scene.t+=dt;
 const target=gatherSlots()[scene.slot],duration=.95+p.index*.13;
 const progress=paused?1:Math.min(scene.t/duration,1),q=1-Math.pow(1-progress,3);
 if(!p.hover&&!p.focus&&selectedPet!==p){p.x=scene.from.x+(target.x-scene.from.x)*q;p.y=scene.from.y+(target.y-scene.from.y)*q;}
 p.el.style.transform=`translate(${Math.round(p.x)}px,${Math.round(p.y)}px)`;
 p.el.style.opacity='1';p.el.style.pointerEvents='';
 if(progress===1&&!scene.arrived){
  scene.arrived=true;p.el.classList.remove('gathering');p.el.classList.add('gathered');p.el.dataset.state='wave';
  const bank=gatherLines[p.member.id];setEmote(p,bank[(gatherRound-1)%bank.length]);
 }
 p.el.classList.toggle('gather-speaking',scene.arrived&&Math.floor(Math.max(0,scene.t-1.5)/2.1)%4===scene.slot);
 draw(p,paused?0:progress<1?[0,1,0,2][Math.floor(elapsed*9)%4]:[4,5][Math.floor(elapsed*3)%2]);
}
gatherButton?.addEventListener('click',gatherPets);
addEventListener('resize',()=>pets.forEach(p=>{if(p.gatherScene){p.gatherScene.from={x:p.x,y:p.y};p.gatherScene.t=0;}}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&pets.some(p=>p.gatherScene))gatherDeadline=performance.now()+8000;});

// 사용자가 참조한 「HAVEN 멤버 소개 문구 구상」의 로엔 소개 원문.
window.HAVEN_PROFILE_TOPICS={"loen":[{"id":"first","category":"성격과 행동","title":"처음 만나도, 이야기는 천천히.","paragraphs":["로엔과의 대화는 거창한 이야기가 없어도 이어집니다. 오늘 있었던 작은 일이나 문득 떠오른 생각을 꺼내면, 로엔은 그 안에서 함께 웃을 부분을 찾고 자기 이야기도 조금씩 보탭니다. 처음이라 말을 고르는 시간이 생겨도 느긋하게 기다려 줍니다. 하고 싶었던 말을 천천히 꺼내다 보면 어느새 처음의 어색함을 잊게 되는 사람입니다."]},{"id":"talk","category":"성격과 행동","title":"당신의 이야기에, 로엔의 생각을 조금.","paragraphs":["다른 사람의 이야기를 듣고 있을 때도 로엔만의 반응은 분명합니다. 공감되는 말에는 고개를 끄덕이고, 궁금한 부분은 한 번 더 물어봅니다. 자기 생각이 다르면 솔직하게 말하고, 이야기를 듣다 마음이 바뀌면 그것도 자연스럽게 인정합니다. 좋아하는 것에 관해서는 조금 더 길게 이야기하고 싶어 하고, 함께 해보고 싶은 일이 생기면 먼저 제안하기도 합니다. 부드러운 말투 속에 자기 생각과 취향이 또렷하게 들어 있습니다."]},{"id":"play","category":"성격과 행동","title":"그 한마디에, 같이 웃게 될 거예요.","paragraphs":["편해질수록 장난기도 드러납니다. 다른 멤버가 열심히 설명하는 것을 듣다가 짧게 한마디를 보태는데, 그 말에 주변이 웃으면 로엔도 슬쩍 웃습니다. 자기가 한 농담이 생각보다 잘 통하면 조금 뿌듯한 표정을 짓기도 합니다. 그러다 다른 멤버가 장난을 되돌려주면 웃으며 받아주고, 자신이 먼저 민망해지는 순간에는 잠깐 시선을 피했다가 다시 대화에 끼어듭니다. 단정한 첫인상에 익숙해질 무렵 발견하게 되는, 함께 웃고 싶어지는 모습입니다."]},{"id":"together","category":"성격과 행동","title":"하고 싶은 이야기를, 함께 꺼내봐요.","paragraphs":["함께 무언가를 할 때는 먼저 방향을 잡아주는 편입니다. 하고 싶은 것이 있으면 이유를 설명하고, 다른 사람은 어떻게 생각하는지 묻습니다. 자신이 맡은 일에는 책임감을 갖고 움직이면서도 다른 멤버의 좋은 생각을 반갑게 받아들입니다. 누군가 앞에 나서고 싶어 할 때는 그 사람이 마음껏 해볼 수 있도록 곁에서 함께합니다. 로엔이 있는 자리에서는 각자의 생각을 꺼내고, 그중 무엇을 함께 해볼지 이야기할 수 있습니다."]},{"id":"care","category":"성격과 행동","title":"기억해 준 마음은, 오래 남아요.","paragraphs":["로엔도 챙김을 받으면 기뻐합니다. 누군가 자신을 위해 준비한 것을 건네거나, 무심코 했던 말을 기억해 주면 표정이 한결 부드러워집니다. 고맙다는 말을 건네고도 그것을 한 번 더 들여다보거나, 나중에 다시 그 이야기를 꺼냅니다. 평소에는 여유롭게 말을 이어가다가도 진심 어린 칭찬 앞에서는 잠시 다음 말을 고릅니다. 그런 순간에 로엔의 마음이 가까이 보입니다."]},{"id":"impression","category":"첫인상과 분위기","title":"단정한 첫인상, 그 안의 다채로운 표정.","paragraphs":["처음 눈에 들어오는 로엔은 우아하고 차분합니다. 서두르지 않는 움직임과 상대를 바라보는 시선에 여유가 있고, 말을 건네면 부드러운 미소로 맞아줍니다. 처음 찾아온 사람도 자신의 속도로 인사하고 이야기를 시작할 수 있는 분위기입니다.","잠깐 이야기를 나누면 그 단정함 안에서 표정이 꽤 다채롭게 바뀐다는 것을 알게 됩니다. 재미있는 말을 들었을 때 먼저 풀리는 눈빛, 자기 취향을 이야기할 때 조금 더 생기 있어지는 얼굴, 뜻밖의 칭찬에 웃음을 고르는 순간까지. 로엔을 알아가는 즐거움은 이런 작은 반응들을 하나씩 발견하는 데 있습니다. 한 번 대화를 나누고 나면 다음에는 어떤 이야기를 꺼내볼까 생각하게 됩니다."]},{"id":"stage","category":"첫인상과 분위기","title":"무대 위에서도, 다시 마주한 미소에도.","paragraphs":["무대에서는 그 여유에 선명한 집중이 더해집니다. 관객을 바라보고 자기 순간을 이끌 때는 확신이 느껴지고, 멤버들과 함께할 때는 서로의 표현을 받아주며 무대를 이어갑니다. 공연이 끝나고 다시 편안하게 웃으며 말을 건네면, 조금 전까지 무대를 채우던 사람이 한층 가깝게 느껴집니다. 무대에서 본 모습도, 이야기를 나누며 알게 된 모습도 모두 로엔에게 자연스럽게 이어져 있습니다."]},{"id":"hello","category":"직접 자기소개","title":"“안녕하세요, 로엔이에요.”","paragraphs":["안녕하세요, 로엔이에요. 처음 찾아와 주셔서 반가워요.","처음 인사할 때는 무슨 말을 하면 좋을지 잠깐 고민하게 되죠. 저는 오늘 있었던 작은 이야기부터 듣는 것도 좋아해요. 우연히 본 게 재미있었다거나, 별생각 없이 고른 게 마음에 들었다거나. 그렇게 이야기를 듣다 보면 저도 떠오르는 게 있어서, 어느새 제 이야기를 하고 있더라고요. 천천히 서로 알아가면 좋겠어요.","저는 좋아하는 것이 생기면 함께 나누고 싶어지는 편이에요. 제가 어떤 부분을 좋아하는지 이야기하고, 다른 사람은 무엇을 눈여겨봤는지 듣는 시간이 즐겁거든요. 같은 것을 보고도 서로 다른 이야기를 할 때가 있잖아요. 그러면 다음에 다시 볼 때는 그 사람이 해준 말도 생각나요.","그리고 조금 편해지면 장난도 쳐요. 가끔 한마디 했는데 다들 웃으면 꽤 기분이 좋고요. 저한테도 편하게 장난 걸어주셔도 돼요. 잘 받아칠 생각은 하고 있는데…… 제가 먼저 웃어버릴 수도 있겠네요.","함께할 때는 제가 할 수 있는 일을 잘하고 싶어요. 앞에 서야 할 순간에는 먼저 나서고, 누군가 보여주고 싶은 것이 있을 때는 곁에서 함께하고 싶고요. 저도 하고 싶은 게 많아서, 앞으로 하나씩 보여드릴 생각이에요.","오늘은 이렇게 인사했으니까, 다음에 만나면 조금 더 편하게 이야기할 수 있겠죠. 그때는 저도 새로운 이야기를 가져올게요. 함께 웃을 일이 많아졌으면 좋겠어요."]}]};

// 페이지가 없어도 링크는 일반 HTML 탐색으로 동작한다.
registerPageMount(()=>{
 const legacy={members:'members.html',next:'content.html',channels:'channels.html',world:'world.html'};
 if(document.body.dataset.page==='home'&&legacy[location.hash.slice(1)])queueMicrotask(()=>window.HavenNavigate(legacy[location.hash.slice(1)]+location.hash,{historyMode:'replace'}));
 document.querySelectorAll('.gather-label,.world-tab strong,.world-tab small,.profile-topic').forEach(addTypeLight);
 const dialog=document.querySelector('#profile-dialog'),reader=dialog.querySelector('.profile-reader');
 const topics=window.HAVEN_PROFILE_TOPICS||{};let active=[];
 function showTopic(index){
  const article=reader.querySelector('.profile-article');article.replaceChildren();
  const selected=index<0?active:[active[index]];
  let lastCategory='';
  for(const topic of selected){
   if(topic.category!==lastCategory){const title=document.createElement('h3');title.textContent=topic.category;article.append(title);lastCategory=topic.category;}
   for(const line of topic.paragraphs){const p=document.createElement('p');p.textContent=line;article.append(p);}
  }
  reader.querySelectorAll('.profile-topic').forEach((b,i)=>b.setAttribute('aria-pressed',String(index===i-1)));
  article.scrollTop=0;
 }
 document.querySelectorAll('.member-card').forEach(card=>card.addEventListener('click',()=>{
  active=topics[card.dataset.member]||[];reader.hidden=!active.length;
  const tabs=reader.querySelector('.profile-topics');tabs.replaceChildren();
  if(!active.length)return;
  const labels={first:'첫 만남',talk:'대화',play:'장난기',together:'함께할 때',care:'마음을 받으면',impression:'첫인상',stage:'무대',hello:'로엔의 인사'};
  ['전체 읽기',...active.map(t=>labels[t.id]||t.title)].forEach((label,i)=>{const b=document.createElement('button');b.type='button';b.className='profile-topic';const text=document.createElement('span');text.textContent=label;b.append(text);b.title=i?active[i-1].title:'소개 전체 읽기';b.setAttribute('aria-controls','profile-article');b.addEventListener('click',()=>showTopic(i-1));tabs.append(b);addTypeLight(text);});
  showTopic(0);
 }));
 const worldTabs=[...document.querySelectorAll('.world-tab')],worldPanel=document.querySelector('.world-panel');
 function chooseWorld(index){
  const m=members[index];if(!worldPanel)return;
  worldPanel.dataset.ability=m.id;worldPanel.style.setProperty('--world-color',m.color);
  worldPanel.querySelector('h2').textContent=m.ko;
  worldPanel.querySelector('.world-power').textContent=m.power;
  worldPanel.querySelector('.world-detail').textContent=window.HAVEN_WORLD_DETAILS[m.id];
  worldPanel.setAttribute('aria-labelledby','world-tab-'+index);
  worldTabs.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});
  const link=worldPanel.querySelector('.world-member-link');link.href='members.html?member='+m.id;link.setAttribute('aria-label',m.ko+' 소개 보기');
  if(!motionQuery.matches)worldPanel.querySelector('.world-copy').animate([{opacity:.4},{opacity:1}],{duration:260});
 }
 worldTabs.forEach((b,i)=>{b.addEventListener('click',()=>chooseWorld(i));b.addEventListener('keydown',e=>{let next;if(['ArrowRight','ArrowDown'].includes(e.key))next=(i+1)%4;else if(['ArrowLeft','ArrowUp'].includes(e.key))next=(i+3)%4;else if(e.key==='Home')next=0;else if(e.key==='End')next=3;if(next!==undefined){e.preventDefault();chooseWorld(next);worldTabs[next].focus();}});});
 if(worldPanel)chooseWorld(0);
 const requested=new URLSearchParams(location.search).get('member');
 if(requested){const card=document.querySelector(`.member-card[data-member="${CSS.escape(requested)}"]`);if(card)card.click();}
});
