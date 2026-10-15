import Image from "next/image";
export function Avatar({name,imageId}:{name:string;imageId?:string}){return imageId?<Image unoptimized src={`/api/images/${imageId}`} alt="" width={40} height={40} className="creator-avatar" loading="lazy"/>:<span className="account-avatar" aria-hidden="true">{Array.from(name.trim())[0]?.toUpperCase()??"B"}</span>;}
