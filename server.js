// Smart Health Connect - the backend server.
// It does two jobs:
//   1. Sends our website pages (the "public" folder) to the browser.
//   2. Answers API requests like /api/doctors, which read and change the database.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Lets us read JSON sent by the browser (req.body)
app.use(express.json());

// The website pages: HTML, CSS and JavaScript files
app.use(express.static(path.join(__dirname, 'public')));

// jsPDF library, used by the browser to make PDF files
app.use('/jspdf', express.static(path.join(__dirname, 'node_modules', 'jspdf', 'dist')));

// API routes. Each file handles one module of the project.
app.use('/api', require('./routes/auth'));          // login, sign up, logout
app.use('/api', require('./routes/ai'));            // AI health assistant logs
app.use('/api', require('./routes/appointments'));  // doctors, appointments, prescriptions, feedback
app.use('/api', require('./routes/lab'));           // lab tests, bookings, reports
app.use('/api', require('./routes/blood'));         // blood stock, donors, blood requests
app.use('/api', require('./routes/admin'));         // admin dashboard numbers

app.listen(PORT, () => {
  console.log('Smart Health Connect is running at http://localhost:' + PORT);
});
