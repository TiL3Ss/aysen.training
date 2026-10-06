"use client";
import {useState} from "react";
import {Eye,EyeOff} from "lucide-react";
type Props={id?:string;name:string;autoComplete?:string;required?:boolean;minLength?:number;maxLength?:number;placeholder?:string;disabled?:boolean};
export function PasswordField(props:Props){const [visible,setVisible]=useState(false);return <span className="password-field"><input {...props} type={visible?"text":"password"}/><button className="password-eye" type="button" aria-label={visible?"Ocultar contraseña":"Mostrar contraseña"} title={visible?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>}
