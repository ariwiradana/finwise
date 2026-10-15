import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
const COOKIE='finwise_session';
function key(){const secret=process.env.SESSION_SECRET;if(!secret||secret.length<32)throw new Error('SESSION_SECRET minimal 32 karakter harus disetel');return new TextEncoder().encode(secret)}
export async function createSession(userId:string){const token=await new SignJWT({sub:userId}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('30d').sign(key());const store=await cookies();store.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*24*30})}
export async function getSessionUserId(){try{const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;const {payload}=await jwtVerify(token,key());return typeof payload.sub==='string'?payload.sub:null}catch{return null}}
export async function clearSession(){(await cookies()).delete(COOKIE)}
