const express = require("express");
const fs = require("fs");
const http = require("http");
const app = express();
const path = require('path');

app.all("*", function (req, res, next) {
    //设置允许跨域的域名，*代表允许任意域名跨域
    res.header("Access-Control-Allow-Origin", "*");
    //允许的header类型
    // res.header("Access-Control-Allow-Headers", ["content-type", "Authorization"]);
    res.header("Access-Control-Allow-Headers", "content-type,Authorization");
    //跨域允许的请求方式
    res.header("Access-Control-Allow-Methods", "DELETE,PUT,POST,GET,OPTIONS");
    if (req.method.toLowerCase() == "options") res.status(200).send();
    //让options尝试请求快速结束
    else next();
});

const port = process.env.PORT || 3001;

const httpServer = http.createServer(app);
httpServer.listen(port, () => { console.log("> dev mode on http " + port) });


const EXT = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/js",
    ".ico": "image/x-icon",
    ".png": "image/png",
};
// 获取后缀名
const getExt = extName => {
    return EXT[extName];
};

app.get("/*", (req, res) => {
    let pathName = req.url;
    console.log(pathName);
    // 提供一个 icon就不会发起/favicon.ico的请求了
    if (pathName == "/") {
        pathName = "/index.html";
    }

    const extName = path.extname(pathName);
    fs.readFile(`./dist${pathName}`, function (err, data) {
        if (err) {
            console.error(err);
            res.status(400).json(err);
        } else {
            const ext = getExt(extName);
            res.writeHead(200, { "Content-Type": ext + "; charset=utf-8" });
            res.write(data);
        }
        res.end();
    });
});

