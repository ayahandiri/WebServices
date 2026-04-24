'use strict';

const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = 3002;

// Serve the static frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Track connected users and message history
const users   = new Map(); // socketId → username
const history = [];        // last 50 messages

io.on('connection', socket => {
  console.log(`New connection: ${socket.id}`);

  // Join with username
  socket.on('join', username => {
    users.set(socket.id, username);
    console.log(`${username} joined`);

    // Send history to the newcomer
    socket.emit('history', history);

    // Notify everyone
    const msg = { type: 'system', text: `${username} a rejoint le chat`, at: new Date().toISOString() };
    history.push(msg);
    if (history.length > 50) history.shift();
    io.emit('message', msg);

    // Update user list for all
    io.emit('users', Array.from(users.values()));
  });

  // Chat message
  socket.on('chat', text => {
    const username = users.get(socket.id) || 'Anonyme';
    const msg = { type: 'chat', from: username, text, at: new Date().toISOString() };
    history.push(msg);
    if (history.length > 50) history.shift();
    io.emit('message', msg);
  });

  // Typing indicator
  socket.on('typing', () => {
    const username = users.get(socket.id);
    socket.broadcast.emit('typing', username);
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    users.delete(socket.id);
    if (username) {
      const msg = { type: 'system', text: `${username} a quitté le chat`, at: new Date().toISOString() };
      history.push(msg);
      io.emit('message', msg);
      io.emit('users', Array.from(users.values()));
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Chat server on http://localhost:${PORT}`);
});
