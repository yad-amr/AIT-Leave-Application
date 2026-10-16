const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('./auth');
const { validate, validateFile, decide, CHAINS, present } = require('./applications');
const Application = require('./Application');
const Approver = require('./Approver');
test('validation requires reason, accepts optional proof and rejects invalid files and dates', () => {
  const fields = { reason: 'A family appointment', leave_type: 'Personal', from_date: '2026-10-20', to_date: '2026-10-21' };
  assert.equal(validate('LEAVE', fields, ['Personal']).days, 2);
  assert.doesNotThrow(() => validateFile());
  assert.throws(() => validate('LEAVE', { ...fields, reason: '' }, ['Personal']));
  assert.throws(() => validate('LEAVE', { ...fields, to_date: '2026-10-19' }, ['Personal']));
  for (const file of [{ originalname: 'a.exe', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-'), size: 5 }, { originalname: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('fake'), size: 4 }, { originalname: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-'), size: 6*1024*1024 }]) assert.throws(() => validateFile(file));
});
test('rejection at each leave step stops the chain and records the reason', () => {
  for (let reject = 0; reject < 4; reject++) {
    const app = { status: 'SUBMITTED', steps: CHAINS.LEAVE.map(role => ({ role, approver_user_id: 'signer' })), history: [] };
    for (let i=0; i<=reject; i++) decide(app, { sub: 'signer', approver_role: CHAINS.LEAVE[i] }, { decision: i === reject ? 'REJECTED' : 'APPROVED', signature_data: 'Demo Signer', comment: 'Cannot approve dates' });
    assert.equal(app.status,'REJECTED'); assert.equal(app.steps[reject].comment,'Cannot approve dates');
    assert.throws(() => decide(app, { sub: 'signer', approver_role: 'director' }, { decision: 'APPROVED', signature_data: 'Signer' }));
  }
});
test('API: sequential approvals, ownership, urgent visibility, files, cancellation and outpass', async t => {
  const db = await MongoMemoryServer.create(); await mongoose.connect(db.getUri());
  const codes = new Map();
  const users = ['student','other','class.teacher','hod','warden','director'].map((name,i) => ({ id: String(i), name, email: `${name}${i<2 ? '_123456' : ''}@aitpune.edu.in`, role: i<2 ? 'student' : 'faculty', approver_role: i<2 ? undefined : CHAINS.LEAVE[i-2] }));
  const app = createApp({ config: { secret: 'a'.repeat(40), domain:'aitpune.edu.in', otpMs:300000, sessionMs:3600000, origin:'http://localhost:5173' }, users: { findOne: async query => users.find(u => u.email === query.email && u.role === query.role) }, sendMail: async (email,code) => codes.set(email,code) });
  t.after(async () => { app.locals.close(); await mongoose.disconnect(); await db.stop(); });
  await Application.LeaveType.create({ name:'Personal' });
  const directory = await Approver.create(users.slice(2).map((u,i) => ({ user_id:u.id, name:u.name, contact_email:u.email, role:['COUNSELOR','HOD','WARDEN','DIRECTOR'][i], department:'Demo Department' })));
  const selections = { class_teacher_id:String(directory[0]._id), hod_id:String(directory[1]._id), warden_id:String(directory[2]._id) };
  const agents = [];
  for (const u of users) { const agent = request.agent(app); await agent.post('/api/auth/request-otp').send({ email:u.email, role:u.role }).expect(200); await agent.post('/api/auth/verify-otp').send({ email:u.email, role:u.role, otp:codes.get(u.email) }).expect(200); agents.push(agent); }
  const student = agents[0], fields = { reason: 'Family appointment tomorrow', leave_type:'Personal', from_date:'2026-10-20', to_date:'2026-10-21', is_urgent: true, ...selections };
  const created = (await student.post('/api/applications/leave').send(fields).expect(201)).body; const path = `/api/applications/${created.id}`;
  assert.equal(created.current_step_index,0); assert.equal(created.display_state,'IN_PROGRESS'); assert.equal(created.steps.length,4); assert.equal(created.is_urgent,true); assert.equal(created.fields.days,2);
  const denied = await agents[1].get(path).expect(404);
  assert.deepEqual(denied.body,(await student.get('/api/applications/not-an-id').expect(404)).body);
  assert.deepEqual(denied.body,(await student.get('/api/applications/000000000000000000000000').expect(404)).body); await agents[1].post(path+'/cancel').send({}).expect(404);
  await agents[1].get(path+'/proof').expect(404);
  assert.equal((await student.get('/api/applications?urgent=true')).body.applications[0].is_urgent,true);
  assert.equal((await student.get('/api/home/summary')).body.urgent[0].id,created.id);
  const decision = { decision:'APPROVED', signature_data:'Demo Signer' };
  await agents[3].post(path+'/approvals').send(decision).expect(403);
  await student.post(path+'/approvals').send(decision).expect(403);
  for(let i=2;i<6;i++) { const result = await agents[i].post(path+'/approvals').send(decision).expect(200); assert.equal(result.body.status,i===5?'APPROVED':'IN_REVIEW'); assert.equal(result.body.current_step_index,i===5?null:i-1); if(i===2) await student.post(path+'/cancel').send({}).expect(400); }
  const detail = (await student.get(path)).body; assert.equal(detail.history.length,5); assert.equal(detail.steps.length,4);
  const cancel = (await student.post('/api/applications/leave').send(fields)).body;
  await student.post(`/api/applications/${cancel.id}/cancel`).send({}).expect(200);
  await student.post('/api/applications/leave').send({ ...fields, reason:'' }).expect(400);
  await student.post('/api/applications/leave').field('class_teacher_id',selections.class_teacher_id).field('hod_id',selections.hod_id).field('warden_id',selections.warden_id).field('reason',fields.reason).field('leave_type','Personal').field('from_date',fields.from_date).field('to_date',fields.to_date).attach('proof',Buffer.from('fake'),{ filename:'fake.pdf', contentType:'application/pdf' }).expect(400);
  const proof = (await student.post('/api/applications/leave').field('class_teacher_id',selections.class_teacher_id).field('hod_id',selections.hod_id).field('warden_id',selections.warden_id).field('reason',fields.reason).field('leave_type','Personal').field('from_date',fields.from_date).field('to_date',fields.to_date).attach('proof',Buffer.from('%PDF-test'),{ filename:'proof.pdf',contentType:'application/pdf' }).expect(201)).body;
  assert.equal(proof.attachment.data,undefined); await student.get(`/api/applications/${proof.id}/proof`).expect(200);
  const outpass = (await student.post('/api/applications/outpass').send({ reason:'Visit the nearby market', out_at:'2026-10-20T12:00',return_at:'2026-10-20T14:00',destination:'Market',contact:'9876543210',is_urgent:true,warden_id:selections.warden_id }).expect(201)).body;
  assert.equal(outpass.steps.length,1);
  const approved = await agents[4].post(`/api/applications/${outpass.id}/approvals`).send(decision).expect(200); assert.equal(approved.body.status,'APPROVED');
});

test('directory selections, identity checks, inactive approvers and rerunnable seed', async t => {
  const db = await MongoMemoryServer.create(); await mongoose.connect(db.getUri());
  await require('./seed')(); await require('./seed')();
  const User = require('./User');
  const app = createApp({ config: { secret:'x'.repeat(40),domain:'aitpune.edu.in',devMode:true,otpMs:300000,sessionMs:3600000 }, users:User, sendMail:async()=>{} });
  t.after(async()=>{app.locals.close();await mongoose.disconnect();await db.stop()});
  for (const [role,count] of [['COUNSELOR',10],['HOD',5],['WARDEN',10],['DIRECTOR',1]]) assert.equal(await Approver.countDocuments({role}),count);
  const student = request.agent(app);
  await student.post('/api/auth/login').send({email:'student_123456@aitpune.edu.in',role:'student'}).expect(200);
  const list = (await student.get('/api/approvers?role=COUNSELOR').expect(200)).body.approvers;
  assert.equal(list.length,10); assert.deepEqual(Object.keys(list[0]).sort(),['department','id','name','role']);
  await student.get('/api/approvers?role=invalid').expect(400);
  const counselors = await Approver.find({role:'COUNSELOR'}), hod = await Approver.findOne({role:'HOD'}), warden = await Approver.findOne({role:'WARDEN'});
  const fields = {reason:'Family appointment tomorrow',leave_type:'Personal',from_date:'2026-10-20',to_date:'2026-10-21'};
  const selected = {class_teacher_id:String(counselors[0]._id),hod_id:String(hod._id),warden_id:String(warden._id)};
  await student.post('/api/applications/leave').send(fields).expect(400);
  await student.post('/api/applications/leave').send({...fields,...selected,hod_id:String(warden._id)}).expect(400);
  await Approver.updateOne({_id:counselors[1]._id},{$set:{active:false}});
  assert.equal((await student.get('/api/approvers?role=COUNSELOR')).body.approvers.length,9);
  await student.post('/api/applications/leave').send({...fields,...selected,class_teacher_id:String(counselors[1]._id)}).expect(400);
  const appData = (await student.post('/api/applications/leave').send({...fields,...selected}).expect(201)).body;
  assert.equal(appData.steps[0].approver_id,selected.class_teacher_id);
  assert.equal(appData.steps[3].approver_name,'Demo Director A');
  const wrong = request.agent(app); await wrong.post('/api/auth/login').send({email:counselors[2].contact_email,role:'faculty'}).expect(200);
  await wrong.post(`/api/applications/${appData.id}/approvals`).send({decision:'APPROVED',signature_data:'Another Counselor'}).expect(403);
  const right = request.agent(app); await right.post('/api/auth/login').send({email:counselors[0].contact_email,role:'faculty'}).expect(200);
  await right.post(`/api/applications/${appData.id}/approvals`).send({decision:'APPROVED',signature_data:'Selected Counselor'}).expect(200);
  const outpass = {reason:'Visit the nearby market',out_at:'2026-10-20T12:00',return_at:'2026-10-20T14:00',destination:'Market',contact:'9876543210'};
  await student.post('/api/applications/outpass').send(outpass).expect(400);
  await student.post('/api/applications/outpass').send({...outpass,warden_id:[selected.warden_id,selected.warden_id]}).expect(400);
  await student.post('/api/applications/outpass').send({...outpass,...selected}).expect(400);
  const result = (await student.post('/api/applications/outpass').send({...outpass,warden_id:selected.warden_id}).expect(201)).body;
  assert.equal(result.steps.length,1); assert.equal(result.steps[0].approver_id,selected.warden_id);
});

test('presentation derives ordered chains and states for every approval position and terminal status', () => {
  for (const type of ['LEAVE','OUTPASS']) {
    const roles = CHAINS[type];
    for (let count=0;count<=roles.length;count++) {
      const steps=roles.map((role,i)=>({role,decision:i<count?'APPROVED':undefined})).reverse();
      const result=present(new Application({student_id:'student',type,status:count===roles.length?'APPROVED':count?'IN_REVIEW':'SUBMITTED',steps,history:[]}));
      assert.deepEqual(result.steps.map(s=>s.role),roles);
      assert.equal(result.current_step_index,count===roles.length?null:count);
      assert.equal(result.can_cancel,count===0);
      assert.deepEqual(result.steps.map(s=>s.display_state),roles.map((r,i)=>i<count?'APPROVED':i===count?'CURRENT':'PENDING'));
    }
    for(let reject=0;reject<roles.length;reject++) {
      const result=present(new Application({student_id:'student',type,status:'REJECTED',steps:roles.map((role,i)=>({role,decision:i<reject?'APPROVED':i===reject?'REJECTED':undefined})),history:[]}));
      assert.equal(result.current_step_index,null); assert.equal(result.can_cancel,false);
      assert.deepEqual(result.steps.map(s=>s.display_state),roles.map((r,i)=>i<reject?'APPROVED':i===reject?'REJECTED':'STOPPED'));
    }
    const cancelled=present(new Application({student_id:'student',type,status:'CANCELLED',steps:[],history:[]}));
    assert.equal(cancelled.display_state,'CANCELLED'); assert.equal(cancelled.current_step_index,null); assert.equal(cancelled.can_cancel,false);
    assert.ok(cancelled.steps.every(s=>s.display_state==='STOPPED'));
  }
});
