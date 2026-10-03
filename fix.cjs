const fs=require('fs');
const path=require('path');
function r(d){
  for(let f of fs.readdirSync(d)){
    let p=path.join(d,f);
    if(fs.statSync(p).isDirectory()) r(p);
    else if(p.endsWith('.jsx')){
      let c=fs.readFileSync(p,'utf-8');
      c=c.replace(/\\\$\\{/g,'${');
      c=c.replace(/\\`/g,'`');
      fs.writeFileSync(p,c);
    }
  }
}
r('D:/hackathon/frontend/src');
