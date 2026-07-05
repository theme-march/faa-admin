var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var flash = require('express-flash');
var session = require('express-session');
var expressLayouts = require('express-ejs-layouts');
var bodyParser = require('body-parser');
var cors = require("cors");

const db = require('./models');
db.sequelize.sync({ alter: true }).then((req) => {
  console.log("Database connection successfully!");
}).catch((err) => {
  console.log("Database error: ", err);
});

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var apiRouter = require('./routes/api');

var app = express();

const allowedOrigins = new Set([
  "https://cms.faa-dubd.org",
  "https://faa-dubd.org",
  "http://faa-dubd.org",
  "https://www.faa-dubd.org",
  "http://www.faa-dubd.org",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://139.162.11.50:3001",
  "https://139.162.11.50:3001",
]);

function isAllowedOrigin(origin = "") {
  if (allowedOrigins.has(origin)) return true;

  try {
    const parsed = new URL(origin);
    const hostname = String(parsed.hostname || "").toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    if (hostname === "faa-dubd.org" || hostname.endsWith(".faa-dubd.org")) {
      return true;
    }
  } catch (error) {
    return false;
  }

  return false;
}

// Enable CORS for admin API requests coming from the frontend site,
// local member app, and CMS itself.
app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use("/images", express.static("public"));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json({ limit: '1000mb' })); // Increase the limit as needed
app.use(express.urlencoded({ limit: '1000mb', extended: true })); // Increase the limit as needed
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);

// Trust the first proxy (for secure cookies)
app.set('trust proxy', 1);
app.use(session({
  key: 'MessengerPharmaAdminUser',
  secret: process.env.SESSION_SECRET || 'messenger@pharma@123',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set secure to true if using HTTPS
}));
app.use(flash());

// Serve TinyMCE from node_modules
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));

app.use('/', indexRouter);
app.use('/api', apiRouter);
app.use('/users', usersRouter);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
