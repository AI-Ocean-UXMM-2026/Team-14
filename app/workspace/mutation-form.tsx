'use client';
import ValidatedForm from '../components/validated-form';
import {FormActions} from '../components/dialog';
import {useActionState,useEffect,useState,useRef} from 'react';
import Icon from '../components/ui-icon';
import {mutateWorkspace} from './actions';
type Choice={id:string;label:string};
type Props={ariaLabel?:string;assignments?:{teacher_id:string;class_id:string}[];onSaved?:(message:string)=>void;disabled?:boolean;operation:string;entity:string;requestKey:string;version?:number;label:string;start?:string;end?:string;dates?:boolean;reason?:boolean;reasonRequired?:boolean;decisions?:string[];teachers?:Choice[];classes?:Choice[]};
export default function MutationForm(p:Props){
 const [state,action,pending]=useActionState(mutateWorkspace,{ok:false,message:''});
 const [values,setValues]=useState({start:p.start??'',end:p.end??'',reason:'',entity:p.entity,class_id:p.classes?.[0]?.id??'',decision:p.decisions?.[0]??''});
 const savedCallback=useRef(p.onSaved);savedCallback.current=p.onSaved;useEffect(()=>{if(state.ok)savedCallback.current?.(state.message);},[state.ok]);
 const availableClasses=p.classes?.filter(c=>!p.assignments||p.assignments.some(a=>a.teacher_id===values.entity&&a.class_id===c.id));
 const chosenClass=availableClasses?.some(c=>c.id===values.class_id)?values.class_id:availableClasses?.[0]?.id??'';
 const change=(name:keyof typeof values,value:string)=>setValues(v=>({...v,[name]:value}));
 return <ValidatedForm action={action} serverError={!state.ok?state.message:undefined} submitting={pending} validate={data=>{if(!p.dates)return {};const start=Date.parse(String(data.get('start')??'')+':00+06:30'),end=Date.parse(String(data.get('end')??'')+':00+06:30');return Number.isFinite(start)&&Number.isFinite(end)&&end<=start?{[p.operation==='create_admin_session'?'end':'end_time']:'End time must follow the start. For overnight classes, choose the next end date.'}:{};}} className="mutation-form"><input type="hidden" name="operation" value={p.operation}/><input type="hidden" name="key" value={p.requestKey}/><input type="hidden" name="version" value={p.version??''}/>{!p.teachers&&<input type="hidden" name="entity" value={p.entity}/>}
 {p.teachers&&<label>Teacher<select name="entity" value={values.entity} onChange={e=>change('entity',e.target.value)} required>{p.teachers.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>}
 {p.classes&&<label>Class<select name="class_id" value={chosenClass} onChange={e=>change('class_id',e.target.value)} required>{availableClasses?.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
 {p.dates&&p.operation==='create_admin_session'?<><div className="form-grid"><label>Start time<input name="start" type="datetime-local" step="60" required value={values.start} onChange={e=>change('start',e.target.value)}/></label><label>End time<input name="end" type="datetime-local" step="60" required value={values.end} onChange={e=>change('end',e.target.value)}/></label></div><p className="admin-note">Saved as Pending verification. Teacher can see this entry.</p></>:p.dates&&<div className="native-fields">{(['start','end'] as const).map(part=><div key={part}><input type="hidden" name={part} value={values[part]}/><label>{part==='start'?'Correct start date':'Correct end date'}<input name={part+'_date'} type="date" value={values[part].split('T')[0]??''} onChange={e=>change(part,e.target.value+'T'+(values[part].split('T')[1]??''))} required/></label><label>{part==='start'?'Correct start time':'Correct end time'}<input name={part+'_time'} type="time" step="60" value={values[part].split('T')[1]??''} onChange={e=>change(part,(values[part].split('T')[0]??'')+'T'+e.target.value)} required/></label></div>)}</div>}
 {p.decisions&&<label>Decision<select name="decision" value={values.decision} onChange={e=>change('decision',e.target.value)}>{p.decisions.map(d=><option key={d} value={d}>{d[0].toUpperCase()+d.slice(1)}</option>)}</select></label>}
 {p.reason&&<label>Reason{p.reasonRequired?' (required)':' (required for rejection)'}<textarea aria-label={'Reason'+(p.reasonRequired?' (required)':' (required for rejection)')} name="reason" maxLength={2000} value={values.reason} onChange={e=>change('reason',e.target.value)} required={p.reasonRequired||values.decision==='rejected'} rows={3}/></label>}
 {p.classes&&!availableClasses?.length&&<p className="record-note">Assign an active class to this teacher before adding a record.</p>}
 <FormActions><button aria-label={p.ariaLabel} className="btn primary" disabled={p.disabled||Boolean(p.classes&&!availableClasses?.length)||pending||state.ok}>{p.operation==='check_in'&&<Icon name="plus"/>}{pending?'Saving…':state.ok?'Saved':p.label}</button></FormActions>{state.ok&&state.message&&<p role="status" className="saved-message">{state.message}</p>}
 </ValidatedForm>;
}
