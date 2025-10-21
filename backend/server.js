require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/feedbackSystem');

const corsOptions = {
  origin: [
    'https://feedback-student-panel.onrender.com',
    'http://feedback-student-panel.onrender.com',
    'https://feedback-mlan.onrender.com',
    'http://feedback-mlan.onrender.com',
    'http://localhost:3000',
    'http://localhost:4000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Authorization']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
// Models

// Add this to your models section in server.js
const AdminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  email: { type: String, unique: true },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', AdminSchema);

const StudentSchema = new mongoose.Schema({
  name: String,
  hallticket: { type: String, unique: true },
  branch: String,
  academicYear: String,
  email: String,
  password: String
});

const SubjectSchema = new mongoose.Schema({
  subject: String,
  faculty: String,
  class: String,
  branch: String,
  academicYear: String,
});

const RoundControlSchema = new mongoose.Schema({
  class: String,
  branch: String,
  academicYear: String,
  initialEnabled: { type: Boolean, default: true },
  finalEnabled: { type: Boolean, default: false },
  initialEndDate: Date,
  finalEndDate: Date
});

const FeedbackSchema = new mongoose.Schema({
  hallticket: String,
  class: String,
  branch: String,
  academicYear: String,
  subject: String,
  faculty: String,
  answers: [{ question: String, score: Number }],
  suggestion: String,
  round: { type: String, enum: ['initial', 'final'], default: 'initial' },
  date: { type: Date, default: Date.now }
});

const FeedbackSubmissionSchema = new mongoose.Schema({
  hallticket: String,
  class: String,
  branch: String,
  academicYear: String,
  initial: { type: Boolean, default: false },
  final: { type: Boolean, default: false },
  initialDate: Date,
  finalDate: Date
});

const Student = mongoose.model('Student', StudentSchema);
const Subject = mongoose.model('Subject', SubjectSchema);
const Feedback = mongoose.model('Feedback', FeedbackSchema);
const FeedbackSubmission = mongoose.model('FeedbackSubmission', FeedbackSubmissionSchema);
const RoundControl = mongoose.model('RoundControl', RoundControlSchema);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Simple CSV parser function
function parseCSV(csvString, isSubjects = false) {
  const lines = csvString.split('\n');
  const result = [];
  const headers = isSubjects ? ['subject', 'faculty'] : ['name', 'hallticket', 'branch'];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    
    // Skip header row
    const firstValue = values[0] ? values[0].toLowerCase() : '';
    if (i === 0 && (firstValue === 'name' || firstValue === 'subject')) {
      console.log('Skipping header row:', line);
      continue;
    }
    
    if (isSubjects && values.length >= 2) {
      result.push({
        subject: values[0] ? values[0].trim() : '',
        faculty: values[1] ? values[1].trim() : ''
      });
    } else if (!isSubjects && values.length >= 3) {
      result.push({
        name: values[0] ? values[0].trim() : '',
        hallticket: values[1] ? values[1].trim() : '',
        branch: values[2] ? values[2].trim() : ''
      });
    }
  }
  
  return result;
}
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    cors: 'Enabled for all origins'
  });
});
// Admin: Upload students CSV
app.post('/upload-students', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { class: cls, branch, academicYear } = req.body;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }

    const csvString = req.file.buffer.toString('utf8');
    const students = parseCSV(csvString, false);

    if (!students || students.length === 0) {
      return res.status(400).json({ error: 'No valid data found in CSV' });
    }

    const processedStudents = [];
    for (const student of students) {
      if (!student.name || !student.hallticket || !student.branch || 
          student.name === '' || student.hallticket === '' || student.branch === '') {
        console.warn('Skipping invalid student record:', student);
        continue;
      }

      processedStudents.push({
        name: student.name.trim(),
        hallticket: student.hallticket.trim(),
        branch: student.branch.trim(),
        academicYear: academicYear,
        password: bcrypt.hashSync(student.hallticket.trim(), 10)
      });
    }

    if (processedStudents.length === 0) {
      return res.status(400).json({ error: 'No valid student records found' });
    }

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    
    for (const student of processedStudents) {
      try {
        const existingStudent = await Student.findOne({ 
          hallticket: student.hallticket,
          academicYear: academicYear
        });
        
        if (existingStudent) {
          await Student.updateOne(
            { hallticket: student.hallticket, academicYear: academicYear },
            { $set: { name: student.name, branch: student.branch } }
          );
          successCount++;
          duplicateCount++;
        } else {
          await Student.create(student);
          successCount++;
        }
        // Create feedback submission record for new students
        await FeedbackSubmission.findOneAndUpdate(
          {
            hallticket: student.hallticket,
            class: cls,
            branch: branch,
            academicYear: academicYear
          },
          {
            hallticket: student.hallticket,
            class: cls,
            branch: branch,
            academicYear: academicYear,
            initial: false,
            final: false
          },
          { upsert: true }
        );
      } catch (error) {
        console.error(`Error processing student ${student.hallticket}:`, error);
        errorCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Students processed successfully. ${successCount} successful (${duplicateCount} updated, ${successCount - duplicateCount} new), ${errorCount} errors.`
    });
  } catch (error) {
    console.error('Error uploading students:', error);
    res.status(500).json({ error: 'Failed to upload students: ' + error.message });
  }
});

app.post('/admin/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, password, and email are required' });
    }
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin username or email already exists' });
    }
    
    // Create new admin
    const admin = await Admin.create({
      username,
      password: bcrypt.hashSync(password, 10),
      email
    });
    
    res.json({ 
      success: true, 
      message: 'Admin registered successfully',
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Failed to register admin' });
  }
});

// Admin Login
app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find admin by username
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    if (!bcrypt.compareSync(password, admin.password)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin verification middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, admin) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Check if the token belongs to an admin
    if (admin.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    
    req.admin = admin;
    next();
  });
};

// Get all unique faculties across all classes and branches
app.get('/all-faculties', async (req, res) => {
  try {
    const faculties = await Subject.distinct('faculty');
    res.json(faculties.sort());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch faculties' });
  }
});

// Get complete faculty history with performance data
// Enhanced faculty history endpoint with better performance data
app.get('/faculty-history', async (req, res) => {
  try {
    const { faculty, class: cls, branch, academicYear } = req.query;
    
    if (!faculty) {
      return res.status(400).json({ error: 'Faculty name is required' });
    }
    
    // Build match criteria for subjects
    const subjectMatchCriteria = { faculty };
    if (cls) subjectMatchCriteria.class = cls;
    if (branch) subjectMatchCriteria.branch = branch;
    if (academicYear) subjectMatchCriteria.academicYear = academicYear;
    
    // Get all subjects taught by the faculty
    const subjects = await Subject.find(subjectMatchCriteria);
    
    if (subjects.length === 0) {
      return res.json([]);
    }
    
    // Get detailed performance data for each subject
    const facultyHistory = await Promise.all(
      subjects.map(async (subject) => {
        try {
          // Get performance data for the subject
          const performanceData = await Feedback.aggregate([
            {
              $match: {
                faculty: subject.faculty,
                subject: subject.subject,
                class: subject.class,
                branch: subject.branch,
                academicYear: subject.academicYear
              }
            },
            {
              $unwind: "$answers"
            },
            {
              $group: {
                _id: {
                  round: "$round",
                  subject: "$subject"
                },
                totalScore: { $sum: "$answers.score" },
                totalResponses: { $sum: 1 },
                studentCount: { $addToSet: "$hallticket" },
                suggestions: { $push: "$suggestion" }
              }
            },
            {
              $project: {
                round: "$_id.round",
                subject: "$_id.subject",
                avgScore: { $divide: ["$totalScore", "$totalResponses"] },
                studentCount: { $size: "$studentCount" },
                totalSuggestions: { 
                  $size: { 
                    $filter: { 
                      input: "$suggestions", 
                      as: "suggestion",
                      cond: { $ne: ["$$suggestion", ""] }
                    } 
                  } 
                }
              }
            }
          ]);
          
          // Calculate performance percentages
          const roundsData = {};
          performanceData.forEach(data => {
            const percentage = (data.avgScore / 5) * 100;
            roundsData[data.round] = {
              overallPercentage: percentage,
              studentCount: data.studentCount,
              totalSuggestions: data.totalSuggestions
            };
          });
          
          // Determine if subject involves labs (you might need to adjust this logic)
          const isLabSubject = subject.subject.toLowerCase().includes('lab') || 
                              subject.subject.toLowerCase().includes('laboratory');
          
          return {
            faculty: subject.faculty,
            subject: subject.subject,
            class: subject.class,
            branch: subject.branch,
            academicYear: subject.academicYear,
            rounds: roundsData,
            overallPercentage: roundsData.initial?.overallPercentage || roundsData.final?.overallPercentage || 0,
            studentCount: roundsData.initial?.studentCount || roundsData.final?.studentCount || 0,
            round: roundsData.initial ? 'initial' : (roundsData.final ? 'final' : 'no-data'),
            labs: isLabSubject ? [subject.subject] : [],
            subjectsHandled: [subject.subject],
            totalSuggestions: roundsData.initial?.totalSuggestions || roundsData.final?.totalSuggestions || 0
          };
        } catch (error) {
          console.error(`Error processing subject ${subject.subject}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null results and sort by academic year and class
    const validHistory = facultyHistory.filter(record => record !== null);
    validHistory.sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return b.academicYear.localeCompare(a.academicYear);
      }
      return a.class.localeCompare(b.class);
    });
    
    res.json(validHistory);
  } catch (error) {
    console.error('Failed to fetch faculty history:', error);
    res.status(500).json({ error: 'Failed to fetch faculty history' });
  }
});


// Admin: Upload subjects CSV
app.post('/upload-subjects', upload.single('file'), async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }

    const csvString = req.file.buffer.toString('utf8');
    const subjects = parseCSV(csvString, true);

    if (!subjects || subjects.length === 0) {
      return res.status(400).json({ error: 'No valid data found in CSV' });
    }

    const processedSubjects = [];
    for (const subject of subjects) {
      if (!subject.subject || !subject.faculty || subject.subject === '' || subject.faculty === '') {
        console.warn('Skipping invalid subject record:', subject);
        continue;
      }

      processedSubjects.push({
        subject: subject.subject.trim(),
        faculty: subject.faculty.trim(),
        class: cls,
        branch: branch,
        academicYear: academicYear
      });
    }

    if (processedSubjects.length === 0) {
      return res.status(400).json({ error: 'No valid subject records found' });
    }

    await Subject.deleteMany({ class: cls, branch: branch, academicYear: academicYear });
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const subject of processedSubjects) {
      try {
        await Subject.create(subject);
        successCount++;
      } catch (error) {
        console.error(`Error inserting subject ${subject.subject}:`, error);
        errorCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Subjects uploaded successfully. ${successCount} processed, ${errorCount} errors.`
    });
  } catch (error) {
    console.error('Error uploading subjects:', error);
    res.status(500).json({ error: 'Failed to upload subjects: ' + error.message });
  }
});

// Admin: Get all faculties for a class and branch
app.get('/faculties', async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    const faculties = await Subject.distinct('faculty', { class: cls, branch: branch, academicYear: academicYear });
    res.json(faculties);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch faculties' });
  }
});

// Admin: Get feedback submission count for a class (both rounds)
app.get('/feedback-counts', async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    const initialCount = await FeedbackSubmission.countDocuments({ 
      class: cls, 
      branch: branch, 
      academicYear: academicYear,
      initial: true 
    });
    
    const finalCount = await FeedbackSubmission.countDocuments({ 
      class: cls, 
      branch: branch, 
      academicYear: academicYear,
      final: true 
    });
    
    const totalStudents = await Student.countDocuments({ branch: branch, academicYear: academicYear });
    
    res.json({ 
      initial: { submitted: initialCount, total: totalStudents },
      final: { submitted: finalCount, total: totalStudents }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feedback counts' });
  }
});

// Get available semesters for a student
app.get('/student-semesters', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ hallticket: req.user.hallticket });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const semesters = await Subject.distinct('class', { 
      branch: student.branch,
      academicYear: student.academicYear 
    });
    res.json(semesters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch semesters' });
  }
});

// Get subjects for a class/branch - UPDATED TO INCLUDE AUTHENTICATION
app.get('/subjects', authenticateToken, async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    // Verify the student has access to these subjects
    const student = await Student.findOne({ hallticket: req.user.hallticket });
    if (!student || student.branch !== branch || student.academicYear !== academicYear) {
      return res.status(403).json({ error: 'Unauthorized to access these subjects' });
    }
    
    const subjects = await Subject.find({ class: cls, branch: branch, academicYear: academicYear });
    res.json(subjects);
  } catch (error) {
    console.error('Failed to fetch subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Get student's branch and academic year
app.get('/student-info', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ hallticket: req.user.hallticket });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ branch: student.branch, academicYear: student.academicYear });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student info' });
  }
});

// Student registration
app.post('/register', async (req, res) => {
  try {
    const { email, password, hallticket } = req.body;
    
    if (!email || !password || !hallticket) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const student = await Student.findOne({ hallticket });
    if (!student) {
      return res.status(400).json({ error: 'Hallticket not found in system' });
    }
    
    if (student.email) {
      return res.status(400).json({ error: 'This hallticket is already registered' });
    }
    
    const existingEmail = await Student.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    student.email = email;
    student.password = bcrypt.hashSync(password, 10);
    await student.save();
    
    const token = jwt.sign(
      { 
        hallticket: student.hallticket, 
        email: student.email, 
        branch: student.branch,
        academicYear: student.academicYear 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      success: true, 
      message: 'Registered successfully',
      token,
      student: {
        name: student.name,
        hallticket: student.hallticket,
        branch: student.branch,
        academicYear: student.academicYear,
        email: student.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Student login
app.post('/login', async (req, res) => {
  try {
    const { hallticket, password } = req.body;
    
    if (!hallticket || !password) {
      return res.status(400).json({ error: 'Hallticket and password are required' });
    }
    
    const student = await Student.findOne({ hallticket });
    if (!student) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    if (!bcrypt.compareSync(password, student.password)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { 
        hallticket: student.hallticket, 
        email: student.email, 
        branch: student.branch,
        academicYear: student.academicYear 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({ 
      success: true, 
      token,
      student: {
        name: student.name,
        hallticket: student.hallticket,
        branch: student.branch,
        academicYear: student.academicYear,
        email: student.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/check-hallticket/:hallticket', async (req, res) => {
  try {
    const { hallticket } = req.params;
    
    if (!hallticket) {
      return res.status(400).json({ error: 'Hallticket is required' });
    }
    
    const student = await Student.findOne({ hallticket });
    
    if (!student) {
      return res.json({ exists: false, registered: false, message: 'Hallticket not found in system' });
    }
    
    if (student.email) {
      return res.json({ exists: true, registered: true, message: 'Hallticket already registered' });
    }
    
    res.json({ exists: true, registered: false, message: 'Hallticket available for registration' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check hallticket' });
  }
});

// Add endpoint to check if email is available
app.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const student = await Student.findOne({ email });
    
    if (student) {
      return res.json({ available: false, message: 'Email already registered' });
    }
    
    res.json({ available: true, message: 'Email available' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// Check if feedback already submitted for current semester and round
app.get('/feedbackcheck', authenticateToken, async (req, res) => {
  try {
    const { class: cls, round } = req.query;
    
    if (!cls || !round) {
      return res.status(400).json({ error: 'Class and round are required' });
    }
    
    const feedback = await FeedbackSubmission.findOne({ 
      hallticket: req.user.hallticket, 
      class: cls, 
      branch: req.user.branch,
      academicYear: req.user.academicYear
    });
    
    if (round === 'initial') {
      res.json({ submitted: !!feedback && feedback.initial });
    } else if (round === 'final') {
      res.json({ submitted: !!feedback && feedback.final });
    } else {
      res.status(400).json({ error: 'Invalid round specified' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to check feedback status' });
  }
});

// Submit feedback
app.post('/feedback', authenticateToken, async (req, res) => {
  try {
    const { class: cls, feedbacks, suggestion, round } = req.body;
    
    if (!cls || !feedbacks || !round) {
      return res.status(400).json({ error: 'Class, feedbacks, and round are required' });
    }
    
    // Check if the round is enabled
    const roundControl = await RoundControl.findOne({ 
      class: cls, 
      branch: req.user.branch,
      academicYear: req.user.academicYear
    });
    if ((round === 'initial' && (!roundControl || !roundControl.initialEnabled)) ||
        (round === 'final' && (!roundControl || !roundControl.finalEnabled))) {
      return res.status(400).json({ error: `${round} feedback is not currently accepted` });
    }
    
    // Verify student is in the correct branch and academic year
    const student = await Student.findOne({ hallticket: req.user.hallticket });
    if (!student || student.branch !== req.user.branch || student.academicYear !== req.user.academicYear) {
      return res.status(403).json({ error: 'Unauthorized to submit feedback for this branch/academic year' });
    }
    
    // Check if already submitted for this round
    const submission = await FeedbackSubmission.findOne({ 
      hallticket: req.user.hallticket, 
      class: cls, 
      branch: req.user.branch,
      academicYear: req.user.academicYear
    });
    
    if ((round === 'initial' && submission && submission.initial) || 
        (round === 'final' && submission && submission.final)) {
      return res.status(400).json({ error: `Feedback already submitted for ${round} round this semester` });
    }
    
    // Save all feedback entries with round information
    for (let fb of feedbacks) {
      await Feedback.create({
        hallticket: req.user.hallticket,
        class: cls,
        branch: req.user.branch,
        academicYear: req.user.academicYear,
        subject: fb.subject,
        faculty: fb.faculty,
        answers: fb.answers,
        suggestion,
        round: round
      });
    }
    
    // Mark as submitted for the appropriate round
    const updateData = round === 'initial' 
      ? { initial: true, initialDate: new Date() } 
      : { final: true, finalDate: new Date() };
    
    await FeedbackSubmission.findOneAndUpdate(
      { 
        hallticket: req.user.hallticket, 
        class: cls, 
        branch: req.user.branch,
        academicYear: req.user.academicYear
      },
      updateData,
      { upsert: true, new: true }
    );
    
    res.json({ success: true, message: `Feedback for ${round} round submitted successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Aggregate feedback for faculty (with round support)
app.get('/full-performance/:faculty', async (req, res) => {
  try {
    const { class: cls, branch, academicYear, round } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    // Build match criteria
    const matchCriteria = { 
      faculty: req.params.faculty,
      class: cls,
      branch: branch,
      academicYear: academicYear
    };
    
    // Add round filter if specified
    if (round) {
      matchCriteria.round = round;
    }
    
    const agg = await Feedback.aggregate([
      { 
        $match: matchCriteria
      },
      { $group: {
        _id: { 
          subject: "$subject", 
          faculty: "$faculty", 
          class: "$class", 
          branch: "$branch",
          academicYear: "$academicYear",
          round: "$round"
        },
        responses: { $push: "$answers" },
        count: { $sum: 1 }
      }}
    ]);
    
    const result = agg.map(g => {
      let questions = {};
      g.responses.forEach(ansArr => {
        ansArr.forEach(({ question, score }) => {
          if (!questions[question]) questions[question] = [];
          questions[question].push(score);
        });
      });
      
      const avgScores = Object.fromEntries(
        Object.entries(questions).map(([q, arr]) => [q, arr.reduce((a, b) => a + b, 0) / arr.length])
      );
      
      return {
        faculty: g._id.faculty,
        subject: g._id.subject,
        class: g._id.class,
        branch: g._id.branch,
        academicYear: g._id.academicYear,
        round: g._id.round,
        studentCount: g.count,
        avgScores
      };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// Get class-wise report
 
// Get class-wise report - FIXED
app.get('/class-report', async (req, res) => {
  try {
    const { class: cls, branch, academicYear, round } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    // Build match criteria
    const matchCriteria = { 
      class: cls,
      branch: branch,
      academicYear: academicYear
    };
    
    // Add round filter if specified
    if (round) {
      matchCriteria.round = round;
    }
    
    const agg = await Feedback.aggregate([
      { 
        $match: matchCriteria
      },
      { $unwind: "$answers" },
      { $group: {
        _id: {
          subject: "$subject",
          faculty: "$faculty"
        },
        totalScore: { $sum: "$answers.score" },
        totalResponses: { $sum: 1 },
        studentCount: { $addToSet: "$hallticket" }
      }},
      { $project: {
        subject: "$_id.subject",
        faculty: "$_id.faculty",
        // Calculate average score per question (out of 5) and convert to percentage
        avgScore: { $divide: ["$totalScore", "$totalResponses"] },
        studentCount: { $size: "$studentCount" }
      }},
      { $project: {
        subject: 1,
        faculty: 1,
        studentCount: 1,
        // Convert to percentage (5 = 100%)
        overallPercentage: { $multiply: [{ $divide: ["$avgScore", 5] }, 100] }
      }}
    ]);
    
    res.json(agg);
  } catch (error) {
    console.error('Failed to fetch class report:', error);
    res.status(500).json({ error: 'Failed to fetch class report' });
  }
});

// Get department-wise report - FIXED
app.get('/department-report', async (req, res) => {
  try {
    const { branch, academicYear, round } = req.query;
    
    if (!branch || !academicYear) {
      return res.status(400).json({ error: 'Branch and academic year are required' });
    }
    
    // Build match criteria
    const matchCriteria = { 
      branch: branch,
      academicYear: academicYear
    };
    
    // Add round filter if specified
    if (round) {
      matchCriteria.round = round;
    }
    
    const agg = await Feedback.aggregate([
      { 
        $match: matchCriteria
      },
      { $unwind: "$answers" },
      { $group: {
        _id: {
          class: "$class"
        },
        totalScore: { $sum: "$answers.score" },
        totalResponses: { $sum: 1 },
        studentCount: { $addToSet: "$hallticket" }
      }},
      { $project: {
        class: "$_id.class",
        // Calculate average score per question (out of 5) and convert to percentage
        avgScore: { $divide: ["$totalScore", "$totalResponses"] },
        studentCount: { $size: "$studentCount" }
      }},
      { $project: {
        class: 1,
        studentCount: 1,
        // Convert to percentage (5 = 100%)
        overallPercentage: { $multiply: [{ $divide: ["$avgScore", 5] }, 100] }
      }}
    ]);
    
    res.json(agg);
  } catch (error) {
    console.error('Failed to fetch department report:', error);
    res.status(500).json({ error: 'Failed to fetch department report' });
  }
});

// Also fix the faculty performance aggregation
app.get('/full-performance/:faculty', async (req, res) => {
  try {
    const { class: cls, branch, academicYear, round } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    // Build match criteria
    const matchCriteria = { 
      faculty: req.params.faculty,
      class: cls,
      branch: branch,
      academicYear: academicYear
    };
    
    // Add round filter if specified
    if (round) {
      matchCriteria.round = round;
    }
    
    const agg = await Feedback.aggregate([
      { 
        $match: matchCriteria
      },
      { $unwind: "$answers" },
      { $group: {
        _id: {
          subject: "$subject",
          faculty: "$faculty",
          class: "$class",
          branch: "$branch",
          academicYear: "$academicYear",
          round: "$round"
        },
        totalScore: { $sum: "$answers.score" },
        totalResponses: { $sum: 1 },
        studentCount: { $addToSet: "$hallticket" }
      }},
      { $group: {
        _id: {
          subject: "$_id.subject",
          faculty: "$_id.faculty",
          class: "$_id.class",
          branch: "$_id.branch",
          academicYear: "$_id.academicYear",
          round: "$_id.round"
        },
        // Calculate average score for each question category
        avgScores: {
          $push: {
            k: "$_id.question",
            v: { $divide: ["$totalScore", "$totalResponses"] }
          }
        },
        studentCount: { $first: { $size: "$studentCount" } }
      }},
      { $project: {
        faculty: "$_id.faculty",
        subject: "$_id.subject",
        class: "$_id.class",
        branch: "$_id.branch",
        academicYear: "$_id.academicYear",
        round: "$_id.round",
        studentCount: 1,
        avgScores: { $arrayToObject: "$avgScores" }
      }}
    ]);
    
    res.json(agg);
  } catch (error) {
    console.error('Failed to fetch performance data:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// Get all classes and branches for admin
app.get('/classes', async (req, res) => {
  try {
    const classes = await Subject.distinct('class');
    const branches = await Subject.distinct('branch');
    const academicYears = await Subject.distinct('academicYear');
    res.json({ classes, branches, academicYears });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes and branches' });
  }
});

// Add endpoint to enable/disable rounds
app.post('/round-control', async (req, res) => {
  try {
    const { class: cls, branch, academicYear, round, enabled } = req.body;
    
    if (!cls || !branch || !academicYear || !round) {
      return res.status(400).json({ error: 'Class, branch, academic year, and round are required' });
    }
    
    const updateData = {};
    if (round === 'initial') {
      updateData.initialEnabled = enabled;
      if (!enabled) updateData.initialEndDate = new Date();
    } else if (round === 'final') {
      updateData.finalEnabled = enabled;
      if (enabled) updateData.finalEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    } else {
      return res.status(400).json({ error: 'Invalid round specified' });
    }
    
    const control = await RoundControl.findOneAndUpdate(
      { class: cls, branch: branch, academicYear: academicYear },
      updateData,
      { upsert: true, new: true }
    );
    
    res.json({ success: true, control });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update round control' });
  }
});

// Add endpoint to get round status
app.get('/round-status', async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    const control = await RoundControl.findOne({ class: cls, branch: branch, academicYear: academicYear });
    
    // Default values if no control record exists
    const response = {
      initialEnabled: control ? control.initialEnabled : true,
      finalEnabled: control ? control.finalEnabled : false,
      initialEndDate: control ? control.initialEndDate : null,
      finalEndDate: control ? control.finalEndDate : null
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch round status' });
  }
});


// Get all students for a class, branch, and academic year
app.get('/admin/students', async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    const students = await Student.find({ 
      branch: branch, 
      academicYear: academicYear 
    }).select('name hallticket branch academicYear -_id');
    
    res.json(students);
  } catch (error) {
    console.error('Failed to fetch students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});
// Get all students for a class, branch, and academic year WITH registration status
app.get('/admin/students-with-status', async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    const students = await Student.find({ 
      branch: branch, 
      academicYear: academicYear 
    }).select('name hallticket branch academicYear email password -_id');
    
    // Add registration status
    const studentsWithStatus = students.map(student => ({
      name: student.name,
      hallticket: student.hallticket,
      branch: student.branch,
      academicYear: student.academicYear,
      registered: !!student.email, // true if email exists
      email: student.email || null
    }));
    
    res.json(studentsWithStatus);
  } catch (error) {
    console.error('Failed to fetch students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});
// Admin: Reset student password (clear email and password)
app.put('/admin/reset-student/:hallticket', async (req, res) => {
  try {
    const { hallticket } = req.params;
    const { academicYear } = req.body;
    
    if (!hallticket || !academicYear) {
      return res.status(400).json({ error: 'Hallticket and academic year are required' });
    }
    
    const student = await Student.findOne({ 
      hallticket: hallticket,
      academicYear: academicYear 
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    if (!student.email) {
      return res.status(400).json({ error: 'Student is not registered yet' });
    }
    
    // Clear email and password fields
    student.email = undefined;
    student.password = undefined;
    await student.save();
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully. Student can now register again.',
      student: {
        name: student.name,
        hallticket: student.hallticket,
        branch: student.branch,
        academicYear: student.academicYear
      }
    });
  } catch (error) {
    console.error('Error resetting student password:', error);
    res.status(500).json({ error: 'Failed to reset password: ' + error.message });
  }
});

// Get all feedback submissions for a class, branch, and academic year
app.get('/feedback-submissions', async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    const submissions = await FeedbackSubmission.find({ 
      class: cls, 
      branch: branch, 
      academicYear: academicYear 
    }).select('hallticket initial final initialDate finalDate -_id');
    
    res.json(submissions);
  } catch (error) {
    console.error('Failed to fetch feedback submissions:', error);
    res.status(500).json({ error: 'Failed to fetch feedback submissions' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}...`));