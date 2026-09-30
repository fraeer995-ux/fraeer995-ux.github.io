import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../assets/scripts/text-transition.js').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});

function frame(from,to,progress) {
  assert.equal(typeof api.scrambleFrame,'function','Text scramble not implemented');
  return api.scrambleFrame(from,to,progress,17);
}

test('scramble settles exactly into the selected text, including line breaks and emoji',()=>{
  const target='Ideas become\nworking code. ↗ 🛠';
  const result=frame('Идеи становятся\nработающим кодом.',target,1);
  assert.equal(result.map(slot=>slot.character).join(''),target);
  assert.ok(result.every(slot=>slot.settled));
});

test('scramble preserves target whitespace while letters resolve in a mixed order',()=>{
  const target='Телеграм боты\nи сайты';
  const result=frame('Telegram bots\nand websites',target,.55);
  const chars=Array.from(target);
  chars.forEach((character,index)=>{if(/\s/u.test(character))assert.equal(result[index].character,character);});
  assert.ok(result.some(slot=>slot.settled && !/\s/u.test(slot.character)));
  assert.ok(result.some(slot=>!slot.settled));
  assert.ok(result.some((slot,index)=>slot.character!==chars[index]));
});

test('letters stay settled once revealed and both shorter and longer translations finish',()=>{
  for (const [from,to] of [['Код','Working code'],['Working code','Код']]) {
    const mid=frame(from,to,.7), late=frame(from,to,.85), target=Array.from(to);
    mid.forEach((slot,index)=>{if(slot.settled){assert.ok(late[index].settled);assert.equal(late[index].character,target[index]);}});
    assert.equal(frame(from,to,1).map(slot=>slot.character).join(''),to);
  }
});
