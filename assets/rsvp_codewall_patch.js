// RSVP — Ground-up redesign with tri-state attendance and per-guest notes
import { supabase } from "./app.js";
if (!window.__RSVP_REDESIGN_INIT__) {
  window.__RSVP_REDESIGN_INIT__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const el = (t, p={}) => Object.assign(document.createElement(t), p);

  // -------- Utilities --------
  const now = ()=>Date.now();
  let throttle = { tries: 0, until: 0 };
  const blocked = ()=> now() < throttle.until;
  const bump = ()=>{ throttle.tries += 1; if (throttle.tries >= 5){ throttle.until = now()+90_000; throttle.tries=0; } };

  const ATT = { YES: 'yes', NO: 'no', NS: 'ns' }; // not sure => null

  function stateToDb(val){
    if (val === ATT.YES) return true;
    if (val === ATT.NO) return false;
    return null;
  }
  function dbToState(val){
    if (val === true) return ATT.YES;
    if (val === false) return ATT.NO;
    return ATT.NS;
  }

  // -------- Code Gate --------
  function showGate(){
    if ($('#gate-codewall')) return;
    const gate = el('div', { id:'gate-codewall', className:'gate' });
    gate.innerHTML = `
      <main class="card" role="dialog" style="width:min(94vw,520px);max-width:520px;padding:18px 16px;background:#fff;border-radius:16px;box-shadow:0 6px 22px rgba(0,0,0,.12)">
        <header class="hero" style="margin-bottom:6px">
          <div class="overline">RSVP Access</div>
          <h1 class="names" style="line-height:1.1">
            <span class="name-top">Enter your code</span>
          </h1>
        </header>
        <section class="stack">
          <p class="helper">Enter the <strong>4-digit code</strong> from your invite.</p>
          <div class="row" style="justify-content:center">
            <input id="cwCode" inputmode="numeric" pattern="[0-9]*" maxlength="4" class="field rsvp-codefield" placeholder="••••" />
          </div>
          <div class="row" style="justify-content:center">
            <button id="cwUnlock" class="btn btn-primary" style="min-width:160px">Continue</button>
          </div>
          <div id="cwMsg" class="helper" style="text-align:center;display:none"></div>
        </section>
      </main>`;
    document.body.appendChild(gate);

    const code = $('#cwCode');
    const btn  = $('#cwUnlock');
    const msg  = $('#cwMsg');
    setTimeout(()=> code?.focus(), 50);
    code?.addEventListener('input', (e)=>{ e.target.value = (e.target.value||'').replace(/\D/g,'').slice(0,4); });
    code?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); btn?.click(); } });

    btn?.addEventListener('click', async ()=>{
      if (blocked()){ msg.textContent='Too many attempts. Please wait and try again.'; msg.style.display='block'; return; }
      const val = (code?.value||'').trim();
      if (!/^\d{4}$/.test(val)){ msg.textContent='Please enter 4 digits.'; msg.style.display='block'; return; }
      msg.style.display='none'; btn.disabled = true; const old = btn.textContent; btn.textContent='Checking…';
      try{
        const { data: grp, error } = await supabase.from('groups').select('id, name, code').eq('code', val).maybeSingle();
        if (error) throw error;
        if (!grp){ bump(); msg.textContent='That code was not recognized.'; msg.style.display='block'; return; }
        $('#gate-codewall')?.remove();
        await renderRSVP(grp);
        window.scrollTo({ top:0, behavior:'smooth' });
      }catch(e){
        console.warn(e); msg.textContent='Could not verify the code right now.'; msg.style.display='block';
      }finally{
        btn.disabled = false; btn.textContent = old;
      }
    });
  }

  // -------- UI Builders --------
  function triToggle(current){
    const wrap = el('div', { className:'tri' });
    const yes = el('button', { type:'button', className:'tri-btn', textContent:'Yes' });
    const no  = el('button', { type:'button', className:'tri-btn', textContent:'No' });
    const ns  = el('button', { type:'button', className:'tri-btn', textContent:'Not sure' });

    const set = (val)=>{
      yes.classList.toggle('on', val===ATT.YES);
      no.classList.toggle('on',  val===ATT.NO);
      ns.classList.toggle('on',  val===ATT.NS);
      wrap.dataset.val = val;
    };
    yes.addEventListener('click', ()=> set(ATT.YES));
    no .addEventListener('click', ()=> set(ATT.NO));
    ns .addEventListener('click', ()=> set(ATT.NS));

    set(current);
    wrap.append(yes, no, ns);
    return wrap;
  }

  async function renderRSVP(group){
    const host = document.getElementById('rsvpMount') || document.querySelector('main') || document.body;
    // Clear previous render if any
    document.getElementById('rsvpRoot')?.remove();

    const root = el('section', { id:'rsvpRoot', className:'stack rsvp-root' });
    root.innerHTML = `
      <header class="hero">
        <div class="overline">You’re responding for</div>
        <h1 class="names"><span class="name-top">${(group.name||'').toUpperCase()}</span></h1>
      </header>

      <section class="rsvp-grid">
        <div class="card section-card" id="whoCard">
          <h3 class="section-title">Who’s attending</h3>
          <div id="guestList" class="stack"></div>
        </div>

        <div class="card section-card" id="detailsCard">
          <h3 class="section-title">Dietary & Notes</h3>
          <p class="helper" style="margin-top:-6px">Add any dietary requirements or extra notes. One box per person.</p>
          <div id="notesList" class="stack"></div>
        </div>
      </section>

      <section class="card section-card">
        <div class="row" style="justify-content:flex-end">
          <button id="saveBtn" class="btn btn-primary" style="min-width:180px">Save RSVP</button>
        </div>
        <div id="saveMsg" class="helper" style="display:none;text-align:center;color:#2e7d32">Saved — thank you!</div>
      </section>
    `;
    host.appendChild(root);

    // Load members
    const guestList = $('#guestList');
    const notesList = $('#notesList');
    let members = [];
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('id, name, attending, dietary, group_name')
        .eq('group_name', group.name)
        .order('name');
      if (error) throw error;
      members = data || [];
    } catch(e){
      console.warn(e);
      guestList.innerHTML = '<div class="helper" style="color:#b00020">Could not load your invite.</div>';
      return;
    }

    // Build rows
    members.forEach(m => {
      // Who’s attending row
      const row = el('div', { className:'guest-row' });
      const nm  = el('div', { className:'guest-name', textContent: m.name });
      const tri = triToggle(dbToState(m.attending));
      tri.dataset.id = m.id;
      row.append(nm, tri);
      guestList.appendChild(row);

      // Notes row
      const nrow = el('div', { className:'note-row' });
      const label = el('label', { className:'note-label', textContent: m.name });
      const ta = el('textarea', { className:'field note-field', placeholder:'Dietary requirements or additional notes (optional)' });
      ta.value = m.dietary || '';
      ta.dataset.id = m.id;
      nrow.append(label, ta);
      notesList.appendChild(nrow);
    });

    // Save
    const saveBtn = $('#saveBtn');
    const saveMsg = $('#saveMsg');
    saveBtn?.addEventListener('click', async ()=>{
      saveBtn.disabled = true; const old = saveBtn.textContent; saveBtn.textContent = 'Saving…';
      try{
        // Collect updates
        const triStates = [...document.querySelectorAll('.tri')].map(w => ({
          id: w.dataset.id,
          attending: stateToDb(w.dataset.val)
        }));
        const noteStates = [...document.querySelectorAll('.note-field')].map(t => ({
          id: t.dataset.id,
          dietary: t.value.trim()
        }));

        // Write in small batches to avoid rate limits
        for (const s of triStates){
          await supabase.from('guests').update({ attending: s.attending, updated_at: new Date().toISOString() }).eq('id', s.id);
        }
        for (const s of noteStates){
          await supabase.from('guests').update({ dietary: s.dietary, updated_at: new Date().toISOString() }).eq('id', s.id);
        }

        saveMsg.style.display = 'block';
        if (window.fireConfetti) try { window.fireConfetti(); } catch {}
        setTimeout(()=> saveMsg.style.display='none', 1800);
      } finally {
        saveBtn.disabled = false; saveBtn.textContent = old;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', showGate);
}
