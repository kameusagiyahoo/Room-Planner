export const SCHEMA_VERSION = '1.0.0' as const;
export type Point = { x: number; y: number };
export type Vertex = Point & { id: string };
export type Wall = { id: string; a: string; b: string; thickness: number; height?: number };
export type WallLink = { wallId: string; reversed: boolean };
export type Room = { id: string; name: string; boundary: WallLink[] };
export type Opening = {
  id: string; kind: 'door' | 'window'; wallId: string; offset: number;
  width: number; height: number; sillHeight: number;
  style: 'hinged' | 'sliding' | 'fixed'; swing?: 'left' | 'right'; open?: boolean;
};
export type Furniture = {
  id: string; name: string; kind: string; x: number; y: number;
  width: number; depth: number; height: number; rotation: number;
};
export type Stair={id:string;x:number;y:number;width:number;run:number;rotation:number;toFloorId:string};
export type Floor = {
  id: string; name: string; elevation: number; ceilingHeight: number;
  vertices: Vertex[]; walls: Wall[]; rooms: Room[];
  openings: Opening[]; furniture: Furniture[]; stairs?: Stair[];
};
export type HouseProject = {
  schemaVersion: typeof SCHEMA_VERSION; id: string; name: string;
  units: 'm'; floors: Floor[]; updatedAt: string;
};
export function newId(prefix = 'id'): string {
  return prefix + '-' + globalThis.crypto.randomUUID();
}
export const emptyFloor = (name = '1階'): Floor => ({
  id: newId('floor'), name, elevation: 0, ceilingHeight: 2.4,
  vertices: [], walls: [], rooms: [], openings: [], furniture: [], stairs: []
});
export const emptyProject = (): HouseProject => ({
  schemaVersion: SCHEMA_VERSION, id: newId('project'), name: '新しい間取り',
  units: 'm', updatedAt: new Date().toISOString(), floors: [emptyFloor()]
});
export function exampleProject(): HouseProject {
  const vs: Vertex[] = [
    {id:'v1',x:0,y:0},{id:'v2',x:5,y:0},{id:'v3',x:8,y:0},
    {id:'v4',x:8,y:4},{id:'v5',x:5,y:4},{id:'v6',x:0,y:4}
  ];
  const walls: Wall[] = [
    ['w1','v1','v2'],['w2','v2','v3'],['w3','v3','v4'],
    ['w4','v4','v5'],['w5','v5','v6'],['w6','v6','v1'],
    ['w7','v2','v5']
  ].map(([id,a,b])=>({id,a,b,thickness:0.12}));
  const link = (wallId:string, reversed=false):WallLink=>({wallId,reversed});
  return {
    schemaVersion:SCHEMA_VERSION,id:'sample-basic',name:'操作練習（8×4m）',
    units:'m',updatedAt:new Date().toISOString(),floors:[{
      id:'floor-1',name:'1階',elevation:0,ceilingHeight:2.4,vertices:vs,walls,
      rooms:[
        {id:'living',name:'LDK',boundary:[link('w1'),link('w7'),link('w5'),link('w6')]},
        {id:'bedroom',name:'洋室',boundary:[link('w2'),link('w3'),link('w4'),link('w7',true)]}
      ],
      openings:[
        {id:'door-1',kind:'door',wallId:'w7',offset:1.15,width:0.85,height:2.0,sillHeight:0,style:'hinged',swing:'right',open:false},
        {id:'window-1',kind:'window',wallId:'w5',offset:2.25,width:1.6,height:1.2,sillHeight:0.8,style:'sliding'}
      ],
      furniture:[
        {id:'sofa-1',name:'ソファ',kind:'sofa',x:1,y:1,width:1.8,depth:0.85,height:0.8,rotation:0},
        {id:'bed-1',name:'ベッド',kind:'bed',x:5.8,y:0.6,width:1.4,depth:2.0,height:0.55,rotation:0}
      ]
    }]
  };
}
