import {describe,it,expect} from 'vitest';
import {clampZoom,initialView,zoomView,panView,pixelScale} from '../src/domain/viewport';
describe('SVG mobile camera',()=>{
  it('zooms around viewport center without shifting center',()=>{
    const v=zoomView(initialView,2,10,8);
    expect(v.zoom).toBe(2);
    expect(v.panX+10/v.zoom/2).toBeCloseTo(5);
    expect(v.panY+8/v.zoom/2).toBeCloseTo(4);
  });
  it('clamps zoom to reasonable mobile levels',()=>{
    expect(clampZoom(500)).toBe(6);
    expect(clampZoom(.0001)).toBe(.55);
  });
  it('pans in world units relative to screen density',()=>{
    const v=panView(initialView,40,-20,20);
    expect(v.panX).toBe(-2);expect(v.panY).toBe(1);
    expect(pixelScale(1,10,8,300,200)).toBe(25);
  });
  it('ignores invalid magnification and zero-sized view',()=>{
    expect(zoomView(initialView,0,10,8)).toEqual(initialView);
    expect(panView(initialView,10,10,0)).toEqual(initialView);
  });
});
