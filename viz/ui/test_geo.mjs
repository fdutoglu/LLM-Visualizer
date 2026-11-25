import test from "node:test";import a from "node:assert/strict";import {createRequire} from "node:module";
const g=createRequire(import.meta.url)("./geo.js");
test("crom duraklardan geçer, tek durakta sabit",()=>{const P=[[0,0],[1,0],[1,2]];P.forEach((p,i)=>{const c=g.crom(P,i);a.ok(Math.hypot(c[0]-p[0],c[1]-p[1])<1e-9)});a.deepEqual(g.crom([[3,4]],0),[3,4])});
test("jArc artan, jInv/jAt birbirinin tersi",()=>{const A=g.jArc([[0,0],[1,0],[1,2],[5,2]]);for(let i=1;i<A.length;i++)a.ok(A[i]>=A[i-1]);for(const v of [0,.3,1.7,A.at(-1)])a.ok(Math.abs(g.jAt(A,g.jInv(A,v))-v)<1e-9)});
const box=p=>({x:p.lx,y:p.ly-p.h/2,w:p.w,h:p.h});const ov=(p,q)=>{const A=box(p),B=box(q);return A.x<B.x+B.w-.1&&B.x<A.x+A.w-.1&&A.y<B.y+B.h-.1&&B.y<A.y+A.h-.1};
test("görünen etiketler çakışmaz",()=>{const I=[];for(let i=0;i<60;i++)I.push({x:50+(i*37)%300,y:50+(i*53)%200,w:50,h:13,r:4,pri:-i});g.placeLabels(I,400,300);const S=I.filter(p=>p.show);a.ok(S.length>10);for(let i=0;i<S.length;i++)for(let j=0;j<i;j++)a.ok(!ov(S[i],S[j]))});
test("force her zaman görünür; sığmayan sola döner; öncelikli önce",()=>{const I=[{x:10,y:10,w:30,h:12,r:3,force:1},{x:10,y:10,w:30,h:12,r:3,force:1}];g.placeLabels(I,60,60);a.ok(I.every(p=>p.show));
 const e={x:95,y:50,w:40,h:12,r:3};g.placeLabels([e],100,100);a.ok(e.show&&e.lx<95-40);
 const lo={x:20,y:20,w:200,h:12,r:3,pri:0},hi={x:20,y:20,w:200,h:12,r:3,pri:1};g.placeLabels([lo,hi],240,30);a.ok(hi.show)});
test("niceStep",()=>{a.equal(g.niceStep(.117),.2);a.equal(g.niceStep(1),1);a.equal(g.niceStep(3),5)});
test("valColor uçlar ve nötr",()=>{const n=[10,10,10],x=[0,0,255],y=[255,0,0];a.equal(g.valColor(0,n,x,y),"rgb(10,10,10)");a.equal(g.valColor(-1,n,x,y),"rgb(0,0,255)");a.equal(g.valColor(2,n,x,y),"rgb(255,0,0)")});
test("pairStats ve topDiff",()=>{const s=g.pairStats([1,2,3],[2,4,6]);a.ok(Math.abs(s.cos-1)<1e-9&&Math.abs(s.r-1)<1e-9);a.deepEqual(g.topDiff([0,0,0],[1,-3,2],2),[1,2])});
test('placeLabels: leader etiketleri üst üste binmez', () => {
  const it = Array.from({ length: 20 }, (_, i) => ({ x: 300 + i % 5, y: 300 + i, r: 4, w: 60, h: 15, pri: -i, force: 1, leader: 1 }));
  g.placeLabels(it, 600, 600);
  for (let i = 0; i < 20; i++) for (let j = 0; j < i; j++) { const p = it[i], q = it[j]; a.ok(Math.abs(p.lx - q.lx) >= 60 - 1e-6 || Math.abs(p.ly - q.ly) >= 15 - 1e-6); }
});
test("axisRows: uç işaretten seçilir, süzülür, sıralanır, zayıflar atılır",()=>{
  const A=[0,1,2,3].map(id=>({id,stab:.95,ends:[{ok:id!==1,name:"a"+id},{ok:false,name:"e"+id}]})),z=[2,9,-5,.5];
  a.deepEqual(g.axisRows(z,A,false,9).map(r=>r.end.name),["a1","e2","a0"]);
  a.deepEqual(g.axisRows(z,A,true,9).map(r=>r.id),[0]);a.equal(g.axisRows(z,A,false,1).length,1);a.deepEqual(g.axisRows([0,0,0,0],A,false,9),[])});
