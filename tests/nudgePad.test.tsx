import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {NudgePad} from '../src/components/NudgePad';
describe('nudge control',()=>{
 it('renders explicit accessible controls without desktop-only keybindings',()=>{
  const html=renderToStaticMarkup(<NudgePad step={.05} onNudge={()=>{}}/>);
  for(const direction of ['上へ移動','下へ移動','左へ移動','右へ移動'])expect(html).toContain(direction);
  expect(html).toContain('5cm');
 });
});
