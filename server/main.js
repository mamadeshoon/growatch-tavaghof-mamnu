const ip = require("ip");
const mqtt = require("mqtt");
const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require('sqlite3').verbose();
const Ghasedak = require('ghasedak');

const GHASEDAK_API_KEY = ""; // INSERT API KEY

const ghasedak = new Ghasedak(GHASEDAK_API_KEY);
const app = express();
const BROKER_PORT = 1883;
const BROKER_ADDR = "mqtt://broker.mqtt-dashboard.com";
const APP_PORT = 3000;

const sensors = {
    temp: {
        min: 0,
        max: 50,
        statusTime: null
    },
    hum: {
        min: 0,
        max: 100,
        statusTime: null
    }
};
const settings = { temp: { min: 0, max: 50 }, hum: { min: 0, max: 100 } };
const data = { sec: { temp: [], hum: [] }, min: { temp: [], hum: [] } };
const last60mins = { temp: [], hum: [] };
const alert = { temp: 0, hum: 0 };

const db = new sqlite3.Database("data.sqlite3", (err) => {
    if (err) {
        throw err;
        process.exit();
    }
});

let sqlParam = ["temp/min", "temp/max", "hum/min", "hum/max"];
db.all("SELECT key, value FROM Settings WHERE key IN (?, ?, ?, ?)", sqlParam, (err, rows) => {
    rows.forEach(e => {
        if (e.key === "temp/min")
            settings.temp.min = parseInt(e.value);
        else if (e.key === "temp/max")
            settings.temp.max = parseInt(e.value);
        else if (e.key === "hum/min")
            settings.hum.min = parseInt(e.value);
        else if (e.key === "hum/max")
            settings.hum.max = parseInt(e.value);
    });
});

process.on('exit', (code) => {
    db.close();
});

setInterval(() => {
    let sum = 0;
    for (let i = 0; i < data.sec.temp.length; i++) {
        sum += data.sec.temp[i];
    }
    if (data.sec.temp.length) {
        data.min.temp.push(sum / data.sec.temp.length);

        last60mins.temp.push(sum / data.sec.temp.length);
        data.sec.temp = [];
        if (last60mins.temp.length > 60)
            last60mins.temp.shift();
        //console.log(last60mins.temp);
    }
    else {
        //console.log(last60mins.temp.length);
        data.min.temp.push(NaN);

        last60mins.temp.push(NaN);
        if (last60mins.temp.length > 60)
            last60mins.temp.shift();
    }

    sum = 0;
    for (let i = 0; i < data.sec.hum.length; i++) {
        sum += data.sec.hum[i];
    }
    if (data.sec.hum.length) {
        data.min.hum.push(sum / data.sec.hum.length);

        last60mins.hum.push(sum / data.sec.hum.length);
        data.sec.hum = [];
        if (last60mins.hum.length > 60)
            last60mins.hum.shift();
    }
    else {
        data.min.hum.push(NaN);

        last60mins.hum.push(NaN);
        if (last60mins.hum.length > 60)
            last60mins.hum.shift();
    }
}, 60 * 1000);

setInterval(() => {
    let sum = 0;
    let flag = false;
    for (let i = 0; i < data.min.temp.length; i++) {
        if (data.min.temp[i] !== NaN) {
            sum += data.min.temp[i];
            flag = true;
        }
    }
    if (flag) {
        let sql = "INSERT INTO Temperature (value, timestamp) VALUES(?, ?)";
        db.run(sql, [sum / data.min.temp.length, Date.now().toString()]);
    }
    data.min.temp = [];

    sum = 0;
    flag = false;
    for (let i = 0; i < data.min.hum.length; i++) {
        if (data.min.hum[i] !== NaN) {
            sum += data.min.hum[i];
            flag = true;
        }
    }
    if (flag) {
        let sql = "INSERT INTO Humidity (value, timestamp) VALUES(?, ?)";
        db.run(sql, [sum / data.min.hum.length, Date.now().toString()]);
    }
    data.min.hum = [];
}, 60 * 60 * 1000);

function inRange(num, lower, upper) {
    if (num > upper)
        return 2;
    if (num == upper)
        return 1;
    if (num == lower)
        return -1;
    if (num < lower)
        return -2;
    return 0;
}

function mapHour2Arr(list) {
    let arr = new Array(24);
    for (let i = 0; i < list.length; i++) {
        let hour = new Date(parseInt(list[i].timestamp)).getHours();
        arr[hour] = list[i].value;
    }
    return arr;
}

const client = mqtt.connect(`${BROKER_ADDR}:${BROKER_PORT}`);

client.on('connect', () => {
    client.subscribe("golkhoone/alive", { qos: 1 });
    client.subscribe("golkhoone/temp/live", { qos: 1 });
    client.subscribe("golkhoone/hum/live", { qos: 1 });
});

client.on('message', (topic, message) => {
    message = message.toString();
    //console.log(topic, message, data.sec.temp.length, data.sec.hum.length);
    if (topic === "golkhoone/alive") {
        client.publish("golkhoone/temp/min", settings.temp.min.toString(), { qos: 1 });
        client.publish("golkhoone/temp/max", settings.temp.max.toString(), { qos: 1 });
        client.publish("golkhoone/hum/min", settings.hum.min.toString(), { qos: 1 });
        client.publish("golkhoone/hum/max", settings.hum.max.toString(), { qos: 1 });
    }

    if (topic === "golkhoone/temp/live") {
        let m = "";
        message = parseInt(message);
        data.sec.temp.push(message);
        sensors.temp.statusTime = Date.now();

        let stat = inRange(message, settings.temp.min, settings.temp.max);
        if (stat == 2) {
            if (alert.temp != stat) {
                alert.temp = stat;
                m = `خطر! دما از مرز ${settings.temp.max} بیشتر شد. دما: ${message}`;
            }
        }
        if (stat == 1) {
            if (alert.temp == 0) {
                alert.temp = 1;
                m = `هشدار! دما به مرز ${settings.temp.max} رسید`;
            }
            if (alert.temp == 2) {
                alert.temp = 1;
                m = `دما به مرز ${settings.temp.max} بازگشت`;
            }
        }
        if (stat == 0) {
            if (alert.temp == 1 || alert.temp == 2) {
                alert.temp = 0;
                m = `دما از مرز ${settings.temp.max} کمتر شد. دما: ${message}`;
            }
            if (alert.temp == -1 || alert.temp == -2) {
                alert.temp = 0;
                m = `دما از مرز ${settings.temp.min} بیشتر شد. دما: ${message}`;
            }
        }
        if (stat == -1) {
            if (alert.temp == 0) {
                alert.temp = -1;
                m = `هشدار! دما به مرز ${settings.temp.min} رسید`;
            }
            if (alert.temp == -2) {
                alert.temp = -1;
                m = `دما به مرز ${settings.temp.min} بازگشت`;
            }
        }
        if (stat == -2) {
            if (alert.temp != stat) {
                alert.temp = stat;
                m = `خطر! دما از مرز ${settings.temp.min} کمتر شد. دما: ${message}`;
            }
        }
        if (m !== "") {
            //console.log(m);
            let sql = "SELECT phone FROM Users LIMIT 1";
            db.all(sql, [], (err, rows) => {
                rows.forEach(e => {
                    ghasedak.send({
                        message: m,
                        receptor: e.phone,
                        linenumber: "10008566"
                    });
                });
            });
        }
    }

    if (topic === "golkhoone/hum/live") {
        let m = "";
        message = parseInt(message);
        data.sec.hum.push(message);
        sensors.hum.statusTime = Date.now();

        let stat = inRange(message, settings.hum.min, settings.hum.max);
        if (stat == 2) {
            if (alert.hum != stat) {
                alert.hum = stat;
                m = `خطر! رطوبت از مرز ${settings.hum.max} بیشتر شد. رطوبت: ${message}`;
            }
        }
        if (stat == 1) {
            if (alert.hum == 0) {
                alert.hum = 1;
                m = `هشدار! رطوبت به مرز ${settings.hum.max} رسید`;
            }
            if (alert.hum == 2) {
                alert.hum = 1;
                m = `رطوبت به مرز ${settings.hum.max} بازگشت`;
            }
        }
        if (stat == 0) {
            if (alert.hum == 1 || alert.hum == 2) {
                alert.hum = 0;
                m = `رطوبت از مرز ${settings.hum.max} کمتر شد. رطوبت: ${message}`;
            }
            if (alert.hum == -1 || alert.hum == -2) {
                alert.hum = 0;
                m = `رطوبت از مرز ${settings.hum.min} بیشتر شد. رطوبت: ${message}`;
            }
        }
        if (stat == -1) {
            if (alert.hum == 0) {
                alert.hum = -1;
                m = `هشدار! رطوبت به مرز ${settings.hum.min} رسید`;
            }
            if (alert.hum == -2) {
                alert.hum = -1;
                m = `رطوبت به مرز ${settings.hum.min} بازگشت`;
            }
        }
        if (stat == -2) {
            if (alert.hum != stat) {
                alert.hum = stat;
                m = `خطر! رطوبت از مرز ${settings.hum.min} کمتر شد. رطوبت: ${message}`;
            }
        }
        if (m !== "") {
            //console.log(m);
            let sql = "SELECT phone FROM Users LIMIT 1";
            db.all(sql, [], (err, rows) => {
                rows.forEach(e => {
                    ghasedak.send({
                        message: m,
                        receptor: e.phone,
                        linenumber: "10008566"
                    });
                });
            });
        }
    }
});

app.use(express.static('www'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.sendFile(__dirname + "\\www\\index.html");
});

app.get("/api/live", (req, res) => {
    let tempSec = data.sec.temp;
    let humSec = data.sec.hum;
    let json = {
        temp: { value: tempSec[tempSec.length - 1], min: settings.temp.min, max: settings.temp.max },
        hum: { value: humSec[humSec.length - 1], min: settings.hum.min, max: settings.hum.max }
    };
    /*let json = {
        temp: { value: 20, min: settings.temp.min, max: settings.temp.max },
        hum: { value: 30, min: settings.hum.min, max: settings.hum.max }
    };*/
    res.send(json);
});

app.post("/api/set/temp", (req, res) => {
    let min = parseInt(req.body.min);
    let max = parseInt(req.body.max);
    if (min >= sensors.temp.min && min <= sensors.temp.max) {
        if (max >= sensors.temp.min && max <= sensors.temp.max) {
            settings.temp.min = min;
            settings.temp.max = max;

            let sql = "UPDATE Settings SET value = ? WHERE key = ?";
            db.run(sql, [min, "temp/min"]);
            db.run(sql, [max, "temp/max"]);

            client.publish("golkhoone/temp/min", min.toString(), { qos: 1 });
            client.publish("golkhoone/temp/max", max.toString(), { qos: 1 });

            res.send({ status: 1 });
        }
        else {
            res.send({ status: 0 });
        }
    }
    else {
        res.send({ status: 0 });
    }
});

app.post("/api/set/hum", (req, res) => {
    let min = parseInt(req.body.min);
    let max = parseInt(req.body.max);
    if (min >= sensors.hum.min && min <= sensors.hum.max) {
        if (max >= sensors.hum.min && max <= sensors.hum.max) {
            settings.hum.min = min;
            settings.hum.max = max;

            let sql = "UPDATE Settings SET value = ? WHERE key = ?";
            db.run(sql, [min, "hum/min"]);
            db.run(sql, [max, "hum/max"]);

            client.publish("golkhoone/hum/min", min.toString(), { qos: 1 });
            client.publish("golkhoone/hum/max", max.toString(), { qos: 1 });

            res.send({ status: 1 });
        }
        else {
            res.send({ status: 0 });
        }
    }
    else {
        res.send({ status: 0 });
    }
});

app.get("/api/status/temp", (req, res) => {
    let now = Date.now();
    if (sensors.temp.statusTime === null) {
        res.send({ status: 0 });
    }
    else if (now - sensors.temp.statusTime > 10 * 1000) {
        res.send({ status: 0 });
    }
    else {
        res.send({ status: 1 });
    }
});

app.get("/api/status/hum", (req, res) => {
    let now = Date.now();
    if (sensors.hum.statusTime === null) {
        res.send({ status: 0 });
    }
    else if (now - sensors.hum.statusTime > 10 * 1000) {
        res.send({ status: 0 });
    }
    else {
        res.send({ status: 1 });
    }
});

app.get("/api/last-60-mins", (req, res) => {
    let temp = [];
    let hum = [];
    for (let i = 0; i < last60mins.temp.length; i++) {
        temp.push(last60mins.temp[i]);
    }
    for (let i = 0; i < last60mins.hum.length; i++) {
        hum.push(last60mins.hum[i]);
    }

    for (let i = last60mins.temp.length; i < 60; i++) {
        temp.unshift(NaN);
    }
    for (let i = last60mins.hum.length; i < 60; i++) {
        hum.unshift(NaN);
    }

    let json = {
        temp: temp,
        hum: hum
    };
    res.send(json);
});

app.get("/api/today", (req, res) => {
    let temp = [];
    let hum = [];
    db.serialize(() => {
        db.all("SELECT value, timestamp FROM Temperature", (err, rows) => {
            let now = new Date();
            rows.forEach(e => {
                let timestamp = parseInt(e.timestamp);
                if (now.toDateString() === new Date(timestamp).toDateString()) {
                    temp.push(e);
                }
            });
            temp = mapHour2Arr(temp);
            if (rows.length == 0) {
                temp = new Array(24).fill(NaN);
            }
        })
            .all("SELECT value, timestamp FROM Humidity", (err, rows) => {
                let now = new Date();
                rows.forEach(e => {
                    let timestamp = parseInt(e.timestamp);
                    if (now.toDateString() === new Date(timestamp).toDateString()) {
                        hum.push(e);
                    }
                });
                hum = mapHour2Arr(hum);
                if (rows.length == 0) {
                    hum = new Array(24).fill(NaN);
                }
                let json = { temp: temp, hum: hum };
                res.send(json);
            });
    });
});

app.get("/api/settings/phone", (req, res) => {
    let json = {};
    let sql = "SELECT phone FROM Users LIMIT 1";
    db.all(sql, [], (err, rows) => {
        rows.forEach(e => {
            json.phone = e.phone;
        });
        res.send(json);
    });
});

app.post("/api/settings/phone", (req, res) => {
    let phone = req.body.phone;
    if (typeof phone === "string") {
        if (phone.length == 11 && parseInt(phone)) {
            db.run("UPDATE Users set phone = ?", [phone]);
            res.send({ status: 1 });
        }
        else {
            res.send({ status: 0 });
        }
    }
    else {
        res.send({ status: 0 });
    }
});

app.get("*", (req, res) => {
    res.sendFile(__dirname + "\\www\\index.html");
});

app.listen(APP_PORT, () => {
    console.log(`http://${ip.address()}:${APP_PORT}`);
});