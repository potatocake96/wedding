import { supabase } from "./app.js";

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

let currentGroup=null;

// Helpers
function onlyDigits(v){return(v||"").replace(/\D/g,"").slice(0,4);}
function setCodeMsg(msg){
  const el=$("#code-msg");if(!el)return;
  el.textContent=msg||"";msg?el.removeAttribute("hidden"):el.setAttribute("hidden","");
}

// Confirmation
function openCelebrate(){
  const m=document.createElement("div");
  m.className="celebrate-modal";
  m.innerHTML=`
    <div class="celebrate-card-pop">
      <h3 class="celebrate-title">RSVP Received</h3>
      <p class="celebrate-lead">Thank you for your reply.</p>
      <p class="celebrate-msg">We can’t wait to celebrate with you!</p>
      <div class="celebrate-actions">
        <button class="btn btn-gold" data-close="1">Okay</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  setTimeout(()=>m.classList.add("show"),50);
  m.addEventListener("click",e=>{if(e.target.dataset.close)m.remove();});
  if(window.confetti)confetti({particleCount:150,spread:80,origin:{y:0.6}});
}

// Fetch group
async function fetchGroup(code){
  const {data,error}=await supabase
    .from("group_lookup")
    .select("id,name,members")
    .eq("code",code)
    .maybeSingle();
  if(error)throw error;
  if(!data)throw new Error("Invalid code");
  const members=(data.members||[]).map(m=>({
    id:m.id,full_name:m.full_name||m.name||"Guest",
    attending:!!m.attending,dietary:m.dietary||""
  }));
  return{id:data.id,name:data.name,members};
}

// Render list
function renderMembers(g){
  const list=$("#guest-list");list.innerHTML="";
  (g.members||[]).forEach(m=>{
    const c=document.createElement("div");
    c.className="card guest-card";
    c.dataset.memberId=m.id;c.dataset.fullName=m.full_name;
    c.dataset.attending=m.attending?"1":"0";
    c.innerHTML=`
      <div class="row" style="justify-content:space-between;align-items:center;">
        <strong>${m.full_name}</strong>
        <div class="btn-row">
          <button class="btn ${m.attending?"btn-primary shimmer":""}" data-attend="yes">Attending</button>
          <button class="btn ${!m.attending?"btn-primary shimmer":""}" data-attend="no">Not attending</button>
        </div>
      </div>
      <div class="row" style="margin-top:8px;">
        <input class="field" type="text" placeholder="Dietary (optional)" value="${m.dietary}" data-dietary="${m.id}">
      </div>`;
    list.appendChild(c);
  });
  list.onclick=e=>{
    const b=e.target.closest("button[data-attend]");if(!b)return;
    const yes=b.dataset.attend==="yes";
    b.parentElement.querySelectorAll("button[data-attend]").forEach(x=>x.classList.remove("btn-primary","shimmer"));
    b.classList.add("btn-primary","shimmer");
    const card=b.closest(".card");card.dataset.attending=yes?"1":"0";
  };
}

// Save
async function saveAll(){
  const cards=$$("#guest-list>.card");
  const updates=cards.map(c=>({
    id:c.dataset.memberId,
    attending:c.dataset.attending==="1",
    dietary:$(`[data-dietary="${c.dataset.memberId}"]`)?.value||""
  }));

  for(const u of updates){
    if(!u.id)continue;
    await supabase.from("guests")
      .update({attending:u.attending,dietary:u.dietary,rsvp_submitted:true})
      .eq("id",u.id);
  }

  // 🎉 Trigger confetti animation (same as index page)
  if (window.confetti) {
    confetti({
      particleCount: 220,
      spread: 90,
      startVelocity: 45,
      origin: { y: 0.6 }
    });
  }

  // Optional small delay before showing message for smoother timing
  setTimeout(() => {
    openCelebrate();
  }, 400);
}


// Bind
document.addEventListener("DOMContentLoaded",()=>{
  $("#rsvp-code")?.addEventListener("input",e=>{
    e.target.value=onlyDigits(e.target.value);setCodeMsg("");
  });

  $("#code-continue")?.addEventListener("click",async()=>{
    const code=onlyDigits($("#rsvp-code")?.value);
    if(code.length!==4){setCodeMsg("Please enter your 4-digit code.");return;}
    try{
      const g=await fetchGroup(code);
      currentGroup=g;$("#group-name .name-top").textContent=g.name;
      $("#code-wall").hidden=true;$("#group-section").hidden=false;
      renderMembers(g);
    }catch(e){setCodeMsg("That code didn’t match. Try again.");console.error(e);}
  });

  $("#save-rsvp")?.addEventListener("click",async()=>{
    try{await saveAll();}catch(e){alert("Could not save RSVP.");console.error(e);}
  });
});
