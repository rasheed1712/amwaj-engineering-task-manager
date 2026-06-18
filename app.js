
const firebaseConfig = {
  apiKey: "AIzaSyB4KtvvzSd2s3MqGT9r33Kpx6JMAAX_U30",
  authDomain: "amwaj-engineering-task-m-60adc.firebaseapp.com",
  projectId: "amwaj-engineering-task-m-60adc",
  storageBucket: "amwaj-engineering-task-m-60adc.firebasestorage.app",
  messagingSenderId: "492245144338",
  appId: "1:492245144338:web:350fccbd4a8a20c26a59cb",
  measurementId: "G-888DBYGPMN"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const fs = firebase.firestore();

const priorityText={critical:"حرج",important:"مهم",normal:"متأني",later:"ليس بالوقت الحالي"};
const priorityClass={critical:"p-critical",important:"p-important",normal:"p-normal",later:"p-later"};
const statusText={open:"مفتوحة",progress:"قيد العمل",done:"منجزة"};
const statusClass={open:"status-open",progress:"status-progress",done:"status-done"};

let db={employees:[],tasks:[],users:[]};
let currentAuthUser=null,currentUserData=null;
let selectedEmployeeWindowId=localStorage.getItem("task_manager_selected_employee")||"";
let unsubEmployees=null,unsubTasks=null,unsubUsers=null;

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function todayISO(){return new Date().toISOString().slice(0,10)}
function formatDate(d){return d?d:"-"}
function escapeHTML(s){return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function employeeName(id){const e=db.employees.find(x=>x.id===id);return e?e.name:"غير مكلّفة"}
function isAdmin(){return currentUserData&&currentUserData.role==="admin"}
function requireAdmin(){if(!isAdmin()){alert("هذه الصلاحية خاصة بالمدير فقط");return false}return true}
function detach(){if(unsubEmployees)unsubEmployees();if(unsubTasks)unsubTasks();if(unsubUsers)unsubUsers();unsubEmployees=unsubTasks=unsubUsers=null}

async function ensureUserProfile(user){
  const ref=fs.collection("users").doc(user.uid);
  const snap=await ref.get();
  if(snap.exists){currentUserData={id:user.uid,...snap.data()};return true}
  const any=await fs.collection("users").limit(1).get();
  if(any.empty){
    const profile={email:user.email||"",username:user.email||"",role:"admin",employeeId:"",createdAt:todayISO()};
    await ref.set(profile);currentUserData={id:user.uid,...profile};return true
  }
  alert("هذا الحساب موجود في Firebase Authentication لكن لا توجد له صلاحية داخل البرنامج. أضفه من تبويب الحسابات.");
  await auth.signOut();return false
}
function startRealtime(){
  detach();
  unsubEmployees=fs.collection("employees").orderBy("createdAt","asc").onSnapshot(s=>{db.employees=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()},e=>alert("خطأ الموظفين: "+e.message));
  unsubTasks=fs.collection("tasks").orderBy("createdAt","desc").onSnapshot(s=>{db.tasks=s.docs.map(d=>({id:d.id,comments:[],pendingEmployeeId:"",status:"open",...d.data()}));renderAll()},e=>alert("خطأ المهام: "+e.message));
  unsubUsers=fs.collection("users").orderBy("createdAt","asc").onSnapshot(s=>{db.users=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()},e=>alert("خطأ الحسابات: "+e.message));
}
auth.onAuthStateChanged(async user=>{
  if(user){currentAuthUser=user; if(await ensureUserProfile(user)){showApp();startRealtime()}}
  else{currentAuthUser=null;currentUserData=null;detach();document.getElementById("app").classList.add("hidden");document.getElementById("loginScreen").classList.remove("hidden")}
});
async function login(){
  const email=document.getElementById("loginUsername").value.trim(), pass=document.getElementById("loginPassword").value;
  if(!email||!pass){alert("يرجى كتابة البريد الإلكتروني وكلمة المرور");return}
  try{await auth.signInWithEmailAndPassword(email,pass)}catch(e){alert("فشل تسجيل الدخول: "+e.message)}
}
async function logout(){await auth.signOut();document.getElementById("loginPassword").value=""}

function showApp(){
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("currentUserLabel").textContent=isAdmin()?`مدير: ${currentUserData.email||currentAuthUser.email}`:`موظف: ${employeeName(currentUserData.employeeId)} - ${currentUserData.email||currentAuthUser.email}`;
  document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
  switchTab(isAdmin()?"dashboard":"employees");renderAll()
}
function switchTab(target){
  if(!isAdmin()&&target!=="employees")target="employees";
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.target===target));
  document.querySelectorAll(".section").forEach(s=>s.classList.toggle("active",s.id===target));
  renderAll()
}
document.addEventListener("click",e=>{const b=e.target.closest(".tab");if(b&&b.dataset.target)switchTab(b.dataset.target)});

async function addEmployee(){
  if(!requireAdmin())return;
  const name=document.getElementById("empName").value.trim(), role=document.getElementById("empRole").value.trim();
  if(!name){alert("يرجى كتابة اسم الموظف");return}
  const doc=await fs.collection("employees").add({name,role,createdAt:todayISO()});
  if(!selectedEmployeeWindowId){selectedEmployeeWindowId=doc.id;localStorage.setItem("task_manager_selected_employee",selectedEmployeeWindowId)}
  document.getElementById("empName").value="";document.getElementById("empRole").value=""
}
async function deleteEmployee(id){
  if(!requireAdmin())return;
  const emp=db.employees.find(e=>e.id===id); if(!emp)return;
  const related=db.tasks.filter(t=>t.employeeId===id);
  if(!confirm(related.length?`سيتم حذف الموظف (${emp.name}) وإرجاع مهامه غير المنجزة. عدد المهام: ${related.length}. هل تريد المتابعة؟`:`هل تريد حذف الموظف (${emp.name})؟`))return;
  const batch=fs.batch();
  related.forEach(t=>{const comments=t.comments||[];comments.push({id:uid(),text:"تم إرجاع المهمة إلى قائمة المهام بسبب حذف الموظف.",by:"المدير",role:"admin",date:todayISO()});batch.update(fs.collection("tasks").doc(t.id),{employeeId:"",assignedAt:"",status:t.status!=="done"?"open":t.status,comments})});
  db.users.filter(u=>u.employeeId===id).forEach(u=>batch.update(fs.collection("users").doc(u.id),{employeeId:""}));
  batch.delete(fs.collection("employees").doc(id));await batch.commit()
}
async function addTask(){
  if(!requireAdmin())return;
  const title=document.getElementById("taskTitle").value.trim(),desc=document.getElementById("taskDesc").value.trim(),dueDate=document.getElementById("taskDue").value,priority=document.getElementById("taskPriority").value,employeeId=document.getElementById("taskEmployee").value,createdBy=document.getElementById("createdBy").value.trim();
  if(!title){alert("يرجى كتابة عنوان المهمة");return} if(!dueDate){alert("يرجى تحديد موعد الانتهاء");return}
  await fs.collection("tasks").add({title,desc,createdAt:todayISO(),dueDate,priority,employeeId:employeeId||"",createdBy,assignedAt:employeeId?todayISO():"",startedAt:"",completedAt:"",status:"open",notes:"",comments:[],pendingEmployeeId:""});
  clearTaskForm();switchTab("tasks")
}
function clearTaskForm(){["taskTitle","taskDesc","taskDue","createdBy"].forEach(id=>document.getElementById(id).value="");document.getElementById("taskPriority").value="critical";document.getElementById("taskEmployee").value=""}
function setPendingEmployee(id,employeeId){const t=db.tasks.find(x=>x.id===id);if(t)t.pendingEmployeeId=employeeId}
function confirmEmployeeAssignment(id){if(!requireAdmin())return;const t=db.tasks.find(x=>x.id===id);if(!t)return;const sel=document.getElementById(`assign-${id}`);const employeeId=sel?sel.value:(t.pendingEmployeeId||"");if(!employeeId){alert("يرجى اختيار الموظف أولاً");return}if(confirm(`هل تريد تكليف هذه المهمة إلى ${employeeName(employeeId)}؟`))changeEmployee(id,employeeId)}
async function changeEmployee(id,employeeId){if(!requireAdmin())return;const t=db.tasks.find(x=>x.id===id);if(!t)return;const update={employeeId,assignedAt:todayISO(),pendingEmployeeId:""};if(t.status==="done"){update.status="open";update.completedAt=""}await fs.collection("tasks").doc(id).update(update)}
async function updateDueDate(id,dueDate){if(!isAdmin()){alert("تعديل موعد الانتهاء خاص بالمدير فقط");renderAll();return}await fs.collection("tasks").doc(id).update({dueDate})}
async function updateTaskStatus(id,status){const t=db.tasks.find(x=>x.id===id);if(!t)return;if(!isAdmin()&&t.employeeId!==currentUserData.employeeId){alert("لا يمكنك تعديل مهمة غير مخصصة لك");return}const update={status,completedAt:status==="done"?todayISO():""};if(status==="progress"&&!t.startedAt)update.startedAt=todayISO();await fs.collection("tasks").doc(id).update(update)}
async function updateTaskNote(id,notes){const t=db.tasks.find(x=>x.id===id);if(!t)return;if(!isAdmin()&&t.employeeId!==currentUserData.employeeId){alert("لا يمكنك تعديل ملاحظات مهمة غير مخصصة لك");return}await fs.collection("tasks").doc(id).update({notes})}
async function addTaskComment(id,inputId){const t=db.tasks.find(x=>x.id===id);if(!t)return;if(!isAdmin()&&t.employeeId!==currentUserData.employeeId){alert("لا يمكنك التعليق على مهمة غير مخصصة لك");return}const input=document.getElementById(inputId),text=(input?.value||"").trim();if(!text){alert("يرجى كتابة التعليق");return}const comments=t.comments||[];comments.push({id:uid(),text,by:isAdmin()?"المدير":employeeName(currentUserData.employeeId),role:isAdmin()?"admin":"employee",date:todayISO()});input.value="";await fs.collection("tasks").doc(id).update({comments})}
function renderComments(t,compact=false){const comments=t.comments||[];const list=comments.length?comments.map(c=>`<div style="border:1px solid #e5e7eb;border-radius:10px;padding:7px;margin:5px 0;background:#fafafa"><b>${escapeHTML(c.by||"-")}</b><span class="muted"> | ${formatDate(c.date)}</span><div>${escapeHTML(c.text||"")}</div></div>`).join(""):`<p class="muted">لا توجد تعليقات بعد.</p>`;const inputId=`comment-${t.id}-${compact?"c":"f"}`;return `<div>${list}${t.employeeId?`<textarea id="${inputId}" class="no-print" placeholder="اكتب تعليق بين المدير والموظف فقط"></textarea><button class="primary no-print" onclick="addTaskComment('${t.id}','${inputId}')">إضافة تعليق</button>`:`<span class="muted">تظهر التعليقات بعد تكليف المهمة لموظف.</span>`}</div>`}
async function returnTaskToOpen(id){const t=db.tasks.find(x=>x.id===id);if(!t)return;if(!isAdmin()&&t.employeeId!==currentUserData.employeeId){alert("لا يمكنك إرجاع مهمة غير مخصصة لك");return}if(t.status!=="done"){alert("المهمة غير منجزة حالياً");return}const reason=prompt("اكتب سبب إرجاع المهمة:");if(reason===null)return;const comments=t.comments||[];comments.push({id:uid(),text:reason.trim()?"تم إرجاع المهمة: "+reason.trim():"تم إرجاع المهمة إلى قائمة المهام",by:isAdmin()?"المدير":employeeName(currentUserData.employeeId),role:isAdmin()?"admin":"employee",date:todayISO()});await fs.collection("tasks").doc(id).update({status:"open",completedAt:"",comments})}
async function deleteTask(id){if(!requireAdmin())return;if(confirm("هل تريد حذف المهمة؟"))await fs.collection("tasks").doc(id).delete()}

function renderEmployeeSelect(){
  const taskSel=document.getElementById("taskEmployee"); if(taskSel)taskSel.innerHTML=`<option value="">بدون تكليف الآن</option>`+db.employees.map(e=>`<option value="${e.id}">${escapeHTML(e.name)}${e.role?" - "+escapeHTML(e.role):""}</option>`).join("");
  const winSel=document.getElementById("selectedEmployeeWindow"); if(winSel){if(isAdmin()){if(!selectedEmployeeWindowId&&db.employees.length){selectedEmployeeWindowId=db.employees[0].id;localStorage.setItem("task_manager_selected_employee",selectedEmployeeWindowId)}winSel.innerHTML=db.employees.length?db.employees.map(e=>`<option value="${e.id}" ${e.id===selectedEmployeeWindowId?"selected":""}>${escapeHTML(e.name)}${e.role?" - "+escapeHTML(e.role):""}</option>`).join(""):`<option value="">لا يوجد موظفون</option>`}else{winSel.innerHTML=`<option value="${currentUserData.employeeId}">${escapeHTML(employeeName(currentUserData.employeeId))}</option>`;winSel.value=currentUserData.employeeId}}
  const accountSel=document.getElementById("accountEmployee"); if(accountSel){const cur=accountSel.value||"";accountSel.innerHTML=`<option value="">اختر الموظف</option>`+db.employees.map(e=>`<option value="${e.id}">${escapeHTML(e.name)}${e.role?" - "+escapeHTML(e.role):""}</option>`).join("");accountSel.value=cur;toggleAccountEmployee()}
  const reportSel=document.getElementById("reportEmployee"); if(reportSel){const cur=reportSel.value||"all";reportSel.innerHTML=`<option value="all">جميع الموظفين</option>`+db.employees.map(e=>`<option value="${e.id}">${escapeHTML(e.name)}${e.role?" - "+escapeHTML(e.role):""}</option>`).join("");reportSel.value=cur}
}
function taskRow(t){const empOptions=db.employees.map(e=>`<option value="${e.id}" ${e.id===t.employeeId?"selected":""}>${escapeHTML(e.name)}</option>`).join("");const adminSummary=`<details><summary class="task-summary-line"><span>${escapeHTML(t.title||"-")}</span><span>▼</span></summary><div class="task-details-box"><b>التفاصيل:</b> ${escapeHTML(t.desc||"-")}<br><b>الموظف:</b> ${escapeHTML(employeeName(t.employeeId))}<br><b>تاريخ الإدخال:</b> ${formatDate(t.createdAt)}<br><b>تاريخ التكليف:</b> ${formatDate(t.assignedAt)}<br><b>موعد الانتهاء:</b> ${formatDate(t.dueDate)}<br><b>بدء العمل:</b> ${formatDate(t.startedAt)}<br><b>تاريخ الإنجاز:</b> ${formatDate(t.completedAt)}</div></details>`;return `<tr><td>${isAdmin()?adminSummary:`<b>${escapeHTML(t.title||"-")}</b><br><span class="muted">${escapeHTML(t.desc||"")}</span>`}</td><td>${escapeHTML(employeeName(t.employeeId))}</td><td>${formatDate(t.createdAt)}</td><td>${formatDate(t.assignedAt)}</td><td><input type="date" value="${t.dueDate||""}" ${isAdmin()?"":"disabled"} onchange="updateDueDate('${t.id}', this.value)" /></td><td><span class="badge ${priorityClass[t.priority]||"p-normal"}">${priorityText[t.priority]||"-"}</span></td><td><span class="badge ${statusClass[t.status]||"status-open"}">${statusText[t.status]||"-"}</span></td><td>${formatDate(t.startedAt)}</td><td>${formatDate(t.completedAt)}</td><td>${renderComments(t)}</td><td><textarea onchange="updateTaskNote('${t.id}', this.value)" placeholder="ملاحظات">${escapeHTML(t.notes||"")}</textarea></td><td class="no-print">${isAdmin()?`<select id="assign-${t.id}" onchange="setPendingEmployee('${t.id}', this.value)"><option value="">اختر الموظف</option>${empOptions}</select><button class="primary" onclick="confirmEmployeeAssignment('${t.id}')">موافق</button>`:""}<div class="btns">${t.employeeId?`<button onclick="updateTaskStatus('${t.id}','open')">مفتوحة</button><button class="warn" onclick="updateTaskStatus('${t.id}','progress')">قيد العمل</button><button class="ok" onclick="updateTaskStatus('${t.id}','done')">إنجاز</button>`:""}${t.status==="done"?`<button class="light" onclick="returnTaskToOpen('${t.id}')">إرجاع المهمة</button>`:""}${isAdmin()?`<button class="danger" onclick="deleteTask('${t.id}')">حذف</button>`:""}</div></td></tr>`}
function renderTasks(){const table=document.getElementById("tasksTable");if(!table)return;const q=(document.getElementById("taskSearch")?.value||"").trim().toLowerCase();let tasks=db.tasks.filter(t=>!t.employeeId);tasks.sort((a,b)=>(({critical:1,important:2,normal:3,later:4}[a.priority]||9)-({critical:1,important:2,normal:3,later:4}[b.priority]||9))||String(a.dueDate||"").localeCompare(String(b.dueDate||"")));if(q)tasks=tasks.filter(t=>String(t.title||"").toLowerCase().includes(q)||String(t.desc||"").toLowerCase().includes(q));const title=document.getElementById("taskListTitle");if(title)title.textContent="المهام غير المكلّفة";table.innerHTML=`<table><thead><tr><th>المهمة</th><th>الموظف</th><th>تاريخ الإدخال</th><th>تاريخ التكليف</th><th>موعد الانتهاء</th><th>الأولوية</th><th>الحالة</th><th>بدء العمل</th><th>تاريخ الإنجاز</th><th>تعليقات المدير والموظف</th><th>ملاحظات</th><th class="no-print">إجراءات</th></tr></thead><tbody>${tasks.length?tasks.map(t=>taskRow(t)).join(""):`<tr><td colspan="12">لا توجد مهام غير مكلّفة</td></tr>`}</tbody></table>`}

function setSelectedEmployeeWindow(id){selectedEmployeeWindowId=id;localStorage.setItem("task_manager_selected_employee",id||"");renderAll()}
function employeePerformanceData(employeeId){const tasks=db.tasks.filter(t=>t.employeeId===employeeId);return{total:tasks.length,open:tasks.filter(t=>t.status==="open").length,progress:tasks.filter(t=>t.status==="progress").length,done:tasks.filter(t=>t.status==="done").length,critical:tasks.filter(t=>t.priority==="critical"&&t.status!=="done").length}}
function performanceBar(label,value,total){const pct=total?Math.round((value/total)*100):0;return `<div class="chart-row"><div>${label}</div><div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div><div>${value}</div></div>`}
function renderEmployeePerformance(employeeId){if(!isAdmin())return "";const d=employeePerformanceData(employeeId);const total=Math.max(d.total,1);return `<div class="done-count-card admin-only"><div><b>المهام المنجزة</b><div class="muted">تظهر للمدير فقط</div></div><div class="num">${d.done}</div></div><div class="performance-box admin-only"><h3>رسم بياني لأداء الموظف</h3><div class="mini-chart">${performanceBar("مفتوحة",d.open,total)}${performanceBar("قيد العمل",d.progress,total)}${performanceBar("منجزة",d.done,total)}${performanceBar("حرجة غير منجزة",d.critical,total)}</div><p class="muted">إجمالي المهام المرتبطة بهذا الموظف: ${d.total}</p></div>`}
function toggleDoneTasks(areaId){const section=document.getElementById(areaId);if(!section)return;const shown=section.classList.toggle("show");const btn=document.getElementById(`btn-${areaId}`);if(btn)btn.textContent=shown?"إخفاء المهام المنجزة":"إظهار المهام المنجزة"}
function renderEmployees(){const box=document.getElementById("employeeWindows");if(!box)return;let employees=[];if(isAdmin()){if(!selectedEmployeeWindowId&&db.employees.length){selectedEmployeeWindowId=db.employees[0].id;localStorage.setItem("task_manager_selected_employee",selectedEmployeeWindowId)}employees=selectedEmployeeWindowId?db.employees.filter(e=>e.id===selectedEmployeeWindowId):[]}else{selectedEmployeeWindowId=currentUserData.employeeId;employees=db.employees.filter(e=>e.id===currentUserData.employeeId)}if(!employees.length){box.innerHTML=isAdmin()?"<p>لا يوجد موظفون حالياً. أضف موظفاً أولاً.</p>":"<p>لا توجد نافذة موظف مرتبطة بهذا الحساب.</p>";return}box.innerHTML=employees.map(e=>{const active=db.tasks.filter(t=>t.employeeId===e.id&&t.status!=="done");const done=db.tasks.filter(t=>t.employeeId===e.id&&t.status==="done");const areaId=`emp-print-${e.id}`,doneAreaId=`done-tasks-${e.id}`;return `<div class="card print-area employee-print" id="${areaId}" style="margin-bottom:16px"><h2 class="print-title">تقرير الموظف: ${escapeHTML(e.name)}</h2><div class="toolbar"><div><h2>${escapeHTML(e.name)}</h2><p class="muted">${escapeHTML(e.role||"-")} | تاريخ الإضافة: ${formatDate(e.createdAt)}</p></div><div class="btns no-print"><button onclick="printEmployee('${areaId}')">طباعة نافذة الموظف</button>${isAdmin()?`<button class="danger" onclick="deleteEmployee('${e.id}')">حذف الموظف</button>`:""}</div></div>${renderEmployeePerformance(e.id)}<h3>المهام الحالية / قيد العمل</h3><table><thead><tr><th>المهمة</th><th>تاريخ الإدخال</th><th>تاريخ التكليف</th><th>موعد الانتهاء</th><th>الأولوية</th><th>الحالة</th><th>بدء العمل</th><th>تعليقات المدير والموظف</th><th>ملاحظات</th><th class="no-print">إجراءات</th></tr></thead><tbody>${active.length?active.map(t=>`<tr><td><b>${escapeHTML(t.title)}</b><br><span class="muted">${escapeHTML(t.desc||"")}</span></td><td>${formatDate(t.createdAt)}</td><td>${formatDate(t.assignedAt)}</td><td><input type="date" value="${t.dueDate||""}" ${isAdmin()?"":"disabled"} onchange="updateDueDate('${t.id}', this.value)" /></td><td><span class="badge ${priorityClass[t.priority]}">${priorityText[t.priority]}</span></td><td><span class="badge ${statusClass[t.status]}">${statusText[t.status]}</span></td><td>${formatDate(t.startedAt)}</td><td>${renderComments(t,true)}</td><td><textarea onchange="updateTaskNote('${t.id}', this.value)">${escapeHTML(t.notes||"")}</textarea></td><td class="no-print"><div class="btns"><button onclick="updateTaskStatus('${t.id}','open')">مفتوحة</button><button class="warn" onclick="updateTaskStatus('${t.id}','progress')">قيد العمل</button><button class="ok" onclick="updateTaskStatus('${t.id}','done')">تم الإنجاز</button></div></td></tr>`).join(""):`<tr><td colspan="10">لا توجد مهام حالية</td></tr>`}</tbody></table><div class="btns no-print" style="margin-top:14px"><button class="primary" id="btn-${doneAreaId}" onclick="toggleDoneTasks('${doneAreaId}')">إظهار المهام المنجزة</button></div><div id="${doneAreaId}" class="done-section"><h3>المهام المنجزة سابقاً</h3><table><thead><tr><th>المهمة</th><th>تاريخ الإدخال</th><th>تاريخ التكليف</th><th>موعد الانتهاء</th><th>تاريخ الإنجاز</th><th>الأولوية</th><th>تعليقات المدير والموظف</th><th>ملاحظات</th><th class="no-print">إجراء</th></tr></thead><tbody>${done.length?done.map(t=>`<tr><td><b>${escapeHTML(t.title)}</b><br><span class="muted">${escapeHTML(t.desc||"")}</span></td><td>${formatDate(t.createdAt)}</td><td>${formatDate(t.assignedAt)}</td><td>${formatDate(t.dueDate)}</td><td>${formatDate(t.completedAt)}</td><td><span class="badge ${priorityClass[t.priority]}">${priorityText[t.priority]}</span></td><td>${renderComments(t,true)}</td><td>${escapeHTML(t.notes||"")}</td><td class="no-print"><button class="light" onclick="returnTaskToOpen('${t.id}')">إرجاع المهمة</button></td></tr>`).join(""):`<tr><td colspan="9">لا توجد مهام منجزة</td></tr>`}</tbody></table></div></div>`}).join("")}

function renderStats(){const box=document.getElementById("topStats");if(!box||!currentUserData)return;const visible=isAdmin()?db.tasks:db.tasks.filter(t=>t.employeeId===currentUserData.employeeId);const cards=isAdmin()?[["الموظفون",db.employees.length],["جميع المهام",visible.length],["غير مكلّفة",visible.filter(t=>!t.employeeId&&t.status!=="done").length],["قيد العمل",visible.filter(t=>t.status==="progress").length],["منجزة",visible.filter(t=>t.status==="done").length],["حرجة غير منجزة",visible.filter(t=>t.priority==="critical"&&t.status!=="done").length]]:[["مهامي",visible.length],["مفتوحة",visible.filter(t=>t.status==="open").length],["قيد العمل",visible.filter(t=>t.status==="progress").length],["منجزة",visible.filter(t=>t.status==="done").length],["حرجة",visible.filter(t=>t.priority==="critical"&&t.status!=="done").length]];box.innerHTML=cards.map(([l,n])=>`<div class="stat-card"><div class="num">${n}</div><div class="label">${l}</div></div>`).join("")}

async function addAccount(){if(!requireAdmin())return;const email=document.getElementById("accountUsername").value.trim(),password=document.getElementById("accountPassword").value,role=document.getElementById("accountRole").value,employeeId=document.getElementById("accountEmployee").value;if(!email||!password){alert("يرجى كتابة البريد الإلكتروني وكلمة المرور");return}if(role==="employee"&&!employeeId){alert("يرجى ربط حساب الموظف باسم موظف");return}try{const secondaryName="secondary-"+Date.now();const secondaryApp=firebase.initializeApp(firebaseConfig,secondaryName);const secondaryAuth=secondaryApp.auth();const cred=await secondaryAuth.createUserWithEmailAndPassword(email,password);await fs.collection("users").doc(cred.user.uid).set({email,username:email,role,employeeId:role==="admin"?"":employeeId,createdAt:todayISO()});await secondaryAuth.signOut();await secondaryApp.delete();document.getElementById("accountUsername").value="";document.getElementById("accountPassword").value="";alert("تمت إضافة الحساب")}catch(e){alert("فشل إنشاء الحساب: "+e.message)}}
async function deleteAccount(id){if(!requireAdmin())return;const user=db.users.find(u=>u.id===id);if(user&&user.role==="admin"&&db.users.filter(u=>u.role==="admin").length<=1){alert("لا يمكن حذف آخر حساب مدير");return}if(confirm("سيتم حذف صلاحية الحساب من البرنامج فقط. حذف حساب Authentication يتم من Firebase Console. هل تريد المتابعة؟"))await fs.collection("users").doc(id).delete()}
function changePassword(){alert("تغيير كلمة مرور Firebase يتم من Firebase Console > Authentication > Users.")}
function toggleAccountEmployee(){const role=document.getElementById("accountRole")?.value;const empSel=document.getElementById("accountEmployee");if(empSel)empSel.disabled=role==="admin"}
function renderAccounts(){const box=document.getElementById("accountsTable");if(!box)return;if(!isAdmin()){box.innerHTML="";return}box.innerHTML=`<table><thead><tr><th>البريد الإلكتروني</th><th>نوع الحساب</th><th>الموظف المرتبط</th><th class="no-print">إجراءات</th></tr></thead><tbody>${db.users.length?db.users.map(u=>`<tr><td><b>${escapeHTML(u.email||u.username)}</b></td><td>${u.role==="admin"?"مدير":"موظف"}</td><td>${u.role==="employee"?escapeHTML(employeeName(u.employeeId)):"-"}</td><td class="no-print"><button onclick="changePassword('${u.id}')">ملاحظة كلمة المرور</button><button class="danger" onclick="deleteAccount('${u.id}')">حذف الصلاحية</button></td></tr>`).join(""):`<tr><td colspan="4">لا توجد حسابات</td></tr>`}</tbody></table>`}

/* Printing/reports utilities */
function setPeriodDates(){const type=document.getElementById("periodType").value;const now=new Date();let start=new Date(now),end=new Date(now);if(type==="weekly"){const day=now.getDay(),diff=(day+1)%7;start.setDate(now.getDate()-diff);end=new Date(start);end.setDate(start.getDate()+6)}else if(type==="monthly"){start=new Date(now.getFullYear(),now.getMonth(),1);end=new Date(now.getFullYear(),now.getMonth()+1,0)}else if(type!=="daily")return;document.getElementById("periodStart").value=dateToISO(start);document.getElementById("periodEnd").value=dateToISO(end)}
function dateToISO(d){const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,10)}
function getPeriodTasks(){const start=document.getElementById("periodStart").value,end=document.getElementById("periodEnd").value,field=document.getElementById("dateField").value,emp=document.getElementById("reportEmployee").value,status=document.getElementById("reportStatus").value;if(!start||!end){alert("يرجى تحديد تاريخ البداية والنهاية");return null}return db.tasks.filter(t=>t[field]&&t[field]>=start&&t[field]<=end&&(emp==="all"||t.employeeId===emp)&&(status==="all"||t.status===status))}
function periodLabel(){return{daily:"يومي",weekly:"أسبوعي",monthly:"شهري",custom:"فترة مخصصة"}[document.getElementById("periodType").value]||""}
function dateFieldLabel(){return{createdAt:"تاريخ إدخال المهمة",assignedAt:"تاريخ التكليف",dueDate:"موعد الانتهاء",completedAt:"تاريخ الإنجاز"}[document.getElementById("dateField").value]||""}
function buildPeriodReportHTML(){const tasks=getPeriodTasks();if(tasks===null)return"";const start=document.getElementById("periodStart").value,end=document.getElementById("periodEnd").value,field=document.getElementById("dateField").value,emp=document.getElementById("reportEmployee").value,status=document.getElementById("reportStatus").value,empName=emp==="all"?"جميع الموظفين":employeeName(emp),statusName=status==="all"?"جميع الحالات":statusText[status];return`<div class="card print-area" id="periodReportPrint"><h2 style="text-align:center">تقرير مهام ${periodLabel()}</h2><table><tr><th>الفترة</th><td>من ${start} إلى ${end}</td></tr><tr><th>التقرير حسب</th><td>${dateFieldLabel()}</td></tr><tr><th>الموظف</th><td>${escapeHTML(empName)}</td></tr><tr><th>الحالة</th><td>${statusName}</td></tr><tr><th>عدد المهام</th><td>${tasks.length}</td></tr></table><table><thead><tr><th>المهمة</th><th>الموظف</th><th>${dateFieldLabel()}</th><th>تاريخ الإدخال</th><th>تاريخ التكليف</th><th>موعد الانتهاء</th><th>الأولوية</th><th>الحالة</th><th>تاريخ الإنجاز</th><th>تعليقات المدير والموظف</th><th>ملاحظات</th></tr></thead><tbody>${tasks.length?tasks.map(t=>`<tr><td><b>${escapeHTML(t.title)}</b><br><span class="muted">${escapeHTML(t.desc||"")}</span></td><td>${escapeHTML(employeeName(t.employeeId))}</td><td>${formatDate(t[field])}</td><td>${formatDate(t.createdAt)}</td><td>${formatDate(t.assignedAt)}</td><td>${formatDate(t.dueDate)}</td><td><span class="badge ${priorityClass[t.priority]}">${priorityText[t.priority]}</span></td><td><span class="badge ${statusClass[t.status]}">${statusText[t.status]}</span></td><td>${formatDate(t.completedAt)}</td><td>${(t.comments||[]).map(c=>`${escapeHTML(c.by||"-")} (${formatDate(c.date)}): ${escapeHTML(c.text||"")}`).join("<br>")||"-"}</td><td>${escapeHTML(t.notes||"")}</td></tr>`).join(""):`<tr><td colspan="11">لا توجد مهام ضمن هذه الفترة</td></tr>`}</tbody></table></div>`}
function previewPeriodReport(){const el=document.getElementById("periodPreview");if(el)el.innerHTML=buildPeriodReportHTML()}
function printPeriodReport(){const reportHTML=buildPeriodReportHTML();if(!reportHTML)return;const w=window.open("","_blank");w.document.write(`<html lang="ar" dir="rtl"><head><title>طباعة تقرير الفترة</title><style>body{font-family:Tahoma,Arial,sans-serif;line-height:1.6;color:#111}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:8px;text-align:right;vertical-align:top;font-size:13px}th{background:#eee}.badge{border:1px solid #777;padding:2px 6px;border-radius:10px}.muted{color:#555}</style></head><body>${reportHTML}</body></html>`);w.document.close();w.focus();w.print()}
function printSection(sectionId){document.querySelectorAll(".section").forEach(s=>s.classList.remove("print-me"));const section=document.getElementById(sectionId);if(section){section.classList.add("print-me");window.print()}}
function printEmployee(areaId){const el=document.getElementById(areaId);if(!el)return;const w=window.open("","_blank");w.document.write(`<html lang="ar" dir="rtl"><head><title>طباعة تقرير موظف</title><style>body{font-family:Tahoma,Arial,sans-serif;line-height:1.6;color:#111}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:8px;text-align:right;vertical-align:top;font-size:13px}th{background:#eee}button,input,select,textarea,.no-print{display:none!important}.card{border:0}.print-title{display:block;text-align:center;font-size:20px}.badge{border:1px solid #777;padding:2px 6px;border-radius:10px}.muted{color:#555}</style></head><body>${el.outerHTML}</body></html>`);w.document.close();w.focus();w.print()}
function printAll(){document.querySelectorAll(".section").forEach(s=>s.classList.add("print-me"));window.print();setTimeout(()=>document.querySelectorAll(".section").forEach(s=>s.classList.remove("print-me")),500)}
function exportJSON(){const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="amwaj-engineering-task-manager-backup.json";a.click();URL.revokeObjectURL(a.href)}
function importJSON(){alert("بعد ربط Firebase، الاسترجاع من JSON غير مفعل لتجنب تعارض البيانات.")}
async function resetAll(){if(!requireAdmin())return;const code=prompt("للموافقة على مسح جميع البيانات، أدخل رمز التأكيد:");if(code===null)return;if(code!=="r.h_1712"){alert("رمز التأكيد غير صحيح. لم يتم مسح البيانات.");return}if(!confirm("سيتم مسح الموظفين والمهام وصلاحيات الحسابات من Firestore. حسابات Authentication يجب حذفها من Firebase Console إذا رغبت. هل أنت متأكد؟"))return;const batch=fs.batch();db.tasks.forEach(t=>batch.delete(fs.collection("tasks").doc(t.id)));db.employees.forEach(e=>batch.delete(fs.collection("employees").doc(e.id)));db.users.forEach(u=>{if(u.id!==currentAuthUser.uid)batch.delete(fs.collection("users").doc(u.id))});await batch.commit();selectedEmployeeWindowId="";localStorage.setItem("task_manager_selected_employee","");alert("تم مسح البيانات من Firestore.")}
function renderAll(){if(!currentUserData)return;renderEmployeeSelect();renderStats();renderTasks();renderEmployees();renderAccounts();document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()))}


// PWA install support
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn1 = document.getElementById("installAppBtn");
  const btn2 = document.getElementById("installAppBtnLogin");
  if(btn1) btn1.style.display = "inline-block";
  if(btn2) btn2.style.display = "inline-block";
});

async function installApp(){
  if(!deferredInstallPrompt){
    alert("إذا لم يظهر زر التنزيل، افتح الموقع من Chrome أو Edge ثم اختر Install app / Add to Home Screen من قائمة المتصفح.");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  const btn1 = document.getElementById("installAppBtn");
  const btn2 = document.getElementById("installAppBtnLogin");
  if(btn1) btn1.style.display = "none";
  if(btn2) btn2.style.display = "none";
}

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
