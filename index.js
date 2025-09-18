// index.js (güncellenmiş, orijinal yapıya sadık)
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');
const crypto = require('crypto');
const path = require('path');

const DEFAULT_GAME_PORT = process.env.GAME_PORT || '17777';
const DEFAULT_GAME_SERVER = process.env.GAME_SERVER || ''; // isteğe bağlı; boşsa isteğe göre algılanacak

app.use(compression({
    level: 5,
    threshold: 0,
    filter: (req, res) => {
        // /player/growid/* ve dashboard cevaplarını sıkıştırma (client sıkıştırmayı işleyemeyebilir)
        if (req.url && (req.url.startsWith('/player/growid') || req.url.startsWith('/player/login/dashboard'))) {
            return false;
        }
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

app.set('view engine', 'ejs');
app.set('trust proxy', 1);

// statik / public klasörün varsa kullanabilirsin (opsiyonel)
// app.use(express.static(path.join(__dirname, 'public')));

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept',
    );
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url} - ${res.statusCode}`);
    next();
});

// Orijinal kodun kullandığı body-parser biçimi korunuyor
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100, headers: true }));

// Helpers
function randHex(len = 8) {
    return crypto.randomBytes(len).toString('hex').toUpperCase();
}
function randMac() {
    const b = crypto.randomBytes(6);
    return Array.from(b).map(x => x.toString(16).padStart(2,'0')).join(':');
}
function buildOnSendPacket(fields) {
    // fields: array of [key, value] pairs; return CRLF-terminated body + RTENDMARKER
    const lines = fields.map(([k,v]) => `${k}|${v}`);
    return lines.join('\r\n') + '\r\nRTENDMARKERBS1001\r\n';
}
// Try detect server/port from many possible places (body, query, headers, host, forwarded-for)
function detectServerPort(req) {
    // 1) parsed body (form/json)
    const body = (req.body && Object.keys(req.body).length) ? req.body : null;
    if (body) {
        if (body.server && body.port) return { server: String(body.server), port: String(body.port) };
        if (body.serverip && body.server_port) return { server: String(body.serverip), port: String(body.server_port) };
        if (body.server_ip && body.serverPort) return { server: String(body.server_ip), port: String(body.serverPort) };
        // also sometimes client sends OnSendToServer like data in a field; we don't parse that here
    }

    // 2) query
    if (req.query && req.query.server && req.query.port) return { server: String(req.query.server), port: String(req.query.port) };

    // 3) headers inserted by reverse-proxy / game-server
    if (req.headers['x-game-server'] && req.headers['x-game-port']) {
        return { server: req.headers['x-game-server'], port: req.headers['x-game-port'] };
    }

    // 4) host header (may contain host:port)
    if (req.headers.host) {
        const h = req.headers.host.split(':');
        if (h.length === 2) return { server: h[0], port: h[1] };
    }

    // 5) fallback: env GAME_SERVER, else use requester ip and default port
    let ip = DEFAULT_GAME_SERVER;
    if (!ip) {
        ip = req.headers['x-forwarded-for'] || req.ip || (req.connection && req.connection.remoteAddress) || '';
        // if IPv6 like ::ffff:31.142.8.54, strip prefix
        ip = ip.replace(/^.*:/, '').trim();
        if (!ip) ip = '127.0.0.1';
    }
    const port = DEFAULT_GAME_PORT || '17777';
    return { server: ip, port: String(port) };
}

// ---------------- ROUTES (orijinal yapıya uygun) ----------------

// Dashboard (orijinal kodla uyumlu)
app.all('/player/login/dashboard', function (req, res) {
    const tData = {};
    try {
        // Orjinal parsing metodunu korudum (kırılgan ama senin orijinal kodla uyumlu)
        const uData = JSON.stringify(req.body).split('"')[1].split('\\n');
        const uName = uData[0].split('|');
        const uPass = uData[1].split('|');
        for (let i = 0; i < uData.length - 1; i++) {
            const d = uData[i].split('|');
            tData[d[0]] = d[1];
        }
        if (uName[1] && uPass[1]) {
            // Orijinal davranışı koru: redirect ediyordu
            res.redirect('/player/growid/login/validate');
            return;
        }
    } catch (why) { console.log(`Warning: ${why}`); }

    // Orijinal tam path ile render (senin istediğin şekil)
    res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
});

// Login validate -> OnSendToServer plain-text (client bekler)
app.all('/player/growid/login/validate', (req, res) => {
    const _token = req.body._token || '';
    const growId = req.body.growId || `_guest_${Math.floor(Math.random()*9999)}`;
    const password = req.body.password || '';

    // token oluşturulma biçimi (orijinale uygun)
    const ltoken = Buffer.from(`_token=${_token}&growId=${growId}&password=${password}`).toString('base64');

    const { server, port } = detectServerPort(req);

    const rid = randHex(8);
    const wk = randHex(16);
    const mac = randMac();
    const hash2 = Math.floor(Math.random() * 0x7fffffff);

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

// Register validate -> aynı şekilde OnSendToServer dön (orijinalde JSON dönüyordu; artık client için uygun formda)
app.all('/player/growid/register/validate', (req, res) => {
    const _token = req.body._token || '';
    const growId = req.body.growId || `_reg_${Math.floor(Math.random()*9999)}`;
    const password = req.body.password || '123';

    const ltoken = Buffer.from(`_token=${_token}&growId=${growId}&password=${password}`).toString('base64');

    const { server, port } = detectServerPort(req);

    const rid = randHex(8);
    const wk = randHex(16);
    const mac = randMac();
    const hash2 = Math.floor(Math.random() * 0x7fffffff);

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

// checkToken (orijinal JSON davranışı korunuyor)
app.all('/player/growid/checkToken', (req, res) => {
    try {
        const { refreshToken, clientData } = req.body;

        if (!refreshToken || !clientData) {
            return res.status(400).send({ status: "error", message: "Missing refreshToken or clientData" });
        }

        let decodeRefreshToken = Buffer.from(refreshToken, 'base64').toString('utf-8');

        const token = Buffer.from(decodeRefreshToken.replace(/(_token=)[^&]*/, `$1${Buffer.from(clientData).toString('base64')}`)).toString('base64');

        res.send({
            status: "success",
            message: "Token is valid.",
            token: token,
            url: "",
            accountType: "growtopia"
        });
    } catch (error) {
        res.status(500).send({ status: "error", message: "Internal Server Error" });
    }
});

app.get('/', function (req, res) {
    res.send('Hello World!');
});

// Orijinal gibi app.listen (local test için). Eğer Vercel'de kullanacaksan module.exports = app yap.
// app.listen(5000, function () {
//     console.log('Listening on port 5000');
//});

module.exports = app;
