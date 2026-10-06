import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

// It tells Express to read JSON data sent by the client and put it inside req.body
app.use(express.json({limit: '16kb'}))

// It tells Express to read URL-encoded data sent by the client and put it inside req.body
app.use(express.urlencoded({extended: true, limit: '16kb'}))

// It tells Express to serve static files from the 'public' directory
app.use(express.static('public'));

// It tells Express to parse(convert raw strings sent by client into JavaScript readable objects)
app.use(cookieParser());


export {app}    