const http = require("http"), fs = require("fs"), p = require("path")
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }
const ROOT = p.resolve(__dirname, "site")
module.exports = function start(port) {
  const s = http.createServer((req, res) => {
    let f = p.join(ROOT, decodeURIComponent(req.url.split("?")[0]))
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = p.join(f, "index.html")
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end("nope") }
    res.writeHead(200, { "content-type": TYPES[p.extname(f)] || "application/octet-stream" })
    fs.createReadStream(f).pipe(res)
  })
  return new Promise((r) => s.listen(port, "127.0.0.1", () => r(s)))
}
