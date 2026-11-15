import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MobileDock} from '../src/components/MobileDock';
describe('mobile editor tool dock',()=>{
 const props={
  view:'2d' as const,tool:'select' as const,floorName:'1階',
  onSelectTool:()=>{},onViewChange:()=>{},onOpenPanel:()=>{},
  onUndo:()=>{},onRedo:()=>{},canUndo:false,canRedo:false
 };
 it('shows essential actions and active selection accessibly',()=>{
  const html=renderToStaticMarkup(<MobileDock {...props} selectedName="ソファ"/>);
  for(const label of ['選択','部屋','家具','ドア','計測','詳細','1階','2D','3D'])expect(html).toContain(label);
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('disabled=""');
 });
});
