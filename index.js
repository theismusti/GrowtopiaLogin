const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');
const crypto = require('crypto');

app.set('trust proxy', 1);

// raw body yakalama (bodyParser'dan önce)
app.use((req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => data += chunk);
  req.on('end', () => {
    req.rawBody = data || '';
    next();
  });
});

// compression: growid rotaları için devre dışı bırak
app.use(compression({
  level: 5,
  threshold: 0,
  filter: (req, res) => {
    if (req.url && (req.url.startsWith('/player/growid') || req.url.startsWith('/player/login/dashboard'))) return false;
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100, headers: true }));

app.set('view engine', 'ejs');

// helper: random hex
function randHex(len = 8) {
  return crypto.randomBytes(len).toString('hex').toUpperCase();
}
function randMac() {
  const b = crypto.randomBytes(6);
  return Array.from(b).map(x => x.toString(16).padStart(2,'0')).join(':');
}

// gelen istekten server/port çıkarma
function detectServerPort(req) {
  // 1) parsed body (form/json)
  const body = (req.body && Object.keys(req.body).length) ? req.body : null;
  if (body) {
    if (body.server && body.port) return { server: String(body.server), port: String(body.port) };
    if (body.serverip && body.server_port) return { server: String(body.serverip), port: String(body.server_port) };
    if (body.server_ip && body.serverPort) return { server: String(body.server_ip), port: String(body.serverPort) };
  }

  // 2) raw body içinde "server|..." ve "port|..."
  const raw = (req.rawBody || '').replace(/\\n/g, '\n');
  const serverMatch = raw.match(/server\|([^\r\n]+)/i);
  const portMatch = raw.match(/port\|([^\r\n]+)/i);
  if (serverMatch && portMatch) return { server: serverMatch[1].trim(), port: portMatch[1].trim() };

  // 3) query string
  if (req.query && req.query.server && req.query.port) return { server: String(req.query.server), port: String(req.query.port) };

  // 4) özel header'lar (reverse proxy veya game server koyabilir)
  if (req.headers['x-game-server'] && req.headers['x-game-port']) {
    return { server: req.headers['x-game-server'], port: req.headers['x-game-port'] };
  }

  // 5) host header (host:port)
  if (req.headers.host) {
    const h = req.headers.host.split(':');
    if (h.length === 2) return { server: h[0], port: h[1] };
  }

  // 6) fallback: istemci IP ve default port
  let ip = req.headers['x-forwarded-for'] || req.ip || (req.connection && req.connection.remoteAddress) || '';
  // strip IPv6 prefix
  ip = ip.replace(/^.*:/, '').trim() || '127.0.0.1';
  return { server: ip, port: '17091' };
}

// paket oluşturucu (CRLF ve RTENDMARKER ile)
function buildOnSendPacket(fields) {
  const lines = fields.map(([k,v]) => `${k}|${v}`);
  return lines.join('\r\n') + '\r\nRTENDMARKERBS1001\r\n';
}

// Dashboard (aynı kalıyor)
app.all('/player/login/dashboard', function (req, res) {
  const tData = {};
  try {
    const raw = JSON.stringify(req.body);
    const parts = raw.split('"')[1] ? raw.split('"')[1].split('\\n') : [];
    for (let i = 0; i < parts.length - 1; i++) {
      if (!parts[i]) continue;
      const d = parts[i].split('|');
      if (d[0]) tData[d[0]] = d[1] || '';
    }
    // redirect logic originaliyse bırak
    const uName = parts[0] ? parts[0].split('|') : [];
    const uPass = parts[1] ? parts[1].split('|') : [];
    if (uName[1] && uPass[1]) { res.redirect('/player/growid/login/validate'); return; }
  } catch (e) {
    console.warn(e);
  }
  res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
});

// Login validate -> OnSendToServer (dinamik server/port)
app.all('/player/growid/login/validate', (req, res) => {
  const growId = req.body && req.body.growId ? req.body.growId : (req.query && req.query.growId ? req.query.growId : `_guest_${Math.floor(Math.random()*9999)}`);
  const password = req.body && req.body.password ? req.body.password : '';

  const { server, port } = detectServerPort(req);

  const rid = randHex(8);
  const wk = randHex(16);
  const ltoken = Buffer.from(`growId=${growId}&password=${password}`).toString('base64');
  const hash2 = Math.floor(Math.random() * 0x7fffffff);
  const mac = randMac();

  const packet = buildOnSendPacket([
    ['server', server],
    ['port', port],
    ['type', '1'],
    ['#maint', 'Welcome to Private Server!'],
    ['meta', 'login_success'],
    ['protocol', '217'],
    ['game_version', '5.27'],
    ['rid', rid],
    ['wk', wk],
    ['ltoken', ltoken],
    ['hash2', hash2],
    ['mac', mac],
    ['country', 'tr'],
    ['requestedName', growId],
    ['tankIDName', growId],
    ['tankIDPass', password]
  ]);

  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Connection': 'close',
    'Content-Length': Buffer.byteLength(packet, 'utf8')
  });
  res.send(packet);
});

// Register validate -> OnSendToServer (aynı mantık)
app.all('/player/growid/register/validate', (req, res) => {
  const growId = req.body && req.body.growId ? req.body.growId : `_reg_${Math.floor(Math.random()*9999)}`;
  const password = req.body && req.body.password ? req.body.password : '123';

  const { server, port } = detectServerPort(req);

  const rid = randHex(8);
  const wk = randHex(16);
  const ltoken = Buffer.from(`growId=${growId}&password=${password}`).toString('base64');
  const hash2 = Math.floor(Math.random() * 0x7fffffff);
  const mac = randMac();

  const packet = buildOnSendPacket([
    ['server', server],
    ['port', port],
    ['type', '1'],
    ['#maint', 'Account Created Successfully!'],
    ['meta', 'register_success'],
    ['protocol', '217'],
    ['game_version', '5.27'],
    ['rid', rid],
    ['wk', wk],
    ['ltoken', ltoken],
    ['hash2', hash2],
    ['mac', mac],
    ['country', 'tr'],
    ['requestedName', growId],
    ['tankIDName', growId],
    ['tankIDPass', password]
  ]);

  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Connection': 'close',
    'Content-Length': Buffer.byteLength(packet, 'utf8')
  });
  res.send(packet);
});

// checkToken JSON (aynı kalabilir)
app.all('/player/growid/checkToken', (req, res) => {
  try {
    const { refreshToken, clientData } = req.body;
    if (!refreshToken || !clientData) return res.status(400).send({ status: "error", message: "Missing refreshToken or clientData" });

    let decodeRefreshToken = Buffer.from(refreshToken, 'base64').toString('utf-8');
    const token = Buffer.from(decodeRefreshToken.replace(/(_token=)[^&]*/, `$1${Buffer.from(clientData).toString('base64')}`)).toString('base64');

    res.send({ status: "success", message: "Token is valid.", token: token, url: "", accountType: "growtopia" });
  } catch (e) {
    res.status(500).send({ status: "error", message: "Internal Server Error" });
  }
});

app.get('/', (req, res) => res.send('Hello World!'));

app.listen(process.env.PORT || 5000, () => console.log('Listening'));
