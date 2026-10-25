import { useState } from 'react';
export function PlanetTags({tags}:{tags?:string[]}) { return tags?.length?<span className="planet-tags">{tags.map(tag=><span key={tag}>{tag}</span>)}</span>:null; }
export function Specializations({tags,onChange}:{tags:string[];onChange:(tags:string[])=>void}) {
 const [text,setText]=useState('');
 function add(value:string){const tag=value.trim();if(tag&&tags.length<12&&!tags.some(t=>t.toLowerCase()===tag.toLowerCase()))onChange([...tags,tag]);setText('');}
 return <section className="specializations"><h3>Specializations</h3><div className="planet-tags">{tags.map(tag=><button key={tag} aria-label={`Remove ${tag} specialization`} onClick={()=>onChange(tags.filter(t=>t!==tag))}>{tag} ×</button>)}</div><form onSubmit={event=>{event.preventDefault();add(text);}}><input aria-label="New specialization" placeholder="Add a specialization…" maxLength={40} value={text} onChange={e=>setText(e.target.value)}/><button className="design-button" disabled={!text.trim()||tags.length>=12}>Add</button></form><div className="tag-suggestions">{['Smelting','Science','Dyson components','Mining','Fuel','Manufacturing'].filter(tag=>!tags.includes(tag)).map(tag=><button key={tag} disabled={tags.length>=12} onClick={()=>add(tag)}>+ {tag}</button>)}</div></section>;
}
