require('dns').setServers(['8.8.8.8', '1.1.1.1']); // fix SRV lookup on restrictive ISP DNS
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

connectDB();
