// Disposable WASM PostgreSQL; no external DB, credentials or student records.
import fs from 'node:fs';
const {PGlite}=await import(process.env.FORMA_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
try{
 const stages=JSON.parse(fs.readFileSync('tests/security/learning-fixtures.json','utf8'));
 await db.exec(stages[0]);
 await db.exec(fs.readFileSync('education-accounts.sql','utf8'));
 await db.exec(fs.readFileSync('learning-validation.sql','utf8'));
 await db.exec(fs.readFileSync('learning-validation.sql','utf8'));
 for(let i=1;i<stages.length;i++){await db.exec(stages[i]);console.log('PASS isolated database stage '+i);}
 console.log('PASS schema idempotence, ownership, locks, manual write denied, seek detection, quiz validation, next lesson and revoked access.');
}finally{await db.close();}
