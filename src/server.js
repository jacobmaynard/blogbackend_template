import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cors from "cors";

const { MongoClient } = require( 'mongodb');

const https = require('https'),
      http = require('http'),
      fs = require("fs"),
      helmet=require("helmet");

const ssl_options={
    key: fs.readFileSync(path.join(__dirname, '/certstore/keys/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '/certstore/certs/server.pem')),
    dhparam: fs.readFileSync(path.join(__dirname, '/certstore/params/dh-strong.pem'))
};

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());
app.use(helmet());

app.use(express.static(path.join(__dirname, '/build')))

const withDB = async (operations, res) => {
    try {
        const client = await MongoClient.connect("mongodb://localhost:27017", {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        const db = client.db('my-blog');

        await operations(db);
        client.close();
    } catch (error){
        res.status(500).json({message: "Error connecting to db", error});
    }
}

app.get('/api/articles/:name', async (req, res) => {
   console.log(req.method + req.url);
    withDB(async (db) => {
    const articleName = req.params.name;
    const articleInfo = await db.collection('articles').findOne({name: articleName});
    res.status(200).json(articleInfo);
   }, res);
})

app.post('/api/articles/:name/upvote', async (req, res) => {
    console.log(req.method + req.url);
    withDB(async (db) => {
        const articleName = req.params.name;
        const articleInfo = await db.collection('articles').findOne({name: articleName});
        await db.collection('articles').updateOne({name: articleName}, {
            '$set': {
                upvotes: articleInfo.upvotes + 1,
            },
        });
        const updatedArticleInfo = await db.collection('articles').findOne({name: articleName});
        res.status(200).json(updatedArticleInfo);
    }, res);
});

app.post('/api/articles/:name/add-comment', (req, res) => {
    console.log("Hello from jakes server");
    console.log(req.method + req.url);
    const { username, text: textComment } = req.body;
    const articleName = req.params.name;

    withDB( async (db) => {
        const articleInfo = await db.collection('articles').findOne({ name: articleName });
        await db.collection('articles').updateOne({ name: articleName}, {
            '$set': {
                comments: articleInfo.comments.concat({ username, text}),
            },
        });
        const updatedArticleInfo = await db.collection('articles').findOne({ name: articleName});

        res.status(200).json(updatedArticleInfo);
    }, res);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname + '/build/index.html'));
})

http.createServer(app).listen(8000, () => {
    console.log("Listending on port %d", 8000)
});

https.createServer(ssl_options, app).listen(4443);
