require('dns').setServers(['8.8.8.8', '1.1.1.1']); // fix SRV lookup on restrictive ISP DNS
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const setupSocket = require('./socket/socketHandler');

const PORT = process.env.PORT || 8000;

const server = http.createServer(app);
setupSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

connectDB();
