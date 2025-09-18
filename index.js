const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');
const crypto = require('crypto');

const gameServerIP = "31.58.91.112";   // değiştir
const gameServerPort = "17777";     // değiştir

// compression: /player/growid/* rotalarını sıkıştırmadan geç
app.use(compression({
    level: 5,
    threshold: 0,
    filter: (req, res) => {
        // growid login/register ve dashboard için sıkıştırmayı devre dışı bırak
        if (req.url && (req.url.startsWith('/player/growid') || req.url.startsWith('/player/login/dashboard'))) {
            return false;
        }
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

app.set('view engine', 'ejs');
app.set('trust proxy', 1);

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept',
    );
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url} - ${res.statusCode}`);
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100, headers: true }));

function randomHex(len = 16) {
    return crypto.randomBytes(len).toString('hex').toUpperCase();
}

// Dashboard (aynı kalıyor)
app.all('/player/login/dashboard', function (req, res) {
    const tData = {};
    try {
        const raw = JSON.stringify(req.body);
        const parts = raw.split('"')[1] ? raw.split('"')[1].split('\\n') : [];
        for (let i = 0; i < parts.length; i++) {
            if (!parts[i]) continue;
            const d = parts[i].split('|');
            if (d[0]) tData[d[0]] = d[1] || '';
        }
    } catch (why) { console.log(`Warning: ${why}`); }
    res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
});

// Helper: paket oluştur (CRLF ile)
function buildOnSendPacket(fields) {
    // fields: [{k,v}, ...] sırayı koru
    const lines = fields.map(f => `${f[0]}|${f[1]}`);
    // RTENDMARKERBS1001 mutlaka yeni satırla bitsin
    const body = lines.join('\r\n') + '\r\nRTENDMARKERBS1001\r\n';
    return body;
}

app.all('/player/growid/login/validate', (req, res) => {
    const growId = (req.body && req.body.growId) ? req.body.growId : "_guest_";
    const password = (req.body && req.body.password) ? req.body.password : "";
    const rid = randomHex(16);
    const wk = randomHex(16);
    const mac = `18:c0:4d:${String(Math.floor(Math.random()*90)+10)}:${String(Math.floor(Math.random()*90)+10)}:${String(Math.floor(Math.random()*90)+10)}`;
    const ltoken = Buffer.from(`growId=${growId}&password=${password}`).toString('base64');
    const hash2 = Math.floor(Math.random() * 0x7fffffff);

    const packet = buildOnSendPacket([
        ['server', gameServerIP],
        ['port', gameServerPort],
        ['type', '1'],
        ['#maint', 'Welcome back!'],
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

    // zorunlu: plain-text, bağlanıp parse etmesi için content-length & connection
    res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Connection': 'close',
        'Content-Length': Buffer.byteLength(packet, 'utf8')
    });
    res.send(packet);
});

app.all('/player/growid/register/validate', (req, res) => {
    const growId = (req.body && req.body.growId) ? req.body.growId : "_register_";
    const password = (req.body && req.body.password) ? req.body.password : "1234";
    const rid = randomHex(16);
    const wk = randomHex(16);
    const mac = `18:c0:4d:${String(Math.floor(Math.random()*90)+10)}:${String(Math.floor(Math.random()*90)+10)}:${String(Math.floor(Math.random()*90)+10)}`;
    const ltoken = Buffer.from(`growId=${growId}&password=${password}`).toString('base64');
    const hash2 = Math.floor(Math.random() * 0x7fffffff);

    const packet = buildOnSendPacket([
        ['server', gameServerIP],
        ['port', gameServerPort],
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

// checkToken JSON olarak kalabilir (client bunu parse etmiyor)
app.all('/player/growid/checkToken', (req, res) => {
    try {
        const { refreshToken, clientData } = req.body;
        if (!refreshToken || !clientData) {
            return res.status(400).send({ status: "error", message: "Missing refreshToken or clientData" });
        }
        let decodeRefreshToken = Buffer.from(refreshToken, 'base64').toString('utf-8');
        const token = Buffer.from(decodeRefreshToken.replace(/(_token=)[^&]*/, `$1${Buffer.from(clientData).toString('base64')}`)).toString('base64');
        res.send({ status: "success", message: "Token is valid.", token: token, url: "", accountType: "growtopia" });
    } catch (error) {
        res.status(500).send({ status: "error", message: "Internal Server Error" });
    }
});

app.get('/', function (req, res) { res.send('Hello World!'); });

app.listen(5000, function () {
    console.log('Listening on port 5000');
});
