'use client';
import {useEffect,useRef,useState} from 'react';
export default function Dialog({title,eyebrow='WORKSPACE',onClose,children}:{title:string;eyebrow?:string;onClose:()=>void;children:React.ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),[dirty,setDirty]=useState(false),[confirm,setConfirm]=useState(false);
 const close=()=>{if(dirty)setConfirm(true);else onClose();};
 useEffect(()=>{const target=dialog.current,previous=document.activeElement as HTMLElement|null;target?.showModal();return()=>{target?.close();previous?.focus();};},[]);
 return <dialog ref={dialog} className="react-dialog" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}><section className="modal-panel" onChange={()=>setDirty(true)}><header><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}>×</button></header><div className="dialog-body">{children}</div>{confirm&&<div className="form-error"><p>Discard unsaved changes?</p><div className="form-actions"><button className="btn" onClick={()=>setConfirm(false)}>Keep editing</button><button className="btn danger" onClick={onClose}>Discard changes</button></div></div>}</section></dialog>;
}
