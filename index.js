const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.static(__dirname + "/public"))
let lastUpdated = 0

const roomToUsers = {}
const userToRoom = {}
const userCurrentUrl = {}
const usernames = {}
const avatars = {}

const getCurrentUrlsMap = (roomId) => {
  const urlsMap = {}
  for (const user of Object.keys(userCurrentUrl)) {
    if (roomToUsers[roomId].includes(user)) {
      urlsMap[user] = userCurrentUrl[user]
    }
  }
  console.log("urls map", urlsMap)
  return urlsMap
}

const getCurrentUsernamesMap = (roomId) => {
  const usernamesMap = {}
  for (const user of Object.keys(usernames)) {
    if (roomToUsers[roomId].includes(user)) {
      usernamesMap[user] = usernames[user]
    }
  }
  return usernamesMap
}

const getAvatarMap = (roomId) => {
  const avatarMap = {}
  for (const user of Object.keys(avatars)) {
    if (roomToUsers[roomId].includes(user)) {
      avatarMap[user] = avatars[user]
    }
  }
  return avatarMap
}

io.on("connection", (socket) => {
  console.log("socket joined", socket.id)
  socket.on("disconnect", (reason) => {
    console.log(`socket ${socket.id} disconnected due to ${reason}`);
  });
  socket.on("currentUrl", (url, time) => {
    if (time < lastUpdated) return;
    lastUpdated = time;
    // console.log("currentUrl event", url)
    const userId = socket.handshake.auth.uid;
    userCurrentUrl[userId] = url;
    // find the room this user is in
    const roomId = userToRoom[userId]
    // console.log("auth", socket.handshake.auth.uid)
    // console.log(roomId)
    if (roomId) {
      io.to(roomToUsers[roomId]).emit("changeUrl", userId, url)
    } else {
      // not in a room yet, just emit to self
      io.to(userId).emit("changeUrl", userId, url)
    }
  })
  socket.on("joinRoom", ({ uid, roomId }) => {
    console.log("join room", uid, roomId)
    if (!(roomId in roomToUsers)) {
      roomToUsers[roomId] = []
    }
    // remove user from current room
    if (userToRoom[uid]) {
      roomToUsers[userToRoom[uid]] = roomToUsers[userToRoom[uid]].filter(x => x != uid)
      if (roomToUsers[userToRoom[uid]].length > 0) {
        io.to(roomToUsers[userToRoom[uid]]).emit("initState", getCurrentUrlsMap(userToRoom[uid]), getCurrentUsernamesMap(userToRoom[uid]), getAvatarMap(userToRoom[uid]))
      }
    }

    roomToUsers[roomId].push(uid)
    userToRoom[uid] = roomId

    // get urls of current room users

    io.to(roomToUsers[roomId]).emit("initState", getCurrentUrlsMap(roomId), getCurrentUsernamesMap(roomId), getAvatarMap(roomId))
  })
  socket.on("setUsername", ({ uid, username }) => {
    usernames[uid] = username
    const currentRoom = userToRoom[uid]
    const usersInTheRoom = roomToUsers[currentRoom]
    io.to(usersInTheRoom).emit("usernameChange", { uid, username })
  })
  socket.on("setAvatar", ({ uid, avatar }) => {
    avatars[uid] = avatar
    const currentRoom = userToRoom[uid]
    const usersInTheRoom = roomToUsers[currentRoom]
    io.to(usersInTheRoom).emit("avatarChange", { uid, avatar })
  })
  socket.on("poke", ({ from, to }) => {
    console.log(`${from} poked ${to}`)
    io.to(to).emit("poke", { from })
  })
  if (socket.handshake.auth.uid) {
    socket.join(socket.handshake.auth.uid)
  }
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});