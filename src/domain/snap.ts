import type {Point} from './model';
export type SnapStep=0|0.05|0.1|0.25;
export const SNAP_STEPS:readonly SnapStep[]=[0,0.05,0.1,0.25];
/** Snap to metre increments; off still rounds to 1mm to limit JSON noise. */
export function snapValue(value:number,step:SnapStep):number {
  if(!Number.isFinite(value))return value;
  const increment=step||0.001;
  const v=Math.round(Math.round(value/increment)*increment*1000)/1000;
  return Object.is(v,-0)?0:v;
}
export function snapPoint(p:Point,step:SnapStep):Point{
  return {x:snapValue(p.x,step),y:snapValue(p.y,step)};
}
/** Move by one precise increment without introducing float drift. */
export function nudgePoint(p:Point,direction:Point,step:SnapStep):Point{
  const delta=step||0.05;
  return {x:Math.round((p.x+direction.x*delta)*1000)/1000,
    y:Math.round((p.y+direction.y*delta)*1000)/1000};
}
export const snapLabel=(step:SnapStep)=>step===0?'吸着OFF':step===.05?'5cm':step===.1?'10cm':'25cm';
