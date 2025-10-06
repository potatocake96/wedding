import { supabase } from "./app.js";
const $ = (s)=>document.querySelector(s);

const loginBlock = $('#loginBlock');
const dash = $('#dash');
const summary = $('#summary');
const tabsEl = $('#tabs');
const groupTools = $('#groupTools');
const groupSelect = $('#groupSelect');
const guestTableBody = document.querySelector('#guestTable tbody');
const thead = $('#thead');

let CURRENT_GROUP_NAME = null;
let ACTIVE_TAB = 'group'; // 'group' | 'yes' | 'no'

// ---------- AUTH ----------
$('#adminLogin')?.addEventListener('click', async ()=>{
  const email = $('#adminEmail').value.trim();
  const password = $('#adminPass').value.trim();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { alert('Login failed'); console.warn(error); return; }
  loginBlock.classList.add('hidden'); dash.classList.remove('hidden');
  await init();
});

// ---------- INIT ----------
async function init(){
  await ensureGroupsTableExists();
  await loadGroups();
  await loadSummary();
  if (groupSelect.value) {
    CURRENT_GROUP_NAME = groupSelect.options[groupSelect.selectedIndex]?.textContent || null;
    await loadGuestsForGroup(CURRENT_GROUP_NAME);
  }
}

// ---------- Tabs ----------
tabsEl?.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-tab]'); if(!btn) return;
  tabsEl.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ACTIVE_TAB = btn.dataset.tab;

  if (ACTIVE_TAB === 'group') {
    groupTools.classList.remove('hidden');
    thead.innerHTML = `<tr><th>Name</th><th>Group</th><th>Attending</th><th>Dietary</th><th>Updated</th><th></th></tr>`;
    // reload group view
    CURRENT_GROUP_NAME = groupSelect.options[groupSelect.selectedIndex]?.textContent || null;
    await loadGuestsForGroup(CURRENT_GROUP_NAME);
  } else if (ACTIVE_TAB === 'yes') {
    groupTools.classList.add('hidden');
    thead.innerHTML = `<tr><th>Name</th><th>Group</th><th>Attending</th><th>Dietary</th><th>Updated</th></tr>`;
    await loadAttending(true);
  } else if (ACTIVE_TAB === 'no') {
    groupTools.classList.add('hidden');
    thead.innerHTML = `<tr><th>Name</th><th>Group</th><th>Attending</th><th>Dietary</th><th>Updated</th></tr>`;
    await loadAttending(false);
  }
});

// ---------- Groups ----------
async function ensureGroupsTableExists(){
  // If groups table is missing, this will error; we surface a helpful message
  const { error } = await supabase.from('groups').select('id, name').limit(1);
  if (error) {
    alert('The "groups" table is missing. Please run the small SQL to create it.');
    throw error;
  }
}

async function loadGroups(prefillName){
  const { data, error } = await supabase.from('groups').select('id, name').order('name');
  if (error) { console.warn('groups read error', error); return; }
  groupSelect.innerHTML = (data||[]).map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  if (prefillName) {
    const match = (data||[]).find(g=>g.name === prefillName);
    if (match) groupSelect.value = match.id;
  }
}

$('#createGroup')?.addEventListener('click', async ()=>{
  const name = $('#newGroupName').value.trim();
  if (!name) return alert('Enter a group name');
  const { error } = await supabase.from('groups').insert([{ name }]);
  if (error) { alert('Could not create group (is the name unique?)'); console.warn(error); return; }
  $('#newGroupName').value = '';
  await loadGroups(name);
  $('#groupHint').textContent = 'Group created. You can add guests below.';
  CURRENT_GROUP_NAME = name;
  await loadGuestsForGroup(CURRENT_GROUP_NAME);
});

$('#renameGroup')?.addEventListener('click', async ()=>{
  if (!groupSelect.value) return alert('Select a group');
  const currentName = groupSelect.options[groupSelect.selectedIndex].textContent;
  const newName = prompt('New group name:', currentName);
  if (!newName || newName === currentName) return;
  const { error } = await supabase.from('groups').update({ name: newName }).eq('id', groupSelect.value);
  if (error) { alert('Rename failed'); console.warn(error); return; }
  // keep guests.group_name (Option A) in sync with new name
  await supabase.from('guests').update({ group_name: newName, updated_at: new Date().toISOString() }).eq('group_name', currentName);
  await loadGroups(newName);
  CURRENT_GROUP_NAME = newName;
  await loadGuestsForGroup(CURRENT_GROUP_NAME);
});

$('#deleteGroup')?.addEventListener('click', async ()=>{
  if (!groupSelect.value) return alert('Select a group');
  const name = groupSelect.options[groupSelect.selectedIndex].textContent;
  if (!confirm(`Delete group “${name}” and all of its guests?`)) return;
  await supabase.from('guests').delete().eq('group_name', name); // Option A guests
  const { error } = await supabase.from('groups').delete().eq('id', groupSelect.value);
  if (error) { alert('Delete failed'); console.warn(error); return; }
  guestTableBody.innerHTML = '';
  CURRENT_GROUP_NAME = null;
  await loadGroups();
  await loadSummary();
});

groupSelect?.addEventListener('change', async ()=>{
  CURRENT_GROUP_NAME = groupSelect.options[groupSelect.selectedIndex]?.textContent || null;
  await loadGuestsForGroup(CURRENT_GROUP_NAME);
});

// ---------- Guests (Group tab) ----------
async function loadGuestsForGroup(groupName){
  if (!groupName) { guestTableBody.innerHTML = ''; return; }
  const { data, error } = await supabase.from('guests').select('*').eq('group_name', groupName).order('name');
  if (error) { console.warn(error); return; }
  renderGroupRows(data||[]);
  await loadSummary();
}

function renderGroupRows(rows){
  guestTableBody.innerHTML = rows.map(r=>`
    <tr>
      <td contenteditable data-id="${r.id}" data-field="name">${r.name||''}</td>
      <td>${r.group_name||''}</td>
      <td style="text-align:center"><input type="checkbox" data-id="${r.id}" data-field="attending" ${r.attending?'checked':''}></td>
      <td contenteditable data-id="${r.id}" data-field="dietary">${r.dietary||''}</td>
      <td>${new Date(r.updated_at).toLocaleString()}</td>
      <td style="text-align:right">
        <button class="submit danger" data-action="del" data-id="${r.id}">Delete</button>
      </td>
    </tr>
  `).join('');
}

$('#addGuest')?.addEventListener('click', async ()=>{
  if (!CURRENT_GROUP_NAME) return alert('Select a group first');
  const name = $('#guestNameNew').value.trim();
  if (!name) return alert('Enter guest name');
  const { error } = await supabase.from('guests').insert([{ name, group_name: CURRENT_GROUP_NAME }]);
  if (error) { alert('Could not add guest'); console.warn(error); return; }
  $('#guestNameNew').value = '';
  await loadGuestsForGroup(CURRENT_GROUP_NAME);
});

document.getElementById('guestTable')?.addEventListener('change', async (e)=>{
  if (e.target.type === 'checkbox') {
    const id = e.target.dataset.id;
    const { error } = await supabase.from('guests').update({
      attending: e.target.checked, updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { alert('Update failed'); console.warn(error); }
    if (ACTIVE_TAB !== 'group') await refreshActiveTab();
    await loadSummary();
  }
});

document.getElementById('guestTable')?.addEventListener('blur', async (e)=>{
  const field = e.target?.dataset?.field;
  if (!field) return;
  const id = e.target.dataset.id;
  const value = e.target.textContent.trim();
  const { error } = await supabase.from('guests').update({
    [field]: value, updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) { alert('Update failed'); console.warn(error); }
}, true);

document.getElementById('guestTable')?.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button[data-action="del"]');
  if (!btn) return;
  if (!confirm('Delete this guest?')) return;
  const id = btn.dataset.id;
  const { error } = await supabase.from('guests').delete().eq('id', id);
  if (error) { alert('Delete failed'); console.warn(error); return; }
  await refreshActiveTab();
  await loadSummary();
});

// ---------- Attending / Not Attending tabs ----------
async function loadAttending(val){
  const { data, error } = await supabase
    .from('guests')
    .select('name, group_name, attending, dietary, updated_at, id')
    .eq('attending', val)
    .order('group_name', { ascending: true })
    .order('name', { ascending: true });
  if (error) { console.warn(error); return; }
  renderFlatRows(data||[]);
}

function renderFlatRows(rows){
  // flat list: Name | Group | Attending | Dietary | Updated  (no delete column here)
  guestTableBody.innerHTML = rows.map(r=>`
    <tr>
      <td>${r.name||''}</td>
      <td>${r.group_name||''}</td>
      <td style="text-align:center"><input type="checkbox" data-id="${r.id}" data-field="attending" ${r.attending?'checked':''}></td>
      <td contenteditable data-id="${r.id}" data-field="dietary">${r.dietary||''}</td>
      <td>${new Date(r.updated_at).toLocaleString()}</td>
    </tr>
  `).join('');
}

async function refreshActiveTab(){
  if (ACTIVE_TAB === 'group') {
    await loadGuestsForGroup(CURRENT_GROUP_NAME);
  } else if (ACTIVE_TAB === 'yes') {
    await loadAttending(true);
  } else if (ACTIVE_TAB === 'no') {
    await loadAttending(false);
  }
}

// ---------- Summary ----------
async function loadSummary(){
  const { data } = await supabase.from('guests').select('attending');
  const total = (data||[]).length;
  const yes = (data||[]).filter(r=>r.attending===true).length;
  const no = (data||[]).filter(r=>r.attending===false).length;
  const pending = total - yes - no;
  summary.textContent = `Total: ${total} | Attending: ${yes} | Declined: ${no} | Pending: ${pending}`;
}

// ---------- Password ----------
$('#setPass')?.addEventListener('click', async ()=>{
  const v = $('#newPass').value.trim();
  if (!v) return;
  // UPDATE first
  let { data, error } = await supabase
    .from('settings')
    .update({ value: v, updated_at: new Date().toISOString() })
    .eq('key', 'rsvp_password');

  // Fallback INSERT if row missing (requires INSERT policy on settings)
  if (error || (Array.isArray(data) && data.length === 0)) {
    const ins = await supabase.from('settings').insert([{ key: 'rsvp_password', value: v }]);
    if (ins.error) { alert('Could not set password — add INSERT policy on settings or pre-seed the row.'); return; }
  }
  alert('Password updated!');
  $('#newPass').value = '';
});

