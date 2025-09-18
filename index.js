const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');

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

// Growtopia dashboard endpoint (client login için)
app.all('/player/login/dashboard', function (req, res) {
    const tData = {};
    try {
        const uData = JSON.stringify(req.body).split('"')[1].split('\\n'); const uName = uData[0].split('|'); const uPass = uData[1].split('|');
        for (let i = 0; i < uData.length - 1; i++) { const d = uData[i].split('|'); tData[d[0]] = d[1]; }
        if (uName[1] && uPass[1]) { res.redirect('/player/growid/login/validate'); }
    } catch (why) { console.log(`Warning: ${why}`); }

    res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
});

// Growtopia client dashboard response endpoint
app.all('/player/login/dashboard/response', function (req, res) {
    // Generate dynamic values for each client
    const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const randomMac = Array.from({length: 6}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':');
    const randomUUID = Math.random().toString(36).substring(2, 20);
    
    // Create comprehensive ltoken with all parameters
    const tokenData = {
        tankIDName: "",
        tankIDPass: "_register_",
        requestedName: "",
        f: "1",
        protocol: "217",
        game_version: "5.27",
        fz: "22243512",
        cbits: "1024",
        player_age: "25",
        GDPR: "2",
        FCMToken: "",
        category: "_-5100",
        totalPlaytime: "0",
        klv: "4b94632833869b0db08692a9cb5b2b67a4a5139621bd0a89150e10bebb48a4ba",
        hash2: "782839700",
        meta: "AMETSA",
        fhash: "-716928004",
        rid: randomId,
        platformID: "0,1,1",
        deviceVersion: "0",
        country: "tr",
        hash: "1250349998",
        mac: randomMac,
        wk: randomId
    };
    
    const ltoken = Buffer.from(`_token=${JSON.stringify(tokenData)}`).toString("base64");
    
    const resp = [
        `protocol|217`,
        `game_version|5.27`,
        `meta|${timestamp}`,
        `server|31.58.91.112`,
        `port|17777`,
        `type|1`,
        `rid|${randomId}`,
        `gid|`,
        `hash|-716928004`,
        `fhash|-716928004`,
        `country|tr`,
        `wk|${randomId}`,
        `ltoken|${ltoken}`,
        `platformID|0,1,1`,
        `mac|${randomMac}`,
        `player_age|25`,
        `UUIDToken|${randomUUID}`,
        `clientIP|${clientIP}`,
        `timestamp|${timestamp}`,
        ""
    ].join('\n');

    console.log(`[Dashboard] Client ${clientIP} requested dashboard response`);
    console.log(`[Dashboard] Generated ltoken length: ${ltoken.length}`);
    res.send(resp);
});

// Growtopia login endpoint (handles all parameters)
app.all('/player/growid/login', (req, res) => {
    // Get all parameters from request
    const protocol = req.body.protocol;
    const ltoken = req.body.ltoken;
    const requestedName = req.body.requestedName;
    const f = req.body.f;
    const game_version = req.body.game_version;
    const fz = req.body.fz;
    const lmode = req.body.lmode;
    const cbits = req.body.cbits;
    const player_age = req.body.player_age;
    const GDPR = req.body.GDPR;
    const category = req.body.category;
    const totalPlaytime = req.body.totalPlaytime;
    const klv = req.body.klv;
    const hash2 = req.body.hash2;
    const meta = req.body.meta;
    const fhash = req.body.fhash;
    const rid = req.body.rid;
    const platformID = req.body.platformID;
    const deviceVersion = req.body.deviceVersion;
    const country = req.body.country;
    const hash = req.body.hash;
    const mac = req.body.mac;
    const wk = req.body.wk;
    const zf = req.body.zf;
    const growId = req.body.growId;
    const password = req.body.password;
    const _token = req.body._token;
    const OnSendToServer = req.body.OnSendToServer;

    console.log('Full Growtopia Login:', {
        protocol,
        game_version,
        country,
        platformID,
        deviceVersion,
        mac,
        hash,
        klv,
        growId,
        password: password ? '***' : 'missing',
        ltoken,
        rid,
        wk
    });

    // Validate required fields
    if (!growId || !password) {
        return res.status(400).send({
            status: "error",
            message: "Missing growId or password"
        });
    }

    if (protocol !== "217") {
        return res.status(400).send({
            status: "error", 
            message: "Invalid protocol version"
        });
    }

    const token = Buffer.from(
        `_token=${_token}&growId=${growId}&password=${password}&protocol=${protocol}&ltoken=${ltoken}&game_version=${game_version}&country=${country}&platformID=${platformID}&mac=${mac}&hash=${hash}&klv=${klv}`,
    ).toString('base64');

    res.send(
        `{"status":"success","message":"Account Validated.","token":"${token}","url":"","accountType":"growtopia"}`,
    );
});

app.all('/player/growid/login/validate', (req, res) => {
    // Get all parameters from request (same as /player/growid/login)
    const protocol = req.body.protocol;
    const ltoken = req.body.ltoken;
    const requestedName = req.body.requestedName;
    const f = req.body.f;
    const game_version = req.body.game_version;
    const fz = req.body.fz;
    const lmode = req.body.lmode;
    const cbits = req.body.cbits;
    const player_age = req.body.player_age;
    const GDPR = req.body.GDPR;
    const category = req.body.category;
    const totalPlaytime = req.body.totalPlaytime;
    const klv = req.body.klv;
    const hash2 = req.body.hash2;
    const meta = req.body.meta;
    const fhash = req.body.fhash;
    const rid = req.body.rid;
    const platformID = req.body.platformID;
    const deviceVersion = req.body.deviceVersion;
    const country = req.body.country;
    const hash = req.body.hash;
    const mac = req.body.mac;
    const wk = req.body.wk;
    const zf = req.body.zf;
    const growId = req.body.growId;
    const password = req.body.password;
    const _token = req.body._token;
    const OnSendToServer = req.body.OnSendToServer;

    console.log('Login Validate (All Params):', {
        protocol,
        game_version,
        country,
        platformID,
        deviceVersion,
        mac,
        hash,
        klv,
        growId,
        password: password ? '***' : 'missing',
        ltoken,
        rid,
        wk
    });

    // Validate required fields
    if (!growId || !password) {
        return res.status(400).send({
            status: "error",
            message: "Missing growId or password"
        });
    }

    if (protocol && protocol !== "217") {
        return res.status(400).send({
            status: "error", 
            message: "Invalid protocol version"
        });
    }

    const token = Buffer.from(
        `_token=${_token}&growId=${growId}&password=${password}`,
    ).toString('base64');

    res.send(
        `{"status":"success","message":"Account Validated.","token":"${token}","url":"","accountType":"growtopia"}`,
    );
});

app.all('/player/growid/register/validate', (req, res) => {
    const _token = req.body._token;
    const growId = req.body.growId;
    const password = req.body.password;

    const token = Buffer.from(
        `_token=${_token}&growId=${growId}&password=${password}`,
    ).toString('base64');

    res.send(
        `{"status":"success","message":"Account Created Successfully.","token":"${token}","url":"","accountType":"growtopia"}`,
    );
});

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
