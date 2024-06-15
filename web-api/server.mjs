// require('dotenv').config();
import dotenv from 'dotenv';

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import http from 'http';
import morgan from 'morgan';

import routes from './routes.mjs';

import * as utility from './functions/utility.mjs';
Object.assign(global, utility);

import * as deps from './functions/genericDependencies.mjs'
Object.assign(global, deps);

dotenv.config();
const app = express();
const port = 3001;
const host = '0.0.0.0'

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
// app.use(morgan('combined'));


// CORS
const whitelist = `${process.env.CORS_WHITELIST}`.split(',');
const corsOptions = {
  origin: function (origin, callback) {
    callback(null, true);
    // if (!origin || whitelist.includes(origin)) {
    //   callback(null, true);
    // } else if (origin.match(/https?:\/\/localhost:?[0-9]*$/)) {
    //   callback(null, true);
    // } else {
    //   callback(new Error('Not allowed by CORS'));
    // }
  },
  credentials: false,
};
app.use(cors(corsOptions));




app.use(bodyParser.json());
app.use(routes);
app.use(errorHandler);



const server = http.createServer(app);
server.listen(port, host, () => {
  console.log(`The server is running on http://${host}:${port}`);
});
