'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const pages = {dashboard:'Поездка',analysis:'Сигналы',profiles:'Личный профиль',places:'Места отдыха',protocol:'Проверка'};
  const names = {steady:'Спокойная поездка',flatPulse:'Меньше движения, пульс не падает',risingPulse:'Движение и рост пульса',road:'Общая дорожная вибрация',signalLoss:'Пропуски движения',quiet:'Спокойное бодрствование',active:'Активность',calibration:'Новый личный профиль'};
  const roadNames = {unavailable:'Дорожная вибрация не отделена',unreliable:'Сопоставление ненадёжно',sharedVibration:'Возможна общая вибрация',tentativelyDistinct:'Разделение предварительное'};
  const activityNames = {quiet:'Спокойное бодрствование',active:'Активность',trip:'Поездка'};
  const params = new URLSearchParams(location.search);
  const state = {scenario:Object.hasOwn(names,params.get('scenario')) ? params.get('scenario') : 'steady',context:['rested','shortSleep','unknown'].includes(params.get('context')) ? params.get('context') : 'rested',second:0,trip:'idle',speed:30,events:[],seen:new Set()};
  const replay = () => window.DRIVEGUARD_REPLAYS[state.scenario+'-'+state.context];
  const point = () => replay().points.filter(p => p.second <= state.second).at(-1) || replay().points[0];
  const clock = t => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  const numeric = x => Number.isFinite(x) ? String(Math.round(x)) : '—';
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let toastTimer, lastTick = performance.now();
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(()=>{$('toast').hidden=true;},4000); }
  function event(type,message) {
    state.events.push({type,message,second:Math.round(state.second),at:new Date().toISOString(),scenario:state.scenario,context:state.context,synthetic:true});
    state.events = state.events.slice(-150); renderEvents();
  }
  function renderEvents() {
    $('eventLog').innerHTML = state.events.length ? state.events.slice().reverse().map(e=>`<li><time>${clock(e.second)} · УЧЕБНАЯ ЗАПИСЬ</time>${escape(e.message)}</li>`).join('') : '<li>Событий пока нет.</li>';
  }
  function route() {
    const candidate = location.hash.slice(1), page = Object.hasOwn(pages,candidate) ? candidate : 'dashboard';
    document.querySelectorAll('.page').forEach(section => {section.hidden = section.id !== page;});
    document.querySelectorAll('[data-page]').forEach(a => {const selected=a.dataset.page===page;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    $('pageName').textContent = pages[page];
    $('main').scrollTo({top:0,behavior:'instant'});
    document.title = `DriveGuard — ${pages[page]}`;
  }
  function chart() {
    if (state.trip === 'idle') return '<div class="empty-state">История появится после начала демо-поездки</div>';
    const visible = replay().points.filter(p => p.second <= state.second), width=600,height=125;
    const path=visible.map((p,i)=>`${i?'L':'M'}${(p.second/900*width).toFixed(1)},${(height-15-(p.bpm-40)/80*(height-25)).toFixed(1)}`).join(' ');
    const last=visible.at(-1),x=last ? last.second/900*width : 0,y=last ? height-15-(last.bpm-40)/80*(height-25) : 0;
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20H600M0 65H600M0 110H600" stroke="#e6ecdf" stroke-width="1" stroke-dasharray="3 5"/><path d="${path}" fill="none" stroke="#71984c" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${x}" cy="${y}" r="3" fill="#486c35"/><text x="8" y="15" fill="#a0ad94" font-size="8">120</text><text x="8" y="122" fill="#a0ad94" font-size="8">40</text></svg>`;
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
    $('tripState').textContent=state.trip==='running'?'ДЕМО-ПОЕЗДКА ИДЁТ':state.trip==='paused'?'ДЕМО-ПОЕЗДКА НА ПАУЗЕ':state.trip==='finished'?'ДЕМО-ПОЕЗДКА ЗАВЕРШЕНА':'ГОТОВЫ К ДЕМО-ПОЕЗДКЕ';
    $('tripToggle').textContent=state.trip==='running'?'Приостановить Ⅱ':state.trip==='paused'?'Продолжить ↗':'Начать демо-поездку ↗';$('tripFinish').hidden=idle||state.trip==='finished';
    $('heroTitle').textContent=idle?'Вовремя сделать паузу.':state.trip==='finished'?'Поездка завершена.':prompted?'Запланируйте остановку.':r.state==='unavailable'?'Данных недостаточно.':state.scenario==='calibration'&&r.state==='calibrating'?'Собираем личный профиль.':'Внимание — на самочувствие.';
    $('heroDescription').textContent=idle?'Пульс, движение и ваш режим сна — вместе, чтобы внимательнее относиться к самочувствию.':r.reason;
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
  function openLab() {positionPhoneUI();$('scenarioSelect').value=state.scenario;$('contextSelect').value=state.context;$('labDialog').showModal();}
  function showRest(manual=false) {
    if(state.trip==='running')state.trip='paused';
    $('restMessage').textContent=manual?'Вы отметили потребность в отдыхе. Не нужно ждать изменения пульса или экспериментальной оценки.':'В учебной записи появились устойчивые изменения. Это экспериментальная оценка, не доказательство будущего сна.';
    event(manual?'selfReport':'forecastPrompt',manual?'Отмечена потребность в отдыхе':'Предупреждение по устойчивым изменениям');
    positionPhoneUI();if(!$('restDialog').open)$('restDialog').showModal();render();
  }
  function setTime(time,notify=false) {
    const previous=state.second;state.second=Math.max(0,Math.min(900,time));
    if(notify&&state.second>previous){const alert=replay().points.find(p=>p.second>previous&&p.second<=state.second&&p.result.shouldPrompt&&!state.seen.has(p.second));if(alert){state.second=alert.second;state.seen.add(alert.second);showRest();return;}}
    if(state.second>=900&&state.trip==='running'){state.trip='paused';event('recordEnd','Учебная запись просмотрена до конца');}
    render();
  }
  $('tripToggle').addEventListener('click',()=>{
    if(state.trip==='running'){state.trip='paused';event('pause','Демо-поездка приостановлена');}
    else {if(state.trip==='finished'||state.second>=900){state.second=0;state.seen.clear();}state.trip='running';lastTick=performance.now();event('start','Демо-поездка начата или продолжена');}render();
  });
  $('tripFinish').addEventListener('click',()=>{state.trip='finished';event('finish','Демо-поездка завершена');render();toast('Поездка завершена. Журнал доступен в разделе «Проверка».');});
  $('openLab').addEventListener('click',openLab);document.querySelectorAll('[data-lab]').forEach(b=>b.addEventListener('click',openLab));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{b.closest('dialog').close();}));
  $('applyScenario').addEventListener('click',()=>{state.scenario=$('scenarioSelect').value;state.context=$('contextSelect').value;state.second=0;state.trip='idle';state.seen.clear();$('labDialog').close();event('scenario',`Выбрано: ${names[state.scenario]}`);location.hash='dashboard';render();toast('Сценарий готов. Начните демо-поездку.');});
  $('manualRest').addEventListener('click',()=>showRest(true));
  $('findRest').addEventListener('click',()=>{$('restDialog').close();location.hash='places';event('places','Открыты учебные места отдыха');});
  $('tryCalibration').addEventListener('click',()=>{state.scenario='calibration';state.context='rested';state.second=0;state.trip='running';state.seen.clear();lastTick=performance.now();location.hash='dashboard';event('calibration','Начат учебный сбор профиля: 5 минут');render();});
  $('timeline').addEventListener('input',e=>{if(state.trip==='idle')state.trip='paused';if(state.trip==='running')state.trip='paused';setTime(Number(e.target.value));});
  $('stepBack').addEventListener('click',()=>{if(state.trip==='idle')state.trip='paused';if(state.trip==='running')state.trip='paused';setTime(state.second-30);});
  $('stepForward').addEventListener('click',()=>{if(state.trip==='idle')state.trip='paused';setTime(state.second+30,true);});
  $('speed').addEventListener('change',e=>{state.speed=Number(e.target.value);lastTick=performance.now();});
  $('exportLog').addEventListener('click',()=>{const data={synthetic:true,algorithm:'1.6.0',independentSleepLabels:false,scenario:state.scenario,context:replay().context,second:state.second,events:state.events,snapshot:point()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='DriveGuard-demo-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Экспортирован журнал учебной сессии.');});
  $('clearLog').addEventListener('click',()=>{state.events=[];renderEvents();toast('Журнал этой страницы очищен.');});
  $('placeCards').innerHTML=[['Кафе «Пауза»','1,2 км · 3 мин','Кофе и место для короткого перерыва.'],['Парковка «Тихий маршрут»','2,4 км · 5 мин','Учебный пример безопасной остановки.'],['Мотель «Новый день»','4,8 км · 9 мин','Пример места для длительного отдыха.']].map(([name,distance,description],i)=>`<article class="place-card"><span class="place-number">0${i+1} / ДЕМО-МЕСТО</span><h2>${name}</h2><p>${description}<br>${distance} · вымышленное расстояние</p><button class="button secondary" data-place="${i}">Выбрать остановку ↗</button></article>`).join('');
  document.querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>{event('restSelected',`Выбрано учебное место ${Number(b.dataset.place)+1}`);state.trip='finished';render();toast('Учебная остановка выбрана. Демо-поездка завершена; реальный маршрут не строится.');}));
  window.addEventListener('hashchange',()=>{route();window.scrollTo({top:0,behavior:'instant'});$('main').focus({preventScroll:true});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.trip==='running'){state.trip='paused';event('background','Веб-демо приостановлено при скрытии вкладки');render();}});
  setInterval(()=>{const now=performance.now(),delta=(now-lastTick)/1000;lastTick=now;if(state.trip==='running'&&!document.hidden)setTime(state.second+Math.min(delta,1)*state.speed,true);},250);
  if(!window.DRIVEGUARD_REPLAYS||!replay()){document.querySelector('main').textContent='Не удалось загрузить учебные записи. Откройте полный комплект файлов прототипа.';return;}
  route();render();renderEvents();
})();
