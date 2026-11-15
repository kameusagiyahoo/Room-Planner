import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PlanEditor} from '../src/components/PlanEditor';
import {exampleProject} from '../src/domain/model';
describe('resizing handles rendering',()=>{
  const project=exampleProject();
  const floor=project.floors[0],noop=()=>{};
  const base={
    floor,tool:'select' as const,snapStep:.1 as const,onSnapChange:noop,
    measurePoints:[],onMeasurePoint:noop,
    selectedRoom:null,selectedWall:null,selectedOpening:null,selectedFurniture:null,
    selectedStair:null,selectedVertex:null,
    onSelectRoom:noop,onSelectWall:noop,onSelectOpening:noop,onSelectFurniture:noop,
    onSelectStair:noop,onSelectVertex:noop,onAddRoom:noop,onMoveVertex:noop,
    onAddOpening:noop,onMoveOpening:noop,onAddStair:noop,onMoveStair:noop,
    onAddFurniture:noop,onMoveFurniture:noop,onResizeFurniture:noop,onResizeRoom:noop,onMoveSharedWall:noop
  };
  it('renders four editable corners for a selected full-size sofa',()=>{
    const html=renderToStaticMarkup(<PlanEditor {...base} selectedFurniture="sofa-1"/>);
    expect(html).toContain('data-resize-furniture="sofa-1"');
    expect(html).toContain('data-resize-corner="se"');
    expect(html).toContain('家具のse角を伸縮');
  });
  it('shows a movable orange handle on a selected shared wall',()=>{
    const html=renderToStaticMarkup(<PlanEditor {...base} selectedWall="w7"/>);
    expect(html).toContain('data-move-partition="w7"');
    expect(html).toContain('共有壁を動かす');
  });
  it('shows a linked wall handle when selecting either adjoining room',()=>{
    const html=renderToStaticMarkup(<PlanEditor {...base} selectedRoom="living"/>);
    expect(html).toContain('data-move-partition="w7"');
  });
  it('offers only nonshared room edges on two adjoining rooms',()=>{
    const html=renderToStaticMarkup(<PlanEditor {...base} selectedRoom="living"/>);
    expect(html).toContain('data-resize-room="living"');
    expect(html).toContain('data-resize-edge="left"');
    expect(html).not.toContain('data-resize-edge="right"');
  });
});
