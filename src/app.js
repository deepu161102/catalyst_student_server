const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const mongoose   = require('mongoose');
const cookieParser = require('cookie-parser');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
const ALLOWED_ORIGINS = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server requests (no Origin header) and whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/auth',                  require('./routes/authRoutes'));
app.use('/api/students',             require('./routes/studentRoutes'));
app.use('/api/mentors',              require('./routes/mentorRoutes'));
app.use('/api/batches',              require('./routes/batchRoutes'));
app.use('/api/chat',                 require('./routes/chatRoutes'));
app.use('/api/assignments',          require('./routes/assignmentRoutes'));
app.use('/api/assignment-responses', require('./routes/assignmentResponseRoutes'));

app.use('/api/sat/admin',   require('./routes/sat/satAdminRoutes'));
app.use('/api/sat/mentor',  require('./routes/sat/satMentorRoutes'));
app.use('/api/sat/test',    require('./routes/sat/satTestRoutes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
