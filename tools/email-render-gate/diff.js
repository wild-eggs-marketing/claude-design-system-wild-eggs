const { chromium } = require("playwright-core")
const http=require("http"),fs=require("fs"),path=require("path")
const SITE=path.join(__dirname,"site"),PORT=8790
const MIME={".html":"text/html",".png":"image/png",".jpg":"image/jpeg"}
const s=http.createServer((q,r)=>{const f=path.join(SITE,decodeURIComponent(q.url.split("?")[0]));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}
  r.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)})
s.listen(PORT,"127.0.0.1",async()=>{
  const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args:["--no-sandbox","--no-proxy-server","--hide-scrollbars"]})
  const tag=process.argv[2]
  for(const [name,w,h] of [["m900",900,1200],["w900",900,1200],["m375",375,900]]){
    const file = name==="w900" ? "word.html" : "modern.html"
    // reducedMotion freezes the animation layer, which is the only non-deterministic
    // thing on the page. Without it an infinite keyframe makes every capture differ.
    const p=await b.newPage({viewport:{width:w,height:h},reducedMotion:"reduce"})
    await p.goto(`http://127.0.0.1:${PORT}/${file}`,{waitUntil:"networkidle"})
    await p.waitForTimeout(1200)
    await p.screenshot({path:path.join(__dirname,`diff-${tag}-${name}.png`),fullPage:true})
    await p.close()
  }
  await b.close(); s.close(); console.log("captured "+tag)
})
