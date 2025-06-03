import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import express from "express";
import { monitor } from "@colyseus/monitor";
import { ChineseChessRoom } from "./rooms/ChineseChessRoom";

const port = Number(process.env.PORT) || 3000;
const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Create HTTP & WebSocket servers
const server = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
    pingInterval: 3000,
    pingMaxRetries: 3,
  }),
});

// Register ChineseChessRoom as "chinese_chess"
gameServer.define("chinese_chess", ChineseChessRoom);

// Register monitor route
app.use("/colyseus", monitor());

// Register front-end route
app.use(express.static("public"));

// Start server
gameServer.listen(port);
console.log(`Listening on ws://localhost:${port}`); 