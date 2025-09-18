const express = require("express");
const compression = require("compression");
const rateLimiter = require("express-rate-limit");
const path = require("path");

const app = express();

app.use(
  compression({
    level: 5,
    threshold: 0,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "ejs");
app.set("trust proxy", 1);

// CORS + log
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  console.log(
    `[${new Date().toLocaleString()}] ${req.method} ${req.url} - ${res.statusCode}`
  );
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100, headers: true }));

// Growtopia server_data.php endpoint
app.all("/growtopia/server_data.php", (req, res) => {
  const gameIP = "31.58.91.112"; // senin oyun sunucusu IP
  const gamePort = 17777;

  const response = `
server|${gameIP}
port|${gamePort}
type|1
loginurl|https://${req.headers.host}/player/login/dashboard
  `;

  res.send(response);
});

// Dashboard
app.all("/player/login/dashboard", (req, res) => {
  const tData = {};
  try {
    if (req.body) {
      const raw = JSON.stringify(req.body).split('"')[1]?.split("\\n") || [];
      for (let i = 0; i < raw.length; i++) {
        const d = raw[i].split("|");
        if (d[0]) tData[d[0]] = d[1] || "";
      }
    }
  } catch (err) {
    console.log("Warning:", err);
  }
  res.render("dashboard", { data: tData });
});

// Validate login
app.all("/player/growid/login/validate", (req, res) => {
  const { _token, growId, password } = req.body;
  const token = Buffer.from(
    `_token=${_token}&growId=${growId}&password=${password}`
  ).toString("base64");

  res.json({
    status: "success",
    message: "Account Validated.",
    token,
    url: "",
    accountType: "growtopia",
  });
});

// Register validate
app.all("/player/growid/register/validate", (req, res) => {
  const { _token, growId, password } = req.body;
  const token = Buffer.from(
    `_token=${_token}&growId=${growId}&password=${password}`
  ).toString("base64");

  res.json({
    status: "success",
    message: "Account Created Successfully.",
    token,
    url: "",
    accountType: "growtopia",
  });
});

// Token check
app.all("/player/growid/checkToken", (req, res) => {
  try {
    const { refreshToken, clientData } = req.body;
    if (!refreshToken || !clientData) {
      return res
        .status(400)
        .send({ status: "error", message: "Missing refreshToken or clientData" });
    }

    let decodeRefreshToken = Buffer.from(refreshToken, "base64").toString("utf-8");

    const token = Buffer.from(
      decodeRefreshToken.replace(
        /(_token=)[^&]*/,
        `$1${Buffer.from(clientData).toString("base64")}`
      )
    ).toString("base64");

    res.send({
      status: "success",
      message: "Token is valid.",
      token,
      url: "",
      accountType: "growtopia",
    });
  } catch (error) {
    res.status(500).send({ status: "error", message: "Internal Server Error" });
  }
});

// Root test
app.get("/", (req, res) => res.send("Hello from Growtopia Login Server (Vercel)"));

module.exports = app;
