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

app.all('/player/login/dashboard', function (req, res) {
    const tData = {};
    try {
        const uData = JSON.stringify(req.body).split('"')[1].split('\\n'); const uName = uData[0].split('|'); const uPass = uData[1].split('|');
        for (let i = 0; i < uData.length - 1; i++) { const d = uData[i].split('|'); tData[d[0]] = d[1]; }
        if (uName[1] && uPass[1]) { res.redirect('/player/growid/login/validate'); }
    } catch (why) { console.log(`Warning: ${why}`); }

    res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
});

app.all('/player/growid/login/validate', (req, res) => {
    // Growtopia protocol parameters
    const protocol = req.body.protocol;
    const ltoken = req.body.ltoken;
    const requestedName = req.body.requestedName;
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
    const isLoginPage = req.body.isLoginPage;

    console.log('Login attempt:', {
        protocol,
        growId,
        game_version,
        country,
        platformID,
        deviceVersion,
        mac,
        hash,
        klv
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

app.all('/player/growid/register/validate', (req, res) => {
    // Growtopia protocol parameters
    const protocol = req.body.protocol;
    const ltoken = req.body.ltoken;
    const requestedName = req.body.requestedName;
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
    const isLoginPage = req.body.isLoginPage;

    console.log('Register attempt:', {
        protocol,
        growId,
        game_version,
        country,
        platformID,
        deviceVersion,
        mac,
        hash,
        klv
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
