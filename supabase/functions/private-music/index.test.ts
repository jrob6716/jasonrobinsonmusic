// Real handler/SDK against a mocked transport; PostgreSQL behavior is tested separately.
Deno.env.set('SUPABASE_URL', 'https://private-music-test.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
const id='8b8a1aa1-1111-4111-8111-111111111111';
const versionId='8b8a1aa1-1111-4111-8111-222222222222';
const code='a'.repeat(64);
let mode='valid'; let storageCalls=0; let listenCalls=0; let savedShare: Record<string,unknown> | null=null;
const track={id,title:'Song one',subtitle:'Demo',storage_path:`${id}.mp3`,current_version_id:versionId,deleted_at:null};
const realFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const url=new URL(String(input)); const path=url.pathname;
 const body=typeof init?.body==='string'?JSON.parse(init.body):{};
 let result:unknown;
 if(path.includes('/auth/v1/user')) result={id,aud:'authenticated'};
 else if(path.includes('/private_music_admins')) result=mode==='non-admin'?null:{user_id:id};
 else if(path.includes('/private_music_shares')) {
  if(url.searchParams.get('id')?.startsWith('eq.') && savedShare) result=savedShare;
  else result=mode==='missing'?null:{id,title:'A private song',recipient_label:'Internal recipient',message:'A mix for you',track_ids:[id],token_encrypted:'never-public',revoked_at:mode==='revoked'?'2026-01-01':null,expires_at:mode==='expired'?'2000-01-01':null};
 }
 else if(path.includes('/private_music_tracks')) result=url.searchParams.get('id')?.startsWith('eq.')?track:[track];
 else if(path.includes('/private_music_versions')) result=url.searchParams.get('id')?.startsWith('eq.')?{id:versionId}:[{storage_path:track.storage_path}];
 else if(path.includes('/private_music_visits')) result=null;
 else if(path.includes('/rpc/private_music_record_listen')) {listenCalls++;result=null;}
 else if(path.includes('/rpc/private_music_save_share')) {savedShare={id:body.p_id,token_hash:body.p_hash,token_encrypted:body.p_encrypted};result=null;}
 else if(path.includes('/rpc/private_music_')) result=null;
 else if(path.includes('/storage/v1/object/upload/sign/')) result={url:'/object/upload/sign/private-music/test.mp3?token=upload-token'};
 else if(path.includes('/storage/v1/object/sign/')) {storageCalls++;result={signedURL:'/object/sign/private-music/test.mp3?token=short-lived'};}
 else if(path.includes('/storage/v1/object/private-music')) result=[];
 else throw new Error(`Unexpected test request: ${url}`);
 return Promise.resolve(new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}}));
};
const {handleRequest}=await import('./handler.ts');
function assert(value:unknown,message:string){if(!value)throw new Error(message);}
function call(body:unknown,signedIn=false){return handleRequest(new Request('https://test/functions/v1/private-music',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://dirtyfreqs.com',...(signedIn?{Authorization:'Bearer user-token'}:{})},body:JSON.stringify(body)}));}
Deno.test('private access, management, link encryption and analytics boundaries',async()=>{
 try{
  let response=await call({action:'resolve',token:code}); const data=await response.json();
  assert(response.status===200 && data.tracks.length===1 && data.tracks[0].versionId===versionId,'valid original link returns only its song and current version');
  assert(!JSON.stringify(data).includes('token_encrypted') && !JSON.stringify(data).includes('Internal recipient') && !JSON.stringify(data).includes('storage_path'),'internal fields stay private');
  for(const state of ['missing','revoked','expired']){
   mode=state;storageCalls=0;
   for(const action of ['resolve','visit','listen']){
    response=await call({action,token:code,sessionId:id,trackId:id,versionId,seconds:10,coverage:10,duration:100});
    assert(response.status===404 && storageCalls===0,`${state} link cannot obtain audio or write activity`);
   }
  }
  response=await call({action:'resolve',token:'guess'});assert(response.status===404,'invalid code rejected');
  mode='valid';
  const adminActions=['list','upload','save-track','create-share','edit-share','copy-share','revoke','preview','edit-track','archive-track','delete-track','restore-version'];
  for(const action of adminActions){response=await call({action});assert(response.status===401,`anonymous ${action} rejected`);}
  mode='non-admin';
  for(const action of adminActions){response=await call({action},true);assert(response.status===403,`signed-in non-admin ${action} rejected`);}
  mode='valid';
  response=await call({action:'upload',title:'Demo',subtitle:'',extension:'mp3'},true);const upload=await response.json();
  assert(response.status===200 && upload.path===`${upload.id}/${upload.versionId}.mp3`,'new upload gets immutable version path');
  response=await call({action:'upload',trackId:id,extension:'mp3'},true);const replacement=await response.json();
  assert(response.status===200 && replacement.id===id && replacement.expectedVersion===versionId,'replacement keeps song ID and protects against concurrent changes');
  response=await call({action:'save-track',id,versionId,expectedVersion:null,path:'another-song.mp3',title:'Demo',subtitle:'',label:'First'},true);
  assert(response.status===400,'cannot attach unrelated object');
  response=await call({action:'save-track',...upload,title:'Demo',subtitle:'',label:'First'},true);assert(response.status===200,'valid upload can commit');
  response=await call({action:'upload',title:'Demo',subtitle:'',extension:'html'},true);assert(response.status===400,'non-audio upload denied');
  const selection={title:'test',recipientLabel:'Alex',message:'Hello',expiresAt:null};
  response=await call({action:'create-share',...selection,trackIds:[id,id]},true);assert(response.status===400,'duplicates rejected');
  response=await call({action:'create-share',...selection,trackIds:[id],expiresAt:'2000-01-01'},true);assert(response.status===400,'past expiry rejected');
  response=await call({action:'create-share',...selection,trackIds:[id]},true);const created=await response.json();
  assert(response.status===200 && /^[a-f0-9]{64}$/.test(created.token),'admin receives random code');
  const saved=savedShare as unknown as Record<string,string>;
  assert(saved.token_encrypted!==created.token && !saved.token_encrypted.includes(created.token),'code encrypted at rest');
  response=await call({action:'copy-share',id:saved.id},true);assert((await response.json()).token===created.token,'admin can retrieve identical link');
  response=await call({action:'visit',token:code,sessionId:id});assert(response.status===200,'valid share records visit');
  response=await call({action:'listen',token:code,sessionId:id,trackId:id,versionId,seconds:15,coverage:15,duration:100});assert(response.status===200 && listenCalls===1,'valid selected song records cumulative listen');
  response=await call({action:'listen',token:code,sessionId:id,trackId:versionId,versionId,seconds:15,coverage:15,duration:100});assert(response.status===400 && listenCalls===1,'unshared song event rejected');
  response=await call({action:'delete-track',id,confirmTitle:'wrong'},true);assert(response.status===400,'deletion requires exact title');
  response=await handleRequest(new Request('https://test',{method:'POST',headers:{Origin:'https://other.test'},body:'{}'}));assert(response.status===403,'foreign browser origin rejected');
  response=await handleRequest(new Request('https://test'));assert(response.status===405,'GET denied');assert(response.headers.get('Cache-Control')==='no-store','not cached');
 }finally{globalThis.fetch=realFetch;}
});
