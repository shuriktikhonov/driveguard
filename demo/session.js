'use strict';
// Only synthetic demo state is stored. Never resume playback automatically.
(function (root) {
  const key = 'driveguard.demo.v2';
  const scenarios = ['steady','flatPulse','risingPulse','road','signalLoss','quiet','active','calibration'];
  const contexts = ['rested','shortSleep','unknown'];
  function restore(raw) {
    try {
      const s = JSON.parse(raw);
      if (!s || s.version !== 2 || s.synthetic !== true || !scenarios.includes(s.scenario) || !contexts.includes(s.context)
          || !Number.isFinite(s.second) || s.second < 0 || s.second > 900
          || !['idle','running','paused','finished'].includes(s.trip)) return null;
      return {
        scenario:s.scenario, context:s.context, second:s.second,
        trip:s.trip === 'running' ? 'paused' : s.trip,
        speed:[1,30,60].includes(s.speed) ? s.speed : 30,
        sessionID:typeof s.sessionID === 'string' ? s.sessionID.slice(0,80) : '',
        automaticAlerts:Number.isInteger(s.automaticAlerts)&&s.automaticAlerts>=0?s.automaticAlerts:0,
        selfReports:Number.isInteger(s.selfReports)&&s.selfReports>=0?s.selfReports:0,
        pendingRest:s.trip!=='finished'&&['manual','automatic'].includes(s.pendingRest)?s.pendingRest:null,
        selectedPlace:Number.isInteger(s.selectedPlace) && s.selectedPlace >= 0 && s.selectedPlace < 3 ? s.selectedPlace : null,
        seen:new Set(Array.isArray(s.seen) ? s.seen.filter(n=>Number.isInteger(n)&&n>=0&&n<=900) : []),
        events:Array.isArray(s.events) ? s.events.filter(e=>e && e.synthetic === true && typeof e.type === 'string' && typeof e.message === 'string' && Number.isFinite(e.second) && e.second>=0 && e.second<=900).slice(-150).map(e=>({type:e.type.slice(0,60),message:e.message.slice(0,500),second:e.second,at:typeof e.at==='string'?e.at.slice(0,40):'',scenario:scenarios.includes(e.scenario)?e.scenario:s.scenario,context:contexts.includes(e.context)?e.context:s.context,synthetic:true})) : []
      };
    } catch { return null; }
  }
  function serialize(state) { return JSON.stringify({...state,version:2,synthetic:true,seen:[...state.seen]}); }
  function summary(state) {
    return {seconds:Math.round(state.second),automaticAlerts:state.automaticAlerts,selfReports:state.selfReports,selectedPlace:state.selectedPlace};
  }
  root.DriveGuardSession = {key,restore,serialize,summary};
})(typeof window === 'undefined' ? globalThis : window);
