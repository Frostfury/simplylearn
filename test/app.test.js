const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const { io: connectSocket } = require('socket.io-client');

// Tests never select the application's production database implicitly.
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27017/simplylearn_test';
const { start, io } = require('../index');
const Teacher = require('../models/teacher');

describe('application with upgraded dependencies', { timeout: 30000 }, () => {
  let base;
  let classroomId;
  let uploadDir;
  let slides;
  let teacher;
  let student;
  const sockets = [];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');

  before(async () => {
    const server = await start(0);
    base = 'http://127.0.0.1:' + server.address().port;
  });

  after(async () => {
    for (const socket of sockets) socket.close();
    if (classroomId) await Teacher.deleteOne({ _id: classroomId });
    if (uploadDir) await fs.rm(uploadDir, { recursive: true, force: true });
    await new Promise(resolve => io.close(resolve));
    await mongoose.disconnect();
  });

  function request(url, options) {
    return fetch(base + url, { signal: AbortSignal.timeout(5000), ...options });
  }

  function event(socket, name, predicate = () => true) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(name, listener);
        reject(new Error('Timed out waiting for ' + name));
      }, 5000);
      function listener(value) {
        if (predicate(value)) {
          clearTimeout(timer);
          socket.off(name, listener);
          resolve(value);
        }
      }
      socket.on(name, listener);
    });
  }

  async function connect() {
    const socket = connectSocket(base, {
      transports: ['websocket'], forceNew: true, reconnection: false, timeout: 5000
    });
    sockets.push(socket);
    await Promise.race([
      event(socket, 'connect'),
      new Promise((_, reject) => socket.once('connect_error', reject))
    ]);
    return socket;
  }

  it('connects to MongoDB using the current driver', async () => {
    assert.equal((await mongoose.connection.db.admin().ping()).ok, 1);
  });

  it('renders all five application pages', async () => {
    for (const [url, expected] of [
      ['/', /Simplylearn/], ['/teacher', /pptimages/], ['/student', /Student/],
      ['/info', /Simplylearn/i], ['/donation', /donat/i]
    ]) {
      const response = await request(url);
      assert.equal(response.status, 200, url);
      assert.match(await response.text(), expected, url);
    }
  });

  it('serves stylesheets and the matching Socket.IO browser client', async () => {
    for (const url of ['/teacherstyle.css', '/coroclas.css', '/socket.io/socket.io.js']) {
      const response = await request(url);
      assert.equal(response.status, 200, url);
      assert.ok((await response.text()).length > 100, url);
    }
  });

  it('uploads two PNG slides and saves a classroom', async () => {
    const name = 'dependency-test-' + Date.now() + '-' + process.pid;
    uploadDir = path.join(__dirname, '..', 'uploads', name);
    const form = new FormData();
    form.append('name', name);
    form.append('classname', 'Dependency compatibility');
    form.append('pptimages', new Blob([png], { type: 'image/png' }), 'slide-1.png');
    form.append('pptimages', new Blob([png], { type: 'image/png' }), 'slide-2.png');
    const response = await request('/teacher', {
      method: 'POST', body: form, redirect: 'manual'
    });
    assert.equal(response.status, 302);
    assert.match(response.headers.get('location'), /^\/teacher\/[a-f0-9]{24}$/);
    classroomId = response.headers.get('location').split('/').pop();
    const stored = await Teacher.findById(classroomId).lean();
    assert.equal(stored.name, name);
    assert.equal(stored.classname, 'Dependency compatibility');
    assert.equal(stored.pptimages.length, 2);
    slides = stored.pptimages;
  });

  it('renders classroom pages and serves the uploaded slide bytes', async () => {
    for (const [url, expected] of [
      ['/teacher/' + classroomId, /Start Session/],
      ['/session/' + classroomId + '/teacher', /Teachers View/],
      ['/session/' + classroomId, /Students View/],
      ['/session/' + classroomId + '/recordteacher', /html/i]
    ]) {
      const response = await request(url);
      assert.equal(response.status, 200, url);
      assert.match(await response.text(), expected, url);
    }
    for (const slide of slides) {
      const response = await request('/' + slide);
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    }
  });

  it('joins a Socket.IO 4 classroom and broadcasts the participant list', async () => {
    teacher = await connect();
    student = await connect();
    // Unjoined clients must not crash the server while they initialize.
    teacher.emit('currentslide', 0);
    student.emit('chatMessage', 'before joining');
    let joined = event(teacher, 'userList', users => users.length === 1);
    teacher.emit('joinRoom', { username: 'Teacher', room: classroomId });
    await joined;
    joined = event(teacher, 'userList', users => users.length === 2);
    student.emit('joinRoom', { username: 'Student', room: classroomId });
    assert.deepEqual((await joined).map(user => user.username).sort(), ['Student', 'Teacher']);
  });

  it('synchronizes slides and chat without leaking into another classroom', async () => {
    const other = await connect();
    const joined = event(other, 'userList');
    other.emit('joinRoom', { username: 'Other', room: classroomId + '-other' });
    await joined;
    let leaked = false;
    other.on('changeslide', () => { leaked = true; });
    other.on('message', () => { leaked = true; });
    const slide = event(student, 'changeslide');
    teacher.emit('currentslide', 2);
    assert.equal(await slide, 2);
    const message = event(teacher, 'message');
    student.emit('chatMessage', 'Dependency update works');
    const received = await message;
    assert.equal(received.username, 'Student');
    assert.equal(received.text, 'Dependency update works');
    assert.match(received.time, /\d{1,2}:\d{2} [ap]m/);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(leaked, false);
  });

  it('updates participants when a student disconnects', async () => {
    const left = event(teacher, 'deadUser');
    const list = event(teacher, 'userList', users => users.length === 1);
    student.close();
    assert.equal(await left, 'Student');
    assert.equal((await list)[0].username, 'Teacher');
  });

  it('redirects missing classrooms instead of rendering null data', async () => {
    const missing = new mongoose.Types.ObjectId();
    for (const [url, method] of [
      ['/teacher/' + missing, 'GET'],
      ['/session/' + missing, 'GET'],
      ['/session/' + missing + '/teacher', 'GET'],
      ['/session/' + missing + '/teacher', 'POST']
    ]) {
      const response = await request(url, { method, redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), '/teacher');
    }
  });

  it('deletes the classroom and its uploaded files', async () => {
    const response = await request('/session/' + classroomId + '/teacher', {
      method: 'POST', redirect: 'manual'
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/');
    assert.equal(await Teacher.findById(classroomId).lean(), null);
    await assert.rejects(fs.access(uploadDir), { code: 'ENOENT' });
    classroomId = undefined;
    uploadDir = undefined;
  });
});
