const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
APP='#signup',
GH=p=>'GH₵'+(p/100).toLocaleString('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2}),
CATS=['Business & Product Promotion','Social Media Growth','Music & Entertainment','Content Creation & UGC','Design & Branding','Video & Photo Services','Digital & Tech Services','Events & Experiences','Writing & Marketing','Fashion & Lifestyle','Education & Learning','Other Tasks & Opportunities'],
DOT=['#1463E0','#0E9FBC','#0B4FB8','#5BA3F5','#4A6180'],
TASKS=[
{t:'Unboxing video for a Kumasi shea butter brand',cat:3,r:40,days:3,spots:3,req:'Phone video, 30 seconds, honest first impressions.'},
{t:'Usability test of a school fees portal',cat:6,r:60,days:5,spots:2,req:'Laptop or phone. Complete five tasks and report what confused you.'},
{t:'Cover art for an Afrobeats single',cat:2,r:120,days:7,spots:1,req:'Original artwork, 3000×3000 px, two revision rounds.'},
{t:'Thumbnail set for a cooking channel',cat:4,r:35,days:2,spots:4,req:'Three thumbnails, 1280×720, brand colours provided.'},
{t:'Event photos for a Takoradi pop-up market',cat:7,r:150,days:9,spots:2,req:'Own camera, 30 edited photos within 48 hours of the event.'},
{t:'Caption writing for a fashion label',cat:8,r:25,days:1,spots:6,req:'Ten captions in English, friendly tone, no fake claims.'},
{t:'Product demo reel for a phone accessories shop',cat:0,r:80,days:6,spots:2,req:'Vertical video, 20 to 40 seconds, shows the product in use.'},
{t:'Survey on how students pay for data',cat:11,r:15,days:4,spots:20,req:'Ten minutes. Honest answers only.'}],
PERF=[['Efua Mensah','Video editor',48,'4.9','Top Performer'],['Kwame Asante','Photographer',41,'4.9','Reliable Partner'],['Abena Owusu','Graphic designer',33,'4.8','Creative Pro'],['Yaw Boateng','UGC creator',22,'4.7','Rising Creator']],
FAQ=[
['How do I get paid?','Once work is approved and cleared, it becomes withdrawable. Payouts run every Tuesday and Friday. Request by Monday noon for Tuesday, or Thursday noon for Friday. You need a verified mobile money or bank payout account, and the minimum withdrawal is GH₵20.'],
['What does HUSTLA cost?','Task doers pay GH₵20 a month and advertisers pay GH₵30 a month. There’s no free plan and no yearly package. On each task, HUSTLA charges the advertiser 10% on top of the worker’s reward, so the worker always receives the full agreed amount.'],
['What if the publisher never reviews my work?','They have 48 hours and get a reminder before it ends. If nobody acts and there’s no dispute or policy hold, the work is approved automatically and your earnings are released.'],
['How do corrections work?','There is one standard correction round. The publisher must ask within the 48-hour review window, name the specific problem and stay within the original brief. You then have 48 hours to resubmit, and they have 24 hours to approve or open a dispute.'],
['How do disputes work?','Either side can open one with a reason and evidence. The task funds are held straight away. HUSTLA reviews the brief, submissions and messages and aims to decide within 3 business days: release to the worker, refund the publisher, or split fairly.'],
['Which campaigns are not allowed?','Fake followers, likes, comments, views or streams, paid or incentivised reviews, scams, gambling, crypto, financial offers, health claims, alcohol, giveaways, job recruitment, political campaigns, and anything involving or targeting children. There are no exceptions, and renaming a campaign doesn’t change that.'],
['Can I publish campaigns and do tasks with one account?','Yes. One registration gives you two modes: Campaign Publisher and Task Worker. Each mode has its own monthly membership.'],
['How is my money protected?','Campaign budgets are reserved before any task is offered. Deposits are confirmed by the payment provider, never by a screenshot. Every deposit, fee, reservation, release, refund and withdrawal is recorded in your wallet ledger.']];
const tag=c=>`<span class="tag"><i style="background:${DOT[c%5]}"></i>${esc(CATS[c])}</span>`,
row=t=>`<div class="it"><div class="line"><div style="flex:1;min-width:220px">${tag(t.cat)}<div class="t">${esc(t.t)}</div><div class="mut">${esc(t.req)}</div><div class="mut">${t.days} day${t.days>1?'s':''} left, ${t.spots} spot${t.spots>1?'s':''}</div></div><div class="acts"><span class="rw">${GH(t.r*100)}</span><a class="b p" href="#dashboard">Apply</a></div></div></div>`,
board=n=>`<div class="list">${PERF.slice(0,n).map((p,i)=>`<div class="it"><div class="line"><div><span class="t">${i+1}. ${esc(p[0])}</span> <span class="chip">${esc(p[4])}</span><div class="mut">${esc(p[1])}, ${p[2]} approved jobs, rated ${p[3]}</div></div></div></div>`).join('')}</div>`,
cta=(t,h,k)=>`<a class="b ${k||''}" href="${h}"${h.startsWith('http')?' target="_blank" rel="noopener"':''}>${t}</a>`,
hero=(e,h,l,b)=>`<section class="hero"><div class="wrap"><p class="eye">${e}</p><h1>${h}</h1><p class="lead">${l}</p><div class="acts">${b}</div></div></section>`,
steps=a=>`<ol class="n">${a.map(([h,d])=>`<li><div><b>${h}</b><span class="mut">${d}</span></div></li>`).join('')}</ol>`,
integ=`<div class="strip"><b>No fake engagement. Ever.</b> HUSTLA doesn’t sell followers, likes, comments, views, artificial streams or paid reviews. Every campaign is reviewed by a person before anyone can see it.</div>`;

const R={
dashboard:()=>dashView(),login:()=>authView(),signup:()=>authView(),
home:()=>hero('Discover. Hustle. Earn.','Promote what you make. Earn from what you can do.','HUSTLA connects businesses and creators with people who deliver real promotional, creative and digital work, paid for in cedis.',cta('Promote something',APP,'p lg')+cta('Earn from tasks','#explore','lg'))+
`<div class="wrap"><section class="sec"><h2>Two ways in, one account</h2><p class="sub">Switch between modes whenever you like. A musician can promote a new single and earn by editing someone else’s video the same week.</p>
<div class="two"><div class="panel"><h3>Publish a campaign</h3><p class="mut">For businesses and creators.</p><ul><li>Say what you need, how many, and what you’ll pay</li><li>We review it within 24 hours</li><li>Your budget is held safely until the work is approved</li></ul>${cta('For businesses','#businesses','p')}</div>
<div class="panel d"><h3>Earn from tasks</h3><p class="mut">For creators and freelancers.</p><ul><li>Browse approved campaigns by category and reward</li><li>Deliver the work, get a specific reason if it needs fixing</li><li>Withdraw to mobile money or bank every Tuesday and Friday</li></ul>${cta('Explore tasks','#explore','p')}</div></div></section>
<section class="sec"><h2>Open right now</h2><p class="sub">A few of the approved tasks. All rewards are what the worker receives.</p><div class="list">${TASKS.slice(0,3).map(row).join('')}</div>${cta('See all tasks','#explore')}</section>
<section class="sec"><h2>Community Top Performers</h2><p class="sub">Ranked on approved work, on-time delivery and quality ratings, never on follower counts. Members choose whether to appear.</p>${board(3)}${cta('How creators earn','#creators')}</section>
<section class="sec">${integ}</section></div>`,

explore:()=>hero('Explore tasks','Find work that fits.','Every campaign here has been reviewed and funded before it appears.','')+
`<div class="wrap"><section class="sec"><div id="xf" class="fl"><div><label for="xs">Search</label><input id="xs" type="search" placeholder="Video, logo, survey"></div><div><label for="xc">Category</label><select id="xc"><option value="">All categories</option>${CATS.map((c,i)=>`<option value="${i}">${esc(c)}</option>`).join('')}</select></div><div><label for="xo">Sort by</label><select id="xo"><option value="r">Highest reward</option><option value="d">Soonest deadline</option></select></div></div>
<p class="mut" id="xn" aria-live="polite"></p><div class="list" id="xl"></div></section></div>`,

businesses:()=>hero('For businesses','Hire real people to promote and create.','UGC videos, demos, graphics, testing and research, delivered by people you choose and paid only when you approve.',cta('Publish a campaign',APP,'p lg')+cta('See pricing','#pricing','lg'))+
`<div class="wrap"><section class="sec"><h2>What you can publish</h2><p class="sub">Twelve approved categories, including product promotion, UGC and unboxing, design and branding, video and photo, usability testing, copywriting, events and fashion.</p>
<div class="two"><div class="panel"><h3>You stay in control</h3><ul><li>You pick which applicants to accept</li><li>You approve the work, or ask for one correction with a clear reason</li><li>Scope and reward are locked once someone is accepted</li></ul></div><div class="panel"><h3>Your money is held, not spent</h3><ul><li>Budget is reserved before tasks go live</li><li>Released only on approval or a dispute decision</li><li>Unused balance stays in your wallet</li></ul></div></div></section>
<section class="sec"><h2>From brief to approved work</h2>${steps([['Write the brief','Deliverable, quantity, reward, deadline and acceptance criteria.'],['We review it','Within 24 hours. Prohibited campaign types are rejected with no exceptions.'],['Funds are reserved','Reward plus the 10% fee, set aside for each task.'],['Choose your workers','Accept or decline each application within 24 hours.'],['Approve or correct','You have 48 hours to review each submission.']])}${integ}</section></div>`,

creators:()=>hero('For creators','Promote your work. Earn from other people’s.','Musicians, influencers, streamers and YouTubers can run campaigns for their own content and complete tasks for others, all from one account.',cta('Start earning',APP,'p lg')+cta('Explore tasks','#explore','lg'))+
`<div class="wrap"><section class="sec"><h2>Two modes</h2><div class="two"><div class="panel"><h3>Promote your own content</h3><p class="mut">Real outreach and original promo content for your profile, channel, release or show. Nothing bought, nothing faked.</p></div><div class="panel"><h3>Earn on other campaigns</h3><p class="mut">Edit, design, shoot, write or test for businesses and fellow creators, and build a track record people can see.</p></div></div></section>
<section class="sec"><h2>Community Top Performers</h2><p class="sub">Earn badges like Rising Creator, Top Performer, Reliable Partner and Creative Pro. Publishers can invite proven members to their campaigns. You control what shows on your public profile.</p>${board(4)}</section></div>`,

'how-it-works':()=>hero('How it works','Two journeys, one marketplace.','Clear deadlines on both sides, so nobody is left waiting.','')+
`<div class="wrap"><section class="sec"><h2>If you publish</h2>${steps([['Publish','Choose a category, describe the deliverable, set quantity, reward and deadline.'],['Review and fund','HUSTLA checks it within 24 hours and reserves your budget.'],['Accept workers','Applications expire after 24 hours if you don’t decide.'],['Review the work','48 hours to approve, request one correction or dispute.'],['Earnings are released','Approved work is paid to the worker.']])}</section>
<section class="sec"><h2>If you earn</h2>${steps([['Browse and apply','Filter by category, reward and deadline.'],['Get accepted','The scope, reward and deadline are locked in.'],['Deliver','Upload a link, text, images, video or files.'],['Fix once if needed','You get 48 hours to correct, with the reason in writing.'],['Withdraw','Cleared earnings are paid on Tuesdays and Fridays.']])}</section></div>`,

pricing:()=>hero('Pricing & fees','Simple, in cedis.','One monthly membership, one transparent fee, nothing hidden in the reward.','')+
`<div class="wrap"><section class="sec"><div class="two"><div class="panel"><p class="mut">Task doers</p><div class="price">GH₵20<small> / month</small></div><p class="mut">Access and apply for tasks.</p></div><div class="panel"><p class="mut">Advertisers</p><div class="price">GH₵30<small> / month</small></div><p class="mut">Create and manage campaigns.</p></div></div><p class="sub" style="margin-top:12px">Monthly billing only. No free plan, no tiers, no yearly package.</p></section>
<section class="sec"><h2>The 10% fee, worked out</h2><p class="sub">HUSTLA charges the advertiser 10% on top of the reward. It is never taken out of what the worker earns.</p>
<div class="panel" id="calc"><div class="fl" style="grid-template-columns:1fr 1fr"><div><label for="cq">Tasks</label><input id="cq" type="number" min="1" value="5"></div><div><label for="cr">Reward per task (GH₵)</label><input id="cr" type="number" min="1" step="0.5" value="100"></div></div><div class="res" id="cres" aria-live="polite"></div></div></section>
<section class="sec"><h2>Deposits and withdrawals</h2><div class="list"><div class="it line"><span>Minimum campaign deposit</span><b>GH₵50</b></div><div class="it line"><span>Minimum withdrawal</span><b>GH₵20</b></div><div class="it line"><span>Payout days</span><b>Tuesday and Friday</b></div></div><p class="mut">Any payment-provider charge is shown before you confirm, and never reduces a worker’s agreed reward.</p></section></div>`,

help:()=>hero('Help Centre','Answers, fast.','Payouts, corrections, disputes and account questions.','')+
`<div class="wrap"><section class="sec"><div class="list">${FAQ.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
<div class="strip"><b>Still stuck?</b> Open a support request from your dashboard, or use the report button on any campaign page.</div></section></div>`
};

const LOGOL='/assets/hustla-logo.png',MARK='/assets/hustla-mark.png',AU={mode:'in',via:'phone',step:1,phone:'',tries:0,cd:0,name:'',iv:null};
function normPhone(s){let d=String(s).replace(/\D/g,'');if(d.startsWith('0')&&d.length===10)d='233'+d.slice(1);else if(d.length===9)d='233'+d;return /^233(2[03-9]|5[03-79])\d{7}$/.test(d)?d:null}
const fmtPhone=d=>'+233 '+d.slice(3,5)+' '+d.slice(5,8)+' '+d.slice(8),
pwScore=p=>(p.length>=8)+(/[a-z]/.test(p)&&/[A-Z]/.test(p))+/\d/.test(p)+(/[^A-Za-z0-9]/.test(p)||p.length>=12),
meter=p=>{const s=pwScore(p);return [0,1,2,3].map(i=>`<i class="${i<s?'on':''}"></i>`).join('')};
function authView(){return `<div class="auth"><aside class="ap"><img class="lg2" src="${LOGOL}" alt="HUSTLA"><div><h2>One account. Two ways to earn.</h2><ul><li>Every campaign is reviewed before it goes live</li><li>Budgets are held until the work is approved</li><li>Payouts every Tuesday and Friday</li></ul></div><small>Discover. Hustle. Earn.</small><img class="wm" src="${MARK}" alt=""></aside><div class="af"><div class="ac" id="abody"></div></div></div>`}
function authBody(){const up=AU.mode==='up',ph=AU.via==='phone';
 if(AU.step===3)return `<div class="ok2"><img class="mk2" src="${MARK}" alt=""><h1>Welcome${AU.name?', '+esc(AU.name.split(' ')[0]):''}.</h1><p class="sub">You’re signed in. One account gives you both modes, so where to first?</p><div class="acts" style="justify-content:center"><a class="b p lg" href="#${NEXT||'dashboard'}">${NEXT==='explore'?'Continue to tasks':'Open my dashboard'}</a><a class="b lg" href="#${NEXT==='explore'?'dashboard':'explore'}">${NEXT==='explore'?'Open my dashboard':'Browse tasks'}</a></div><p class="dm">Demo only: no account was created and nothing was saved.</p></div>`;
 const head=`<img class="mk2" src="${MARK}" alt=""><h1>${up?'Create your account':'Welcome back'}</h1><p class="sub">${up?'One registration, two modes: publish campaigns and earn from tasks.':'Sign in to publish campaigns or pick up tasks.'}</p>`;
 if(AU.step===2)return `${head}<form id="af" novalidate><p>We sent a 6-digit code to <b>${fmtPhone(AU.phone)}</b>.</p><label for="o0">Verification code</label><div class="otp">${[0,1,2,3,4,5].map(i=>`<input id="o${i}" inputmode="numeric" maxlength="1" aria-label="Digit ${i+1}"${i?'':' autocomplete="one-time-code"'}>`).join('')}</div><div class="er" id="aerr" role="alert"></div><button class="b p lg w">Verify and continue</button><p class="mut" style="margin-top:12px"><button type="button" class="lk" data-au="back">Change number</button> &nbsp;·&nbsp; <button type="button" class="lk" id="rs" data-au="resend"${AU.cd?' disabled':''}>${AU.cd?'Resend in '+AU.cd+'s':'Resend code'}</button></p><p class="dm">Demo code: 123456</p></form>`;
 return `${head}<div class="tb" role="group" aria-label="Sign in method"><button data-au="phone" aria-pressed="${ph}">Mobile money number</button><button data-au="email" aria-pressed="${!ph}">Email</button></div><form id="af" novalidate>
 ${up?`<label for="an">Full name</label><input id="an" autocomplete="name" value="${esc(AU.name)}">`:''}
 ${ph?`<label for="ap">Mobile number</label><div class="ph"><span>+233</span><input id="ap" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="24 123 4567"></div>`:`<label for="ae">Email</label><input id="ae" type="email" autocomplete="email" placeholder="you@example.com"><label for="apw">Password</label><div class="pw"><input id="apw" type="password" autocomplete="${up?'new-password':'current-password'}"><button type="button" data-au="show" aria-pressed="false">Show</button></div>${up?`<div class="mt" id="mt" aria-hidden="true">${meter('')}</div><p class="mut" style="margin:6px 0 0">At least 8 characters. Mix letters, numbers and symbols.</p>`:`<p style="margin:8px 0 0"><button type="button" class="lk" data-au="forgot">Forgot your password?</button></p>`}`}
 ${up?`<label class="ck"><input type="checkbox" id="at"><span>I agree to the <a href="#help">terms</a> and <a href="#help">privacy policy</a>, and I won’t post fake engagement or paid reviews.</span></label>`:''}
 <div class="er" id="aerr" role="alert"></div><button class="b p lg w">${ph?'Send me a code':(up?'Create account':'Sign in')}</button></form>
 <p class="mut" style="margin-top:16px;text-align:center">${up?'Already have an account? <button class="lk" data-au="in">Sign in</button>':'New to HUSTLA? <button class="lk" data-au="up">Create an account</button>'}</p>`}
function aDraw(f){$('#abody').innerHTML=authBody();const x=document.querySelector('#abody input:not([type=checkbox])');if(f&&x)x.focus()}
function aErr(m,id){$('#aerr').textContent=m;const x=id&&$('#'+id);if(x)x.focus()}
function aCd(){clearInterval(AU.iv);AU.cd=30;AU.iv=setInterval(()=>{AU.cd--;const b=$('#rs');if(b){b.textContent=AU.cd?'Resend in '+AU.cd+'s':'Resend code';b.disabled=!!AU.cd}if(AU.cd<=0)clearInterval(AU.iv)},1000)}
function aSubmit(){const v=id=>(($('#'+id)||{}).value||'').trim();
 if(AU.step===2){const c=[0,1,2,3,4,5].map(i=>$('#o'+i).value).join('');if(c.length<6)return aErr('Enter all 6 digits.','o0');
  if(c==='123456'){AU.step=3;clearInterval(AU.iv);signIn(AU.name);return aDraw()}
  AU.tries++;if(AU.tries>=5){AU.step=1;AU.tries=0;aDraw(1);return aErr('Too many wrong codes. Request a new one.')}
  [0,1,2,3,4,5].forEach(i=>$('#o'+i).value='');return aErr('That code doesn’t match. '+(5-AU.tries)+' tries left.','o0')}
 const up=AU.mode==='up';if(up){AU.name=v('an');if(AU.name.length<2)return aErr('Enter your full name.','an');if(!$('#at').checked)return aErr('Please accept the terms to continue.','at')}
 if(AU.via==='phone'){const p=normPhone(v('ap'));if(!p)return aErr('Enter a valid Ghana mobile number, like 024 123 4567.','ap');AU.phone=p;AU.step=2;AU.tries=0;aCd();return aDraw(1)}
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('ae')))return aErr('Enter a valid email address.','ae');
 const pw=$('#apw').value;if(up&&pw.length<8)return aErr('Use at least 8 characters.','apw');if(!up&&!pw)return aErr('Enter your password.','apw');
 AU.step=3;signIn(AU.name);aDraw()}
function authInit(k){AU.mode=k==='signup'?'up':'in';AU.step=1;AU.via='phone';AU.name='';clearInterval(AU.iv);aDraw()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-au]');if(!b||!$('#abody'))return;const a=b.dataset.au;
 if(a==='phone'||a==='email'){AU.via=a;aDraw(1)}
 else if(a==='in'||a==='up'){location.hash=a==='up'?'#signup':'#login'}
 else if(a==='back'){AU.step=1;clearInterval(AU.iv);aDraw(1)}
 else if(a==='resend'&&!AU.cd){aCd();aDraw();aErr('A new code is on its way.')}
 else if(a==='show'){const i=$('#apw'),s=i.type==='password';i.type=s?'text':'password';b.textContent=s?'Hide':'Show'}
 else if(a==='forgot'){aErr('Enter your email above and we’ll send a reset link (demo).','ae')}});
document.addEventListener('submit',e=>{if(e.target.id==='af'){e.preventDefault();aSubmit()}});
document.addEventListener('input',e=>{const t=e.target;if($('#aerr'))$('#aerr').textContent='';
 if(t.matches&&t.matches('.otp input')){t.value=t.value.replace(/\D/g,'').slice(-1);const n=+t.id.slice(1);if(t.value&&n<5)$('#o'+(n+1)).focus();if([0,1,2,3,4,5].every(i=>$('#o'+i).value))aSubmit()}
 if(t.id==='apw'&&$('#mt'))$('#mt').innerHTML=meter(t.value)});
document.addEventListener('keydown',e=>{const t=e.target;if(t.matches&&t.matches('.otp input')&&e.key==='Backspace'&&!t.value&&+t.id.slice(1)>0)$('#o'+(+t.id.slice(1)-1)).focus()});
document.addEventListener('paste',e=>{const t=e.target;if(t.matches&&t.matches('.otp input')){const d=(e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,6);if(d){e.preventDefault();[...d].forEach((c,i)=>$('#o'+i).value=c);$('#o'+Math.min(d.length,5)).focus();if(d.length===6)aSubmit()}}});
const DASH=(()=>{
const $=s=>document.querySelector(s),
esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
GH=p=>(p<0?'−':'')+'GH₵'+(Math.abs(p)/100).toLocaleString('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2}),
fee=r=>Math.round(r*.1),
CATS=['Business & Product Promotion','Social Media Growth','Music & Entertainment','Content Creation & UGC','Design & Branding','Video & Photo Services','Digital & Tech Services','Events & Experiences','Writing & Marketing','Fashion & Lifestyle','Education & Learning','Other Tasks & Opportunities'],
DOT=['#1463E0','#0E9FBC','#0B4FB8','#5BA3F5','#4A6180'],
BAD=['buy followers','fake','crypto','bitcoin','loan','giveaway','betting','casino','paid review','google review'];
let S,role='pub';
const init=()=>({avail:20000,res:26400,wd:0,fees:0,nid:10,ws:[],ts:[],
 led:[{l:'Deposit via MoMo',a:46400}],
 cs:[
  {id:1,t:'Unboxing video for a Kumasi shea butter brand',cat:CATS[3],q:3,r:4000,st:'LIVE',d:'Film a 30-second honest unboxing and post it on your own page.',f:[]},
  {id:2,t:'Usability test of a school fees portal',cat:CATS[6],q:2,r:6000,st:'LIVE',d:'Complete five tasks on the site and report what confused you.',f:[]},
  {id:3,t:'Buy followers for my music page',cat:CATS[1],q:5,r:1000,st:'PENDING_REVIEW',d:'I need 5,000 fake followers fast.',f:['buy followers','fake']}
 ]});
const cost=c=>c.q*(c.r+fee(c.r)),cp=i=>S.cs.find(c=>c.id==i),tk=i=>S.ts.find(t=>t.id==i),
L=(l,a)=>S.led.unshift({l,a}),
T=(m,e)=>{const t=$('#toast');t.textContent=m;t.className=e?'err show':'show';clearTimeout(T.h);T.h=setTimeout(()=>t.className='',3500)},
nextRun=()=>{const n=new Date(),s=Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate());for(let i=0;i<9;i++){const d=new Date(s+i*864e5),w=d.getUTCDay();if((w==2||w==5)&&d.getTime()-864e5+432e5>=n.getTime())return d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'})}},
chip=s=>{const m={LIVE:'ok',COMPLETED:'ok',PAID:'ok',PENDING_REVIEW:'w',APPLIED:'w',SUBMITTED:'w',CORRECTION:'w',DISPUTED:'w',REQUESTED:'w',REJECTED:'bad',CANCELLED:'bad',DECLINED:'bad'},t=s.replace('_',' ').toLowerCase();return `<span class="chip ${m[s]||''}">${t[0].toUpperCase()+t.slice(1)}</span>`},
btn=(a,i,t,k,o)=>`<button class="b ${k||''}" data-a="${a}" data-i="${i}"${o?` data-o="${o}"`:''}>${t}</button>`,
tag=c=>`<span class="tag"><i style="background:${DOT[CATS.indexOf(c)%5]}"></i>${esc(c)}</span>`,
steps=t=>{const n={APPLIED:1,ASSIGNED:2,CORRECTION:2,SUBMITTED:3,DISPUTED:3,COMPLETED:4}[t.st]||0;return `<div class="steps" aria-hidden="true">${[0,1,2,3].map(i=>`<i class="${i<n?'on':''}"></i>`).join('')}</div>`},
band=(e,t,st)=>`<section class="band"><div class="wrap"><p class="eye">${e}</p><h1>${t}</h1><dl class="nums">${st.map(([l,v,h])=>`<div><dt>${l}</dt><dd${h?' class="or"':''}>${v}</dd></div>`).join('')}</dl></div></section>`;

const A={
 rs(){S=init();T('Demo reset.')},
 ok(i){const c=cp(i),n=cost(c);if(S.avail<n)return T('The publisher is '+GH(n-S.avail)+' short. Ask them to deposit before you approve.',1);S.avail-=n;S.res+=n;c.st='LIVE';L('Reserved for “'+c.t+'”',-n);T('Approved. Funds reserved and tasks opened.')},
 no(i){cp(i).st='REJECTED';T('Rejected. The publisher sees the reason.')},
 ap(i){S.ts.push({id:S.nid++,c:+i,st:'APPLIED',n:1,sub:''});T('Applied. The publisher has 24 hours to respond.')},
 acc(i){tk(i).st='ASSIGNED';T('Accepted. Scope, reward and deadline are now locked.')},
 dec(i){tk(i).st='DECLINED';T('Application declined.')},
 pa(i){const t=tk(i),c=cp(t.c),f=fee(c.r);S.res-=c.r+f;S.wd+=c.r;S.fees+=f;t.st='COMPLETED';L('Paid to worker',c.r);L('HUSTLA fee (10%)',f);T('Approved. '+GH(c.r)+' released to the worker.')},
 cr(i){const t=tk(i);if(t.n>=2)return T('Only one correction round is allowed. Approve or open a dispute.',1);t.n=2;t.st='CORRECTION';T('Correction requested. The worker has 48 hours.')},
 ds(i){tk(i).st='DISPUTED';T('Dispute opened. The task funds are on hold.')},
 dc(i,o){const t=tk(i),c=cp(t.c),f=fee(c.r),h=c.r+f;S.res-=h;
  if(o==='W'){S.wd+=c.r;S.fees+=f;t.st='COMPLETED';L('Dispute: paid to worker',c.r)}
  else if(o==='P'){S.avail+=h;t.st='CANCELLED';L('Dispute: refunded to publisher',h)}
  else{const w=Math.round(c.r/2),f2=fee(w);S.wd+=w;S.fees+=f2;S.avail+=h-w-f2;t.st='COMPLETED';L('Dispute: split, worker',w);L('Dispute: split, refund',h-w-f2)}
  T('Decision recorded. Funds moved and both sides notified.')},
 pw(i){S.ws.find(w=>w.id==i).st='PAID';T('Marked as paid.')}
};
const F={
 mk(f){const d=Object.fromEntries(new FormData(f)),x=(d.t+' '+d.d).toLowerCase();S.cs.unshift({id:S.nid++,t:d.t.trim(),cat:d.cat,q:+d.q,r:Math.round(d.r*100),st:'PENDING_REVIEW',d:d.d.trim(),f:BAD.filter(w=>x.includes(w))});T('Submitted. HUSTLA reviews it within 24 hours. Switch to Admin to approve it.')},
 dep(f){const v=Math.round(+f.elements.v.value*100);if(!(v>=5000))return T('The minimum deposit is GH₵50.',1);S.avail+=v;L('Deposit via MoMo',v);T('Deposit confirmed by the payment provider.')},
 wd(f){const v=Math.round(+f.elements.v.value*100);if(!(v>=2000))return T('The minimum withdrawal is GH₵20.',1);if(v>S.wd)return T('That’s more than your withdrawable balance.',1);S.wd-=v;S.ws.unshift({id:S.nid++,a:v,st:'REQUESTED'});T('Withdrawal requested. Next payout run: '+nextRun()+'.')},
 sb(f){const t=tk(f.dataset.i),v=f.elements.v.value.trim();if(v.length<5)return T('Add a link or a short note describing your work.',1);t.sub=v;t.st='SUBMITTED';T('Submitted. The publisher has 48 hours to review.')}
};

const trow=t=>{const b={APPLIED:btn('acc',t.id,'Accept','p')+btn('dec',t.id,'Decline'),SUBMITTED:btn('pa',t.id,'Approve','p')+btn('cr',t.id,'Request correction')+btn('ds',t.id,'Dispute','d')}[t.st]||'';
 return `<div class="it"><div class="line"><span>Ama Serwaa ${chip(t.st)}</span><div class="acts">${b}</div></div>${steps(t)}${t.st==='SUBMITTED'?`<div class="mut">“${esc(t.sub)}”${t.n>1?' (corrected)':''}</div>`:''}${t.st==='DISPUTED'?'<div class="mut">Funds stay on hold until admin decides.</div>':''}</div>`};
const wtask=t=>{const c=cp(t.c);let x='';
 if(t.st==='ASSIGNED'||t.st==='CORRECTION')x=`${t.st==='CORRECTION'?'<div class="warn">The publisher asks: show the product label clearly. You have 48 hours.</div>':''}<form data-f="sb" data-i="${t.id}"><label for="s${t.id}">Link or note about your work</label><textarea id="s${t.id}" name="v" rows="2"></textarea><p><button class="b p">${t.st==='CORRECTION'?'Send corrected work':'Submit work'}</button></p></form>`;
 else if(t.st==='APPLIED')x='<div class="mut">Waiting for the publisher to accept (24 hours).</div>';
 else if(t.st==='SUBMITTED')x='<div class="mut">Waiting for review. After 48 hours with no reply it’s approved automatically.</div>';
 else if(t.st==='COMPLETED')x=`<div class="mut">You earned ${GH(c.r)}.</div>`;
 else if(t.st==='DISPUTED')x='<div class="mut">Under dispute. Admin decides within 3 business days.</div>';
 return `<div class="it"><div class="line"><span class="t">${esc(c.t)}</span>${chip(t.st)}</div>${steps(t)}${x}</div>`};
const empty=m=>`<div class="it mut">${m}</div>`;

const V={
pub(){
 return band('Publisher mode','Fund it. Get it reviewed. Approve the work.',[['Available',GH(S.avail),1],['Reserved for campaigns',GH(S.res)]])+
`<div class="wrap cols"><div><h2>Your campaigns</h2>${S.cs.map(c=>`<div class="list"><div class="it"><div class="line"><div>${tag(c.cat)}<div class="t">${esc(c.t)}</div><div class="mut">${c.q} tasks at ${GH(c.r)}, reserve ${GH(cost(c))}</div></div>${chip(c.st)}</div>${c.st==='REJECTED'?'<div class="warn">Rejected: it breaks the prohibited campaign rules.</div>':''}</div>${S.ts.filter(t=>t.c==c.id).map(trow).join('')}</div>`).join('')}</div>
<aside><div class="box"><h2>Add funds</h2><form data-f="dep" class="acts"><input name="v" type="number" min="50" step="1" placeholder="GH₵, minimum 50" aria-label="Deposit amount"><button class="b p">Pay with MoMo</button></form></div>
<form data-f="mk" class="box"><h2>New campaign</h2>
<label for="t">Title</label><input id="t" name="t" required minlength="8">
<label for="cat">Category</label><select id="cat" name="cat">${CATS.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
<label for="d">What should the worker deliver?</label><textarea id="d" name="d" rows="2" required minlength="10"></textarea>
<div class="acts"><div style="flex:1"><label for="q">Tasks</label><input id="q" name="q" type="number" min="1" max="100" value="3" required></div><div style="flex:1"><label for="r">Reward (GH₵)</label><input id="r" name="r" type="number" min="1" step="0.5" value="20" required></div></div>
<p class="mut">HUSTLA adds 10% on top of each reward. Funds are reserved when admin approves.</p><button class="b p">Submit for review</button></form></aside></div>`},
wk(){
 const open=S.cs.filter(c=>c.st==='LIVE'&&!S.ts.some(t=>t.c==c.id));
 return band('Worker mode','Find work. Deliver it. Get paid in cedis.',[['Withdrawable',GH(S.wd),1],['Tasks completed',S.ts.filter(t=>t.st==='COMPLETED').length]])+
`<div class="wrap cols"><div><h2>Open tasks</h2><div class="list">${open.map(c=>`<div class="it"><div class="line"><div style="flex:1;min-width:200px">${tag(c.cat)}<div class="t">${esc(c.t)}</div><div class="mut">${esc(c.d)}</div></div><div class="acts"><span class="rw">${GH(c.r)}</span>${btn('ap',c.id,'Apply','p')}</div></div></div>`).join('')||empty('Nothing open right now. Create a campaign as Publisher and approve it as Admin.')}</div>
<h2>My tasks</h2><div class="list">${S.ts.map(wtask).join('')||empty('You haven’t applied to anything yet.')}</div></div>
<aside><div class="box"><h2>Withdraw</h2><form data-f="wd" class="acts"><input name="v" type="number" min="20" step="1" placeholder="GH₵, minimum 20" aria-label="Withdrawal amount"><button class="b p">Request payout</button></form>
<p class="mut">Payouts run on Tuesdays and Fridays. Next run: ${nextRun()}.</p>${S.ws.map(w=>`<div class="line" style="padding:6px 0"><span>${GH(w.a)}</span>${chip(w.st)}</div>`).join('')}</div></aside></div>`},
adm(){
 const pr=S.cs.filter(c=>c.st==='PENDING_REVIEW'),ds=S.ts.filter(t=>t.st==='DISPUTED'),ws=S.ws.filter(w=>w.st==='REQUESTED');
 return band('Admin','Nothing goes live without a review.',[['To review',pr.length],['Open disputes',ds.length],['Payouts due',ws.length],['Fees earned',GH(S.fees),1]])+
`<div class="wrap cols"><div><h2>Campaign review</h2><div class="list">${pr.map(c=>`<div class="it">${tag(c.cat)}<div class="t">${esc(c.t)}</div><div class="mut">Reserve ${GH(cost(c))}. Publisher has ${GH(S.avail)} available.</div><p>${esc(c.d)}</p>${c.f.length?`<div class="warn">Screening flagged: ${c.f.map(esc).join(', ')}. Check the prohibited campaign list.</div>`:''}<div class="acts">${btn('ok',c.id,'Approve and reserve funds','p')}${btn('no',c.id,'Reject','d')}</div></div>`).join('')||empty('No campaigns are waiting.')}</div>
<h2>Disputes</h2><div class="list">${ds.map(t=>{const c=cp(t.c);return `<div class="it"><div class="t">${esc(c.t)}</div><div class="mut">Held: ${GH(c.r+fee(c.r))}. Submitted: “${esc(t.sub)}”</div><div class="acts" style="margin-top:8px">${btn('dc',t.id,'Pay worker','p','W')}${btn('dc',t.id,'Refund publisher','','P')}${btn('dc',t.id,'Split 50/50','','S')}</div></div>`}).join('')||empty('No open disputes.')}</div></div>
<aside><div class="box"><h2>Withdrawals</h2>${ws.map(w=>`<div class="line" style="padding:6px 0"><span>${GH(w.a)}, Ama Serwaa</span>${btn('pw',w.id,'Mark paid','p')}</div>`).join('')||'<p class="mut">No payouts waiting.</p>'}</div>
<div class="box"><h2>Ledger</h2>${S.led.slice(0,8).map(e=>`<div class="line" style="padding:5px 0"><span class="mut">${esc(e.l)}</span><span>${GH(e.a)}</span></div>`).join('')}</div></aside></div>`}
};

function render(){
 document.querySelectorAll('#dsw [data-r]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.r===role));
 $('#dash').innerHTML=V[role]();
}
document.addEventListener('click',e=>{
 const r=e.target.closest('[data-r]');if(r){role=r.dataset.r;render();window.scrollTo(0,0);return}
 const b=e.target.closest('[data-a]');if(b){A[b.dataset.a](b.dataset.i,b.dataset.o);render()}
});
document.addEventListener('submit',e=>{const f=e.target;if(!F[f.dataset.f])return;e.preventDefault();F[f.dataset.f](f);render()});
S=init();

return {render};})();
const TITLES={home:'HUSTLA',explore:'Explore tasks',businesses:'For businesses',creators:'For creators','how-it-works':'How it works',pricing:'Pricing & fees',help:'Help Centre',login:'Sign in',signup:'Create account',dashboard:'Dashboard'};
function draw(){const q=$('#xs').value.toLowerCase(),c=$('#xc').value,s=$('#xo').value;
 const l=TASKS.filter(t=>(c===''||t.cat==c)&&(t.t+' '+t.req).toLowerCase().includes(q)).sort(s==='r'?(a,b)=>b.r-a.r:(a,b)=>a.days-b.days);
 $('#xl').innerHTML=l.map(row).join('')||'<div class="it mut">Nothing matches. Try another category or search.</div>';$('#xn').textContent=l.length+' open task'+(l.length==1?'':'s')}
function calc(){const q=Math.max(1,Math.floor(+$('#cq').value||1)),R=Math.round((+$('#cr').value||0)*100),f=Math.round(R*.1);
 $('#cres').innerHTML=`<div><span>Workers receive</span><span>${GH(q*R)}</span></div><div><span>HUSTLA fee (10%)</span><span>${GH(q*f)}</span></div><div class="big"><span>You fund</span><span>${GH(q*(R+f))}</span></div>`}
let SESS=null,NEXT=null,CUR='';try{SESS=JSON.parse(sessionStorage.getItem('hs'))}catch(e){}
const PRIV={explore:1,dashboard:1};
function hdr(){$('#hact').innerHTML=SESS?'<a class="b" href="#dashboard">Dashboard</a><button class="b p" data-so="1">Sign out</button>':'<a class="b" href="#login">Sign in</a><a class="b p" href="#signup">Get started</a>'}
function signIn(n){SESS={name:n||''};try{sessionStorage.setItem('hs',JSON.stringify(SESS))}catch(e){}hdr()}
function signOut(){SESS=null;try{sessionStorage.removeItem('hs')}catch(e){}hdr();location.hash='#home'}
document.addEventListener('click',e=>{if(e.target.closest('[data-so]'))signOut()});
const dashView=()=>`<div class="dsh"><div class="dtb"><nav class="seg" id="dsw" aria-label="View as"><button data-r="pub">Publisher</button><button data-r="wk">Worker</button><button data-r="adm">Admin</button></nav><span class="mut">Signed in as ${esc(SESS.name||'Ama')}. <button class="lk" data-a="rs">Reset demo data</button></span></div><div id="dash"></div></div>`;
function go(){const h=(location.hash||'#home').slice(1);let k=R[h]?h:'home';
 if(PRIV[k]&&!SESS){NEXT=k;history.replaceState(null,'','#login');k='login'}
 else if(SESS&&(k==='login'||k==='signup')){k='dashboard';history.replaceState(null,'','#dashboard')}
 else if(k!=='login'&&k!=='signup')NEXT=null;
 $('#app').innerHTML=R[k]();document.title=k==='home'?'HUSTLA':TITLES[k]+' | HUSTLA';
 document.querySelectorAll('[data-nav]').forEach(a=>a.dataset.nav===k?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
 CUR=k;if(k==='explore')draw();if(k==='pricing')calc();if(k==='login'||k==='signup')authInit(k);if(k==='dashboard')DASH.render();window.scrollTo(0,0)}
document.addEventListener('input',e=>{if(e.target.closest('#xf'))draw();if(e.target.closest('#calc'))calc()});
hdr();const LD=$('#ld');LD.querySelector('img').src=MARK;LD.style.setProperty('--m','url('+MARK+')');
let LT;function nav(){LD.classList.remove('init');LD.classList.add('on');clearTimeout(LT);LT=setTimeout(()=>{go();LT=setTimeout(()=>LD.classList.remove('on'),420)},280)}
addEventListener('hashchange',nav);
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;const h=a.getAttribute('href');if(h.length<2)return;e.preventDefault();if(location.hash!==h){try{location.hash=h}catch(x){}}setTimeout(()=>{if(CUR!==(location.hash||'#home').slice(1))nav()},150)});
try{go()}catch(e){}LT=setTimeout(()=>LD.classList.remove('on','init'),900);
