const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../calc-model.js');
const close=(a,b,t=0.01)=>assert.ok(Math.abs(a-b)<=t,a+' ≠ '+b);
test('lee números escritos en formato brasileño, español y estadounidense',()=>{
  assert.equal(C.parseNumber('1.000'),1000);assert.equal(C.parseNumber('1.000,50'),1000.5);assert.equal(C.parseNumber('1,000.50'),1000.5);
  assert.equal(C.parseNumber('R$ 150'),150);assert.equal(C.parseNumber('8,5'),8.5);assert.equal(C.parseNumber('8.5'),8.5);
  assert.equal(C.parseNumber('1.000.000'),1000000);assert.equal(C.parseNumber('0,5'),0.5);assert.ok(Number.isNaN(C.parseNumber('abc')));assert.ok(Number.isNaN(C.parseNumber('')));
});
test('tasa anual y mensual son equivalentes',()=>{
  close(C.monthlyRate(8,'y'),0.0064340301,1e-9);close(C.monthlyRate(0.5,'m'),0.005,1e-12);
  close(Math.pow(1+C.monthlyRate(8,'y'),12),1.08,1e-9);close(C.annualRate(1,'m')*100,12.6825,1e-3);
});
test('ejemplo del diseño: R$1.000 + R$150/mes, 8% anual, 20 años',()=>{
  const r=C.simulate(1000,150,C.monthlyRate(8,'y'),240);const l=r[239];
  close(l.bal,90010.82,0.02);close(l.con,37000,1e-6);close(l.gain,53010.82,0.02);close(r[0].g,6.43,0.01);close(r[11].bal,2945.08,0.02);
});
test('sin rendimiento solo suma aportes',()=>{const r=C.simulate(100,10,0,12);assert.equal(r[11].bal,220);assert.equal(r[11].gain,0);});
test('aporte necesario y meses hasta la meta son coherentes',()=>{
  const i=C.monthlyRate(8,'y');const ap=C.neededContribution(1e6,1000,i,240);const r=C.simulate(1000,ap,i,240);close(r[239].bal,1e6,0.5);
  const m=C.monthsToGoal(1e6,1000,500,i);assert.ok(m>=400&&m<=420);const s=C.simulate(1000,500,i,m);assert.ok(s[m-1].bal>=1e6&&s[m-2].bal<1e6);
  assert.equal(C.monthsToGoal(100,200,0,0),0);assert.equal(C.monthsToGoal(1000,0,0,0.01),null);
  close(C.neededContribution(1200,0,0,12),100,1e-9);
});
test('independencia financiera: regla del 4% y alternativas',()=>{
  assert.equal(C.neededWealth(2000,4),600000);assert.equal(C.neededWealth(2000,3),800000);assert.equal(C.neededWealth(2000,5),480000);close(C.monthlyIncome(90010.82,4),300.04,0.01);
});
test('validación de límites',()=>{
  assert.deepEqual(C.validate({ini:1000,ap:150,rate:8,rateU:'y',months:240}),[]);
  assert.deepEqual(C.validate({ini:-1,rate:300,rateU:'y',months:0}).sort(),['ini','rate','time']);
  assert.ok(C.validate({rate:31,rateU:'m'}).includes('rate'));assert.ok(C.validate({months:1201}).includes('time'));assert.ok(C.validate({ap:NaN}).includes('ap'));
});
test('series y etapas',()=>{
  const r=C.simulate(0,10,0.01,240);assert.equal(C.series(r).length,20);assert.equal(C.series(C.simulate(0,1,0,18)).length,18);assert.equal(C.series(C.simulate(0,1,0,30)).length,3);
  assert.deepEqual(C.stages(240).map(s=>s.y),[1,5,10,15,20]);assert.deepEqual(C.stages(8).map(s=>s.m),[1,2,4,6,8]);assert.deepEqual(C.stages(1).map(s=>s.m),[1]);
});
