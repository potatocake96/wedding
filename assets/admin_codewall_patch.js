// Add-on patch: shows group code + regenerate, without touching your existing admin.js
import { supabase } from "./app.js";
const $ = (s, r=document) => r.querySelector(s);
function waitForEl(sel){
  return new Promise((resolve)=>{
    const el = $(sel);
    if (el) return resolve(el);
    const obs = new MutationObserver(()=>{
      const el2 = $(sel);
      if (el2){ obs.disconnect(); resolve(el2); }
    });
    obs.observe(document.documentElement, { childList:true, subtree:true });
  });
}
async function updateCodePill() {
  const sel = $('#groupSelect');
  const pill = $('#groupCode');
  if (!sel || !pill || !sel.value) { if (pill) pill.textContent = '----'; return; }
  const { data, error } = await supabase.from('groups').select('id, code').eq('id', sel.value).single();
  if (error) { console.warn(error); pill.textContent = '----'; return; }
  pill.textContent = data?.code || '----';
}
async function onRegen() {
  const sel = $('#groupSelect');
  if (!sel?.value) return alert('Select a group first');
  const { data: new_code, error } = await supabase.rpc('reset_group_code', { p_group_id: sel.value });
  if (error) { console.warn(error); return alert('Could not regenerate code'); }
  const pill = $('#groupCode');
  if (pill) pill.textContent = new_code || '----';
}
function ensureUI(selectEl) {
  if (document.getElementById('groupCode') && document.getElementById('regenCode')) return;
  const row = selectEl.closest('.row') || selectEl.parentElement || selectEl;
  const holder = document.createElement('div');
  holder.className = 'row';
  holder.style.alignItems = 'center';
  holder.style.gap = '8px';
  holder.style.marginTop = '8px';
  const pill = document.createElement('span'); pill.id='groupCode'; pill.className='chip'; pill.textContent='----';
  const regen = document.createElement('button'); regen.id='regenCode'; regen.className='btn ghost'; regen.type='button'; regen.textContent='Regenerate';
  holder.append(pill, regen);
  row.insertAdjacentElement('afterend', holder);
  selectEl.addEventListener('change', updateCodePill);
  regen.addEventListener('click', onRegen);
  setTimeout(updateCodePill, 500);
}
document.addEventListener('DOMContentLoaded', async ()=>{
  const sel = await waitForEl('#groupSelect');
  ensureUI(sel);
});
