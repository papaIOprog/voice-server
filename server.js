const { WebSocketServer } = require('ws');
const http = require('http');

// ─── Configuration ───
const MAX_USERS_PER_ROOM = parseInt(process.env.MAX_USERS || '5', 10);
const PORT = process.env.PORT || 4000;

const server = http.createServer();
const wss = new WebSocketServer({ server });

const rooms = new Map(); // roomId -> Map<ws, { id }>

let globalId = 0;

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const room = url.searchParams.get('room') || 'default';

    if (!rooms.has(room)) rooms.set(room, new Map());
    const roomMap = rooms.get(room);

    if (roomMap.size >= MAX_USERS_PER_ROOM) {
        ws.close(4000, `Room is full (max ${MAX_USERS_PER_ROOM})`);
        return;
    }

    globalId++;
    const userId = globalId;
    roomMap.set(ws, { id: userId });

    // Build list of existing peer ids
    const peerIds = [];
    for (const [peer, info] of roomMap) {
        if (peer !== ws) peerIds.push(info.id);
    }

    console.log(`[${room}] User ${userId} joined (${roomMap.size}/${MAX_USERS_PER_ROOM})`);

    ws.send(JSON.stringify({
        type: 'welcome',
        userId,
        maxUsers: MAX_USERS_PER_ROOM,
        peers: peerIds,
    }));

    // Tell everyone else
    for (const [peer] of roomMap) {
        if (peer !== ws && peer.readyState === 1) {
            peer.send(JSON.stringify({
                type: 'peer-joined',
                peerId: userId,
                peerCount: roomMap.size,
            }));
        }
    }

    ws.on('message', (data, isBinary) => {
        if (isBinary) {
            // Prepend sender userId as first 4 bytes so clients know who sent it
            const header = Buffer.alloc(4);
            header.writeUInt32LE(userId);
            const framed = Buffer.concat([header, Buffer.from(data)]);

            for (const [peer] of roomMap) {
                if (peer !== ws && peer.readyState === 1) {
                    peer.send(framed, { binary: true });
                }
            }
        } else {
            // Forward JSON control messages
            for (const [peer] of roomMap) {
                if (peer !== ws && peer.readyState === 1) {
                    peer.send(data);
                }
            }
        }
    });

    ws.on('close', () => {
        roomMap.delete(ws);
        console.log(`[${room}] User ${userId} left (${roomMap.size}/${MAX_USERS_PER_ROOM})`);
        for (const [peer] of roomMap) {
            if (peer.readyState === 1) {
                peer.send(JSON.stringify({
                    type: 'peer-left',
                    peerId: userId,
                    peerCount: roomMap.size,
                }));
            }
        }
        if (roomMap.size === 0) rooms.delete(room);
    });
});

server.listen(PORT, () => {
    console.log(`WebSocket server on ws://localhost:${PORT} (max ${MAX_USERS_PER_ROOM} users/room)`);
});
