'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const pages = {dashboard:'Поездка',analysis:'Сигналы',profiles:'Личный профиль',places:'Места отдыха',protocol:'Проверка'};
  const names = {steady:'Спокойная поездка',flatPulse:'Меньше движения, пульс не падает',risingPulse:'Движение и рост пульса',road:'Общая дорожная вибрация',signalLoss:'Пропуски движения',quiet:'Спокойное бодрствование',active:'Активность',calibration:'Новый личный профиль'};
  const roadNames = {unavailable:'Дорожная вибрация не отделена',unreliable:'Сопоставление ненадёжно',sharedVibration:'Возможна общая вибрация',tentativelyDistinct:'Разделение предварительное'};
  const activityNames = {quiet:'Спокойное бодрствование',active:'Активность',trip:'Поездка'};
  const params = new URLSearchParams(location.search);
  if (!window.DRIVEGUARD_REPLAYS || !window.DriveGuardSession) {
    $('main').innerHTML='<div class="panel"><h1>Не удалось открыть демо</h1><p>Загрузите полный комплект файлов и обновите страницу. Кнопка «Сайт» вверху вернёт вас на главную.</p></div>';
    return;
  }
  const store = window.DriveGuardSession;
  const places = [
    {name:'Кафе «Пауза»',distance:'1,2 км · 3 мин',description:'Столик, вода и место для короткого перерыва.',type:'cafe'},
    {name:'Парковка «Тихий маршрут»',distance:'2,4 км · 5 мин',description:'Учебный пример стоянки для грузового автомобиля.',type:'parking'},
    {name:'Мотель «Новый день»',distance:'4,8 км · 9 мин',description:'Пример места для сна и длительного отдыха.',type:'sleep'}
  ];
  const state = {scenario:Object.hasOwn(names,params.get('scenario')) ? params.get('scenario') : 'steady',context:['rested','shortSleep','unknown'].includes(params.get('context')) ? params.get('context') : 'rested',second:0,trip:'idle',speed:30,events:[],seen:new Set(),sessionID:'',selectedPlace:null,pendingRest:null,automaticAlerts:0,selfReports:0};
  let restored = null;
  try { restored = store.restore(localStorage.getItem(store.key)); } catch {}
  if (restored && !params.has('scenario') && !params.has('context')) Object.assign(state,restored);
  else restored = null;
  let storageActive = Boolean(restored), lastSave = 0, storageWarning = false;
  const replay = () => window.DRIVEGUARD_REPLAYS[state.scenario+'-'+state.context];
  const point = () => replay().points.filter(p => p.second <= state.second).at(-1) || replay().points[0];
  const clock = t => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  const numeric = x => Number.isFinite(x) ? String(Math.round(x)) : '—';
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let toastTimer, lastTick = performance.now();
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(()=>{$('toast').hidden=true;},4000); }
  function persist(force=false) {
    if (!storageActive || (!force && performance.now()-lastSave < 1000)) return;
    lastSave=performance.now();
    try { localStorage.setItem(store.key,store.serialize(state)); }
    catch { if (!storageWarning) { storageWarning=true; toast('Браузер не разрешает сохранение. Демо работает до закрытия страницы.'); } }
  }
  function freshSession() {
    state.second=0; state.events=[]; state.seen.clear(); state.selectedPlace=null; state.pendingRest=null;
    state.automaticAlerts=0; state.selfReports=0;
    state.sessionID=globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storageActive=true; $('restoreNotice').hidden=true;
  }
  function beginTrip(guided=false) {
    if (guided) { state.scenario='flatPulse'; state.context='shortSleep'; }
    freshSession(); state.trip='running'; state.speed=30; $('speed').value='30'; lastTick=performance.now();
    $('startDialog').close(); event('start',`Начата демо-поездка: ${names[state.scenario]}`);
    location.hash='dashboard'; render();
  }
  function finishTrip(atStop=false) {
    state.trip='finished'; state.pendingRest=null;
    event(atStop?'stopped':'finish',atStop?'Подтверждена остановка в учебном сценарии':'Демо-поездка завершена');
    $('finishDialog').close(); location.hash='dashboard'; render();
    $('main').scrollTo({top:0,behavior:'instant'});
  }
  function event(type,message) {
    storageActive=true;
    if(type==='forecastPrompt')state.automaticAlerts++;
    if(type==='selfReport')state.selfReports++;
    state.events.push({type,message,second:Math.round(state.second),at:new Date().toISOString(),scenario:state.scenario,context:state.context,synthetic:true});
    state.events = state.events.slice(-150); renderEvents(); persist(true);
  }
  function renderEvents() {
    $('eventLog').innerHTML = state.events.length ? state.events.slice().reverse().map(e=>`<li><time>${clock(e.second)} · УЧЕБНАЯ ЗАПИСЬ</time>${escape(e.message)}</li>`).join('') : '<li>Событий пока нет.</li>';
  }
  function route() {
    const candidate = location.hash.slice(1), page = Object.hasOwn(pages,candidate) ? candidate : 'dashboard';
    document.querySelectorAll('.page').forEach(section => {section.hidden = section.id !== page;});
    document.querySelectorAll('[data-page]').forEach(a => {const selected=a.dataset.page===page;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    $('main').scrollTo({top:0,behavior:'instant'});
    document.title = `ДрайвГард — ${pages[page]}`;
  }
  function chart() {
    if (state.trip === 'idle') return '<div class="empty-state">История появится после начала демо-поездки</div>';
    const visible = replay().points.filter(p => p.second <= state.second), width=600,height=125;
    const path=visible.map((p,i)=>`${i?'L':'M'}${(p.second/900*width).toFixed(1)},${(height-15-(p.bpm-40)/80*(height-25)).toFixed(1)}`).join(' ');
    const last=visible.at(-1),x=last ? last.second/900*width : 0,y=last ? height-15-(last.bpm-40)/80*(height-25) : 0;
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20H600M0 65H600M0 110H600" stroke="#ece6df" stroke-width="1" stroke-dasharray="3 5"/><path d="${path}" fill="none" stroke="#817163" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${x}" cy="${y}" r="3" fill="#5b4f46"/></svg>`;
  }
  function renderProfiles() {
    const current=replay(),profiles=current.profiles.filter(p=>p.createdAt<=current.start+state.second);
    $('profileCards').innerHTML = ['quiet','active','trip'].map((mode,i)=>{
      const p=profiles.find(p=>p.activity===mode);
      return `<article class="metric-card profile-card ${current.context.activity===mode || (!current.context.activity && mode==='trip') ? 'selected' : ''}"><span class="eyebrow">0${i+1} / УЧЕБНЫЙ ПРОФИЛЬ</span><h2>${activityNames[mode]}</h2><div class="metric-value"><strong>${p?numeric(p.heartRate):'—'}</strong><span>уд/мин</span></div><span class="small-pill">${p?'Фиксирован · не обновляется':'Ещё не собран'}</span><p>${p?`Ускорение ${p.acceleration.toFixed(3)} g<br>Вращение ${p.rotation.toFixed(3)} рад/с`:'Нужно явное подтверждение и стабильный пятиминутный отрезок.'}</p></article>`;
    }).join('');
    const context=current.context,hoursAwake=Number.isFinite(context.hoursAwake) ? context.hoursAwake+(context.awakeEnteredAt ? state.second/3600 : 0) : null;
    $('sleepContext').innerHTML = [['Сон за 24 часа',Number.isFinite(context.sleptHours)?`${context.sleptHours} ч`:'Неизвестен'],['Бодрствование',hoursAwake!==null?`${hoursAwake.toFixed(1)} ч · учебное`:'Неизвестно'],['Биологическая ночь',context.biologicalNight?'Указана':'Не указана'],['Источник','Учебный контекст']].map(([k,v])=>`<div class="profile-data"><span>${k}</span><strong>${v}</strong></div>`).join('');
  }
  function render() {
    const p=point(),r=p.result,d=r.risk||{},idle=state.trip==='idle',prompted=!idle&&['elevatedPattern','risingPattern','selfReportedSleepiness'].includes(r.state);
    $('tripClock').textContent=clock(state.second);$('timeline').value=Math.floor(state.second/10)*10;
    $('tripState').textContent=state.trip==='running'?'В ПУТИ':state.trip==='paused'?'НА ПАУЗЕ':state.trip==='finished'?'ПОЕЗДКА ЗАВЕРШЕНА':'ГОТОВЫ К ПОЕЗДКЕ';
    $('tripToggle').textContent=state.trip==='running'?'Приостановить':state.trip==='paused'?'Продолжить':state.trip==='finished'?'Новая демо-поездка':'Начать демо-поездку';$('tripFinish').hidden=idle||state.trip==='finished';
    $('heroTitle').textContent=idle?'Пора в путь.':state.trip==='finished'?'Поездка завершена.':prompted?'Запланируйте остановку.':r.state==='unavailable'?'Данных недостаточно.':state.scenario==='calibration'&&r.state==='calibrating'?'Собираем личный профиль.':'Поездка идёт.';
    $('heroDescription').textContent=idle?'Начните поездку. Мы напомним о перерыве.':state.trip==='finished'?'Вы выбрали время для отдыха.':r.reason;
    $('priorValue').textContent=numeric(d.prior);$('changeValue').textContent=idle?'—':numeric(d.change);$('qualityValue').textContent=idle?'—':numeric(d.quality*100);
    for(const [id,v] of [['priorMeter',d.prior],['changeMeter',idle?null:d.change],['qualityMeter',idle?null:d.quality*100]]) {$(id).style.width=`${Number.isFinite(v)?v:0}%`;$(id).classList.toggle('elevated',id!=='qualityMeter'&&v>=45);}
    $('priorDescription').textContent=Number.isFinite(d.prior)?`Контекст заполнен на ${numeric(d.contextCompleteness*100)}%. Пробелы не означают полноценный отдых.`:'Сон и бодрствование неизвестны. Отсутствие записей не считается недосыпом.';
    $('changeDescription').textContent=idle?'Сравнение с фиксированным личным профилем.':d.change==null?'Ещё нет полного окна 2 минут. История собирается.':'Сочетание динамики движения и ЧСС. Падение пульса не обязательно.';
    $('qualityDescription').textContent=idle?'Свежесть, пропуски и возможные дорожные помехи.':`${roadNames[d.roadStatus]||'Нет данных'}. Полнота окна: ${numeric(p.coverage*100)}%.`;
    $('riskCaption').textContent = d.prior == null ? 'История сна неизвестна. Пробелы не означают полноценный отдых.' : 'Баллы правил — не вероятность сна. Полнота окна не равна точности.';
    $('scenarioLabel').textContent=names[state.scenario];$('windowCount').textContent=idle?'Ожидание':`${d.windows?.length||0} / 3 окна`;
    $('recommendTitle').textContent=prompted?'Запланируйте безопасную остановку.':(d.prior||0)>=45?'Обратите внимание на недосып.':'Проверьте себя перед поездкой.';
    $('recommendText').textContent=prompted?'Устойчивые изменения в учебной записи. Это не вероятность будущего сна. При сонливости не ждите следующих сигналов.':'Оценка не подтверждает бодрствование. Если уже клонит в сон, нужен отдых — ждать сигнала не стоит.';
    document.querySelector('.recommendation').classList.toggle('alerted',prompted);
    const graph=chart();$('miniChart').innerHTML=graph;$('fullChart').innerHTML=graph;
    $('analysisTime').textContent=clock(state.second);$('roadTitle').textContent=roadNames[d.roadStatus]||'Дорожная вибрация не отделена';$('motionConfidence').textContent=idle?'—':`${numeric(d.motionConfidence*100)} / 100`;
    $('roadDescription').textContent=d.roadStatus==='sharedVibration'?'У часов и закреплённого телефона сходный рисунок ускорений. Доверие к движению снижено. Разделение дорожной вибрации и руки не доказано.':'Опорный канал может отсутствовать, устареть или не совпасть по времени. Даже слабая корреляция не доказывает независимость движения руки.';
    $('windowsBody').innerHTML=[30,120,300].map(seconds=>{const w=idle?null:d.windows?.find(w=>w.seconds===seconds);return `<tr><td>${seconds===30?'30 секунд':seconds===120?'2 минуты':'5 минут'}</td><td>${w?w.pulseMedian.toFixed(0)+' уд/мин':'—'}</td><td>${w?(w.pulseSlopePerMinute>=0?'+':'')+w.pulseSlopePerMinute.toFixed(1)+' уд/мин²':'—'}</td><td>${w&&d.motionConfidence>0?numeric(w.motionChange*100)+' / 100':'Неизвестно'}</td><td>${w&&Number.isFinite(w.motionSlopePerMinute)?(w.motionSlopePerMinute>=0?'+':'')+w.motionSlopePerMinute.toFixed(2)+' профиля/мин':'—'}</td><td>${w?'Готово':'Собирается'}</td></tr>`;}).join('');
    renderProfiles();
    const finished=state.trip==='finished', summary=store.summary(state);
    $('tripSummary').hidden=!finished;
    $('restoreNotice').querySelector('p').textContent=finished?'Итог поездки сохранён на этом устройстве. Можно открыть журнал или начать заново.':'Демо сохранено на этом устройстве. Продолжите с паузы или начните заново.';
    $('summaryStats').innerHTML=`<div><strong>${clock(summary.seconds)}</strong><span>Момент записи</span></div><div><strong>${summary.automaticAlerts}</strong><span>Предупреждений</span></div><div><strong>${summary.selfReports}</strong><span>Отметок об отдыхе</span></div>`;
    $('summaryPlace').textContent=state.selectedPlace===null?'Место отдыха не выбрано.':`Выбранное место: ${places[state.selectedPlace].name}`;
    $('selectedStop').hidden=state.selectedPlace===null || finished;
    $('selectedStopName').textContent=state.selectedPlace===null?'':places[state.selectedPlace].name;
    $('journeyTrip').classList.toggle('current',!finished&&state.selectedPlace===null);
    $('journeyRest').classList.toggle('current',!finished&&state.selectedPlace!==null);
    $('journeyDone').classList.toggle('current',finished);
    for(const id of ['timeline','stepBack','stepForward','speed']) $(id).disabled=finished;
    document.querySelector('.recommendation').hidden=finished;
    document.querySelectorAll('[data-place]').forEach(b=>{b.textContent=Number(b.dataset.place)===state.selectedPlace?'Место выбрано':'Выбрать остановку';b.setAttribute('aria-pressed',String(Number(b.dataset.place)===state.selectedPlace));});
    persist();
  }
  function positionPhoneUI() {
    const rect=$('phoneScreen').getBoundingClientRect();
    const style=document.documentElement.style;
    style.setProperty('--phone-center',`${rect.left+rect.width/2}px`);
    style.setProperty('--phone-top',`${rect.top}px`);
    style.setProperty('--phone-bottom',`${innerHeight-rect.bottom}px`);
    style.setProperty('--phone-left',`${rect.left}px`);
    style.setProperty('--phone-right',`${innerWidth-rect.right}px`);
    style.setProperty('--phone-width',`${rect.width}px`);
    style.setProperty('--phone-height',`${rect.height}px`);
  }
  window.addEventListener('resize',positionPhoneUI);
  if ('ResizeObserver' in window) new ResizeObserver(positionPhoneUI).observe($('phoneScreen'));
  positionPhoneUI();
  function openLab() {if(state.trip==='running'){state.trip='paused';event('pause','Пауза для выбора сценария');render();}positionPhoneUI();$('scenarioSelect').value=state.scenario;$('contextSelect').value=state.context;$('labDialog').showModal();}
  function showRest(manual=false) {
    if(state.trip==='idle'||state.trip==='finished')freshSession();
    state.trip='paused'; state.pendingRest=manual?'manual':'automatic';
    $('restMessage').textContent=manual?'Вы отметили потребность в отдыхе. Не нужно ждать изменения пульса или экспериментальной оценки.':'В учебной записи появились устойчивые изменения. Это экспериментальная оценка, не доказательство будущего сна.';
    event(manual?'selfReport':'forecastPrompt',manual?'Отмечена потребность в отдыхе':'Предупреждение по устойчивым изменениям');
    positionPhoneUI();if(!$('restDialog').open)$('restDialog').showModal();render();
  }
  function setTime(time,notify=false) {
    const previous=state.second;state.second=Math.max(0,Math.min(900,time));
    if(notify&&state.second>previous){const alert=replay().points.find(p=>p.second>previous&&p.second<=state.second&&p.result.shouldPrompt&&!state.seen.has(p.second));if(alert){state.second=alert.second;state.seen.add(alert.second);showRest();return;}}
    if(state.second>=900&&state.trip==='running'){event('recordEnd','Учебная запись просмотрена до конца');finishTrip();return;}
    render();
  }
  $('tripToggle').addEventListener('click',()=>{
    if(state.trip==='running'){state.trip='paused';event('pause','Демо-поездка приостановлена');render();}
    else if(state.trip==='paused'&&state.second<900){state.trip='running';lastTick=performance.now();$('restoreNotice').hidden=true;event('resume','Демо-поездка продолжена');render();}
    else {positionPhoneUI();$('startCurrent').querySelector('strong').textContent=names[state.scenario];$('startCurrentDescription').textContent=`Текущий сценарий · ${state.context==='shortSleep'?'3 ч сна и 22 ч бодрствования':state.context==='unknown'?'история сна неизвестна':'8 ч сна и 5 ч бодрствования'}.`;$('startDialog').showModal();}
  });
  $('startGuided').addEventListener('click',()=>beginTrip(true));
  $('startCurrent').addEventListener('click',()=>beginTrip());
  $('tripFinish').addEventListener('click',()=>{state.trip='paused';event('pause','Пауза перед завершением');render();positionPhoneUI();$('finishDialog').showModal();});
  $('confirmFinish').addEventListener('click',()=>finishTrip());
  $('confirmStop').addEventListener('click',()=>finishTrip(true));
  $('changeStop').addEventListener('click',()=>{state.selectedPlace=null;event('changeStop','Выбор остановки отменён');render();});
  $('resetDemo').addEventListener('click',()=>{positionPhoneUI();$('eraseDialog').showModal();});
  $('forgetDemo').addEventListener('click',()=>{if(state.trip==='running'){state.trip='paused';event('pause','Пауза перед удалением демо');render();}positionPhoneUI();$('eraseDialog').showModal();});
  $('confirmErase').addEventListener('click',()=>{
    try { localStorage.removeItem(store.key); } catch {}
    storageActive=false; state.scenario='steady';state.context='rested';state.speed=30;$('speed').value='30';state.trip='idle';state.second=0;state.events=[];state.seen.clear();state.selectedPlace=null;state.pendingRest=null;state.sessionID='';state.automaticAlerts=0;state.selfReports=0;
    $('eraseDialog').close();$('restoreNotice').hidden=true;renderEvents();location.hash='dashboard';render();toast('Сохранённое демо удалено.');
  });
  $('openLab').addEventListener('click',openLab);document.querySelectorAll('[data-lab]').forEach(b=>b.addEventListener('click',openLab));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{b.closest('dialog').close();}));
  $('restDialog').addEventListener('close',()=>{state.pendingRest=null;persist(true);});
  $('applyScenario').addEventListener('click',()=>{state.scenario=$('scenarioSelect').value;state.context=$('contextSelect').value;freshSession();state.trip='idle';$('labDialog').close();event('scenario',`Выбрано: ${names[state.scenario]}`);location.hash='dashboard';render();toast('Сценарий готов. Начните демо-поездку.');});
  $('manualRest').addEventListener('click',()=>showRest(true));
  $('findRest').addEventListener('click',()=>{state.pendingRest=null;$('restDialog').close();location.hash='places';event('places','Открыты учебные места отдыха');});
  $('tryCalibration').addEventListener('click',()=>{state.scenario='calibration';state.context='rested';freshSession();state.trip='running';lastTick=performance.now();location.hash='dashboard';event('calibration','Начат учебный сбор профиля: 5 минут');render();});
  $('timeline').addEventListener('input',e=>{if(state.trip==='idle'){freshSession();state.trip='paused';}if(state.trip==='running')state.trip='paused';setTime(Number(e.target.value));persist(true);});
  $('stepBack').addEventListener('click',()=>{if(state.trip==='idle'){freshSession();state.trip='paused';}if(state.trip==='running')state.trip='paused';setTime(state.second-30);persist(true);});
  $('stepForward').addEventListener('click',()=>{if(state.trip==='idle'){freshSession();state.trip='paused';}setTime(state.second+30,true);persist(true);});
  $('speed').addEventListener('change',e=>{state.speed=Number(e.target.value);lastTick=performance.now();persist(true);});
  $('exportLog').addEventListener('click',()=>{const data={synthetic:true,algorithm:'1.6.0',independentSleepLabels:false,sessionID:state.sessionID,status:state.trip,summary:store.summary(state),selectedPlace:state.selectedPlace===null?null:places[state.selectedPlace],scenario:state.scenario,context:replay().context,second:state.second,events:state.events,snapshot:point()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ДрайвГард-поездка.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Экспортирован журнал учебной сессии.');});
  $('clearLog').addEventListener('click',()=>{state.events=[];renderEvents();persist(true);toast('Журнал очищен. Итоги поездки сохранены.');});
  $('placeCards').innerHTML=places.map((p,i)=>`<article class="place-card" data-place-type="${p.type}"><span class="place-number">0${i+1} / ДЕМО-МЕСТО</span><h2>${p.name}</h2><p>${p.description}<br>${p.distance} · вымышленное расстояние</p><button class="button secondary" data-place="${i}" aria-pressed="false">Выбрать остановку</button></article>`).join('');
  document.querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>{
    if(state.trip==='idle'||state.trip==='finished')freshSession();
    state.trip='paused';state.selectedPlace=Number(b.dataset.place);event('restSelected',`Выбрано место: ${places[state.selectedPlace].name}`);render();$('main').scrollTo({top:0,behavior:'smooth'});$('confirmStop').focus({preventScroll:true});
  }));
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-filter]').forEach(other=>{const selected=other===b;other.classList.toggle('active',selected);other.setAttribute('aria-pressed',String(selected));});
    document.querySelectorAll('[data-place-type]').forEach(card=>{card.hidden=b.dataset.filter!=='all'&&card.dataset.placeType!==b.dataset.filter;});
  }));
  window.addEventListener('hashchange',()=>{route();window.scrollTo({top:0,behavior:'instant'});$('main').focus({preventScroll:true});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.trip==='running'){state.trip='paused';event('background','Веб-демо приостановлено при скрытии вкладки');render();}});
  setInterval(()=>{const now=performance.now(),delta=(now-lastTick)/1000;lastTick=now;if(state.trip==='running'&&!document.hidden)setTime(state.second+Math.min(delta,1)*state.speed,true);},250);
  window.addEventListener('pagehide',()=>persist(true));
  $('speed').value=String(state.speed);
  $('restoreNotice').hidden=!restored||state.trip==='idle';
  route();render();renderEvents();
  if(state.pendingRest){
    $('restMessage').textContent=state.pendingRest==='manual'?'Вы отметили потребность в отдыхе. Выберите место для остановки.':'Перед обновлением страницы появилось предупреждение. Демо на паузе: выберите место отдыха.';
    positionPhoneUI();$('restDialog').showModal();
  }
})();
