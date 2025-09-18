const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const rateLimiter = require('express-rate-limit');
const compression = require('compression');
const path = require('path');

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

app.set('views', path.join(__dirname, '/public/html'));
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

// Growtopia client için gerekli
app.all('/growtopia/server_data.php', function (req, res) {
    const gameIP = "31.58.91.112"; // senin VDS IP
    const gamePort = 17777;        // senin server portu

    const response = `
server|${gameIP}
port|${gamePort}
type|1
loginurl|https://${req.headers.host}/player/login/dashboard
`;
    res.send(response);
});

// Dashboard
app.all('/player/login/dashboard', function (req, res) {
    const tData = {};
    try {
        const raw = JSON.stringify(req.body).split('"')[1]?.split('\\n') || [];
        for (let i = 0; i < raw.length; i++) {
            const d = raw[i].split('|');
            if (d[0]) tData[d[0]] = d[1] || "";
        }
    } catch (why) {
        console.log(`Warning: ${why}`);
    }

    // Eğer Growtopia client bağlandıysa
    if (req.headers['user-agent']?.includes("Growtopia") || Object.keys(tData).length > 0) {
        const resp = [
            `protocol|217`,
            `game_version|5.27`,
            `meta|${Date.now()}`,
            `server|31.58.91.112`,
            `port|17777`,
            `type|1`,
            `rid|${Math.random().toString(36).substring(7)}`,
            `gid|`,
            `hash|-716928004`,
            `fhash|-716928004`,
            `country|tr`,
            `wk|${Math.random().toString(36).substring(2, 15)}`,
            `ltoken|${Buffer.from("_register_").toString("base64")}`,
            `platformID|0,1,1`,
            `mac|${Math.random().toString(36).substring(2, 17)}`,
            `player_age|25`,
            `UUIDToken|${Math.random().toString(36).substring(2, 20)}`,
            ""
        ].join("\n");
        return res.send(resp);
    }

    // Normal tarayıcıdan açılıyorsa
    res.render(__dirname + '/public/html/dashboard.ejs', { data: tData });
});

// GrowID Login Validate
app.all('/player/growid/login/validate', (req, res) => {
    const _token = req.body._token;
    const growId = req.body.growId;
    const password = req.body.password;

    const token = Buffer.from(
        `_token=${_token}&growId=${growId}&password=${password}`,
    ).toString('base64');

    res.send(
        `{"status":"success","message":"Account Validated.","token":"${token}","url":"","accountType":"growtopia"}`,
    );
});

// GrowID Register Validate
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

// Token Check
app.all('/player/growid/checkToken', (req, res) => {
    try {
        const { refreshToken, clientData } = req.body;

        if (!refreshToken || !clientData) {
            return res.status(400).send({ status: "error", message: "Missing refreshToken or clientData" });
        }

        let decodeRefreshToken = Buffer.from(refreshToken, 'base64').toString('utf-8');

        const token = Buffer.from(
            decodeRefreshToken.replace(/(_token=)[^&]*/, `$1${Buffer.from(clientData).toString('base64')}`)
        ).toString('base64');

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

// Root
app.get('/', function (req, res) {
    res.send('Hello from Growtopia Login Server!');
});

// Dinleme
app.listen(5000, function () {
    console.log('Listening on port 5000');
});
