import {scrypt as scryptCallback,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {domainError} from './repository.js';
const scrypt=promisify(scryptCallback),WINDOW=15*60*1000,EXPIRY=30*86400000;
export async function hashPassword(password) {const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64);return `scrypt:${salt}:${hash.toString('hex')}`;}
export function createAuth({db,passwordHash,authSecret,now=Date.now,randomBytes:random=randomBytes}) {
  if(!passwordHash||!authSecret)throw new Error('Authentication is not configured.');
  const digest=value=>createHmac('sha256',authSecret).update(value).digest('hex');
  const cookieToken=cookie=>cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('gym_session='))?.slice(12);
  return {
    async login(password,ip,secure=true) {
      const bucket=digest(ip||'unknown'),time=now();
      // Reserve an attempt atomically before the expensive password check, including across instances.
      const tx=await db.transaction('write');
      try {
        await tx.execute({sql:'DELETE FROM login_attempts WHERE window_start<=?',args:[time-WINDOW]});
        const r=await tx.execute({sql:'SELECT failures FROM login_attempts WHERE bucket=?',args:[bucket]});
        if(r.rows[0]?.failures>=5)throw domainError('RATE_LIMIT','Too many attempts. Try again in 15 minutes.');
        await tx.execute({sql:'INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET failures=failures+1',args:[bucket,time]});
        await tx.commit();
      } finally {tx.close();}
      const [type,salt,hex]=passwordHash.split(':');
      if(type!=='scrypt'||!salt||!hex)throw new Error('Invalid password configuration.');
      const expected=Buffer.from(hex,'hex'),actual=await scrypt(typeof password==='string'?password:'',salt,64);
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw domainError('UNAUTHORIZED','Incorrect password.');
      const token=random(32).toString('hex');
      await db.batch([{sql:'DELETE FROM login_attempts WHERE bucket=?',args:[bucket]},{sql:'DELETE FROM auth_sessions WHERE expires_at<=?',args:[time]},{sql:'INSERT INTO auth_sessions VALUES(?,?)',args:[digest(token),time+EXPIRY]}],'write');
      return `gym_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${EXPIRY/1000}${secure?'; Secure':''}`;
    },
    async session(cookie) {const token=cookieToken(cookie);if(!token)return false;const r=await db.execute({sql:'SELECT expires_at FROM auth_sessions WHERE token_hash=?',args:[digest(token)]});return Boolean(r.rows[0]&&r.rows[0].expires_at>now());},
    async logout(cookie,secure=true) {const token=cookieToken(cookie);if(token)await db.execute({sql:'DELETE FROM auth_sessions WHERE token_hash=?',args:[digest(token)]});return `gym_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`;}
  };
}
