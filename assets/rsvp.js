import { supabase } from "./app.js";
const $ = (s)=>document.querySelector(s);
const passwordGate = $('#passwordGate');
const searchBlock  = $('#searchBlock');
const groupBlock   = $('#groupBlock');
const passBtn = $('#passBtn');
const passInput = $('#rsvpPass');
const passMsg = $('#passMsg');
const guestList = $('#guestList');
const groupTitle = $('#groupTitle');
const searchError = $('#searchError');
const success = $('#success');

async function getPwd(){
  const { data } = await supabase.from('settings').select('value').eq('key','rsvp_password').single();
  return data?.value || null;
}
async function tryUnlock(){
  const exp = await getPwd();
  if((localStorage.getItem('rsvpAccess')||'') === exp){
    passwordGate.classList.add('hidden');
    searchBlock.classList.remove('hidden');
  }
}
tryUnlock();
passBtn?.addEventListener('click', async ()=>{
  const exp = await getPwd();
  if(passInput.value.trim() === exp){
    localStorage.setItem('rsvpAccess', exp);
    passwordGate.classList.add('hidden');
    searchBlock.classList.remove('hidden');
  }else{
    passMsg.textContent = "Incorrect password. Please try again.";
  }
});

document.getElementById('searchForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  success.classList.add('hidden');
  searchError.classList.add('hidden');
  guestList.innerHTML = "";
  groupBlock.classList.add('hidden');
  const q = (document.getElementById('guestQuery').value||'').trim();
  if(!q) return;
  const { data: found } = await supabase.from('guests').select('*').ilike('name', `%${q}%`);
  if(!found || !found.length){ searchError.classList.remove('hidden'); return; }
  const group = found[0].group_name || found[0].name;
  const { data: members } = await supabase.from('guests').select('*').eq('group_name', group).order('name');
  groupTitle.textContent = (group||'').toUpperCase();
  members.forEach(m=>{
    const row = document.createElement('label');
    row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
    row.innerHTML = `<input type="checkbox" data-id="${m.id}" ${m.attending?'checked':''}> <span>${m.name}</span>`;
    guestList.appendChild(row);
  });
  groupBlock.classList.remove('hidden');
});

document.getElementById('submitRSVP')?.addEventListener('click', async ()=>{
  const boxes = guestList.querySelectorAll('input[type="checkbox"]');
  for(const b of boxes){
    await supabase.from('guests').update({ attending: b.checked, rsvp_submitted: true, updated_at:new Date().toISOString() }).eq('id', b.dataset.id);
  }
  success.classList.remove('hidden');
  tinyBurst();
});

function tinyBurst(){
  const EMOJIS=['💙','💐','💫','🕊️','🎉'];
  for(let i=0;i<28;i++){
    const span=document.createElement('span');
    span.textContent=EMOJIS[(Math.random()*EMOJIS.length)|0];
    Object.assign(span.style,{position:'fixed',left:(Math.random()*100)+'vw',top:'50vh',fontSize:(18+Math.random()*12)+'px',transition:'transform 1.2s ease, opacity 1.2s ease',opacity:'1',zIndex:10000,pointerEvents:'none'});
    document.body.appendChild(span);
    const dx=(Math.random()*120-60), dy=-(150+Math.random()*140);
    requestAnimationFrame(()=>{ span.style.transform=`translate(${dx}px,${dy}px) rotate(${(Math.random()*360)|0}deg)`; span.style.opacity='0'; });
    setTimeout(()=>span.remove(),1300);
  }
}