const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');
const crypto = require('crypto');

const gameServerIP = "127.0.0.1";   // Oyun server IP
const gameServerPort = "17777";     // Oyun server Port

app.use(compression({
    level: 5,
    threshold: 0,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
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

// Helper: random string
function randomHex(len = 32) {
    return crypto.randomBytes(len).toString('hex').toUpperCase();
}

// Dashboard
app.all('/player/login/dashboard', function (req, res) {
    const tData = {};
    try {
        const uData = JSON.stringify(req.body).split('"')[1].split('\\n');
        for (let i = 0; i < uData.length - 1; i++) {
            const d = uData[i].split('|');
            tData[d[0]] = d[1];
        }
    } catch (why) { console.log(`Warning: ${why}`); }

    res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
});

// Login validate → OnSendToServer cevabı
app.all('/player/growid/login/validate', (req, res) => {
    const growId = req.body.growId || "_guest_";
    const password = req.body.password || "";
    const rid = randomHex(16);
    const wk = randomHex(16);
    const mac = "18:c0:4d:" + Math.floor(Math.random() * 99) + ":" + Math.floor(Math.random() * 99) + ":" + Math.floor(Math.random() * 99);
    const ltoken = Buffer.from(`growId=${growId}&password=${password}`).toString('base64');

    res.send(
        `server|${gameServerIP}\n` +
        `port|${gameServerPort}\n` +
        `type|1\n` +
        `#maint|Welcome back!\n` +
        `meta|login_success\n` +
        `protocol|217\n` +
        `game_version|5.27\n` +
        `rid|${rid}\n` +
        `wk|${wk}\n` +
        `ltoken|${ltoken}\n` +
        `hash2|${Math.floor(Math.random() * 999999999)}\n` +
        `mac|${mac}\n` +
        `country|tr\n` +
        `requestedName|${growId}\n` +
        `tankIDName|${growId}\n` +
        `tankIDPass|${password}\n` +
        `RTENDMARKERBS1001`
    );
});

// Register validate → OnSendToServer cevabı
app.all('/player/growid/register/validate', (req, res) => {
    const growId = req.body.growId || "_register_";
    const password = req.body.password || "1234";
    const rid = randomHex(16);
    const wk = randomHex(16);
    const mac = "18:c0:4d:" + Math.floor(Math.random() * 99) + ":" + Math.floor(Math.random() * 99) + ":" + Math.floor(Math.random() * 99);
    const ltoken = Buffer.from(`growId=${growId}&password=${password}`).toString('base64');

    res.send(
        `server|${gameServerIP}\n` +
        `port|${gameServerPort}\n` +
        `type|1\n` +
        `#maint|Account Created Successfully!\n` +
        `meta|register_success\n` +
        `protocol|217\n` +
        `game_version|5.27\n` +
        `rid|${rid}\n` +
        `wk|${wk}\n` +
        `ltoken|${ltoken}\n` +
        `hash2|${Math.floor(Math.random() * 999999999)}\n` +
        `mac|${mac}\n` +
        `country|tr\n` +
        `requestedName|${growId}\n` +
        `tankIDName|${growId}\n` +
        `tankIDPass|${password}\n` +
        `RTENDMARKERBS1001`
    );
});

// Token kontrol
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

app.listen(5000, function () {
    console.log('Listening on port 5000');
});
