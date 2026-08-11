import {put} from './storage.js';
import {uid} from './utils.js';

export function todayISO(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
export function addDaysISO(dateStr,days){
  const d=new Date(`${dateStr}T12:00:00`);d.setDate(d.getDate()+days);return todayISO(d);
}
export function nextRecurringDate(dateStr,recurrence){
  const base=dateStr||todayISO();
  if(recurrence==='daily')return addDaysISO(base,1);
  if(recurrence==='weekly')return addDaysISO(base,7);
  if(recurrence==='monthly'){
    const d=new Date(`${base}T12:00:00`);d.setMonth(d.getMonth()+1);return todayISO(d);
  }
  if(recurrence==='weekdays'){
    let d=addDaysISO(base,1),day=new Date(`${d}T12:00:00`).getDay();
    while(day===0||day===6){d=addDaysISO(d,1);day=new Date(`${d}T12:00:00`).getDay()}
    return d;
  }
  return '';
}
export async function createTodo(text,{folder='today',dueDate='',priority=false,recurrence='none'}={}){
  const now=new Date().toISOString();
  const item={id:uid(),folder,text:String(text||'').trim(),done:false,dueDate,priority:Boolean(priority),recurrence,createdAt:now,updatedAt:now};
  await put('todos',item);return item;
}
