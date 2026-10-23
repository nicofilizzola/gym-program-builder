import {hashPassword} from '../server/auth.js';
// Read from stdin rather than process arguments/shell history.
let password='';for await(const chunk of process.stdin)password+=chunk;
password=password.replace(/\r?\n$/,'');
if(!password)throw new Error('Supply a nonempty password on stdin.');
console.log(await hashPassword(password));
