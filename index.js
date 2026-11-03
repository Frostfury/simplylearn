const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('node:path');
const fs = require('fs-extra');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoom } = require('./utils/users');
const Teacher = require('./models/teacher');

const app = express();
const http = createServer(app);
const io = new Server(http);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const directory = path.join('uploads', req.body.name);
    fs.mkdirsSync(directory);
    cb(null, directory);
  },
  filename(req, file, cb) {
    cb(null, file.originalname);
  }
});

const uploads = multer({
  storage,
  limits: { fieldSize: 1024 * 1024 * 5 },
  fileFilter(req, file, cb) {
    cb(null, file.mimetype === 'image/png' || file.mimetype === 'image/jpeg');
  }
});

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, 'views')));

app.get('/', (req, res) => res.render('index'));
app.get('/teacher', (req, res) => res.render('teacher'));
app.get('/student', (req, res) => res.render('student'));
app.get('/info', (req, res) => res.render('info'));
app.get('/donation', (req, res) => res.render('donation'));

app.post('/teacher', uploads.array('pptimages', 40), async (req, res) => {
  try {
    const teacher = new Teacher({
      name: req.body.name,
      classname: req.body.classname,
      pptimages: req.files.map(file => file.path)
    });
    const saved = await teacher.save();
    res.redirect('/teacher/' + saved._id);
  } catch (error) {
    console.error(error);
    res.redirect('/teacher');
  }
});

function renderClassroom(view) {
  return async (req, res) => {
    try {
      const data = await Teacher.findById(req.params.id);
      if (!data) return res.redirect('/teacher');
      res.render(view, { data });
    } catch (error) {
      console.error(error);
      res.redirect('/teacher');
    }
  };
}

app.get('/teacher/:id', renderClassroom('linkshare'));
app.get('/session/:id/teacher', renderClassroom('presentation-page-teacher'));
app.get('/session/:id/recordteacher', renderClassroom('working-on-this'));
app.get('/session/:id', renderClassroom('presentation-page-student'));

app.post('/session/:id/teacher', async (req, res) => {
  try {
    const data = await Teacher.findById(req.params.id);
    if (!data) return res.redirect('/teacher');
    await fs.remove(path.join('uploads', data.name));
    await Teacher.deleteOne({ _id: data._id });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.redirect('/teacher');
  }
});

io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    socket.join(user.room);
    io.to(user.room).emit('newUser', username);
    io.to(user.room).emit('userList', getRoom(room));
  });

  socket.on('currentslide', n => {
    const user = getCurrentUser(socket.id);
    if (user) io.to(user.room).emit('changeslide', n);
  });

  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);
    if (user) io.to(user.room).emit('message', formatMessage(user.username, msg));
  });

  socket.on('disconnect', () => {
    const user = getCurrentUser(socket.id);
    userLeave(socket.id);
    if (user) {
      io.to(user.room).emit('deadUser', user.username);
      io.to(user.room).emit('userList', getRoom(user.room));
    }
  });
});

async function start(port = process.env.PORT || 1690) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/simplylearn';
  await mongoose.connect(uri);
  return new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, () => {
      http.off('error', reject);
      console.log('Running on ' + http.address().port);
      resolve(http);
    });
  });
}

if (require.main === module) {
  start().catch(() => {
    console.error('Unable to start the server. Check MongoDB connectivity and PORT.');
    io.close();
    mongoose.disconnect().finally(() => { process.exitCode = 1; });
  });
}

module.exports = { app, http, io, start };
