# Simplylearn development

Use Node.js 20.19 or newer (Node.js 24 is verified) and MongoDB 7 or newer.

```sh
npm ci
npm start
```

The server connects to `mongodb://127.0.0.1:27017/simplylearn` by default and
listens on port 1690. Set `MONGODB_URI` and `PORT` to use another database or port.
Keep database credentials in the environment rather than source control.
The server starts listening after MongoDB connects and exits unsuccessfully
if startup fails.

```sh
npm run dev  # restart automatically with Node's built-in watch mode
npm test     # database-backed HTTP, upload and Socket.IO integration tests
```

Tests require a running MongoDB instance. They use the separate `simplylearn_test`
database by default; set `TEST_MONGODB_URI` to override it. Each run creates a
uniquely named classroom and removes its own documents and uploaded files.

This update uses Express 5, EJS 7, Mongoose 9, Multer 2 and Socket.IO 4.
Mongoose operations use promises instead of the removed callback API.
The Socket.IO browser client is served by the server at `/socket.io/socket.io.js`;
external clients must also use a compatible Socket.IO 4 client.

In the previously prepared cloud environment, the local database can be started
with `/workspace/.simplylearn-dev/database-start.sh`. Then use the npm commands
above directly: the old `app-start.sh` preload adds MongoDB driver options that
are no longer supported by Mongoose 9.
