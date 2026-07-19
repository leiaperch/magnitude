import { readFileSync } from 'node:fs';
import * as THREE from '../assets/vendor/three.module.js';
import { buildEra } from '../assets/js/modes/town.js';
const ages = JSON.parse(readFileSync('assets/data/ages.json','utf8'));
for (const y of [1000,1300,1450,1700,1850,1950,2000,2050]) {
  const era = ages.eras.find(e=>e.year===y);
  const g = buildEra(era);
  let tris=0, gtris=0; const bb=new THREE.Box3();
  g.traverse(o=>{ if(o.isMesh){ const c=o.geometry.attributes.position.count/3; if(o.material.type==='MeshBasicMaterial') gtris+=c; else tris+=c; bb.expandByObject(o);} });
  const s=bb.getSize(new THREE.Vector3());
  console.log(`${y}: solid ${tris} glow ${gtris} tris | bbox ${s.x.toFixed(1)}x${s.y.toFixed(1)}x${s.z.toFixed(1)} y[${bb.min.y.toFixed(2)}..${bb.max.y.toFixed(2)}]`);
}
