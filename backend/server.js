require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://feedback-student-panel.onrender.com',
      'http://feedback-student-panel.onrender.com',
      'https://feedback-mlan.onrender.com',
      'http://feedback-mlan.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Handle preflight requests
app.options('*', cors(corsOptions));

// MongoDB connection
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/feedbackSystem';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Models
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
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Simple CSV parser function
function parseCSV(csvString, isSubjects = false) {
  try {
    const lines = csvString.split('\n').filter(line => line.trim());
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Handle quoted CSV values
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      // Skip header row
      const firstValue = values[0] ? values[0].toLowerCase() : '';
      if (i === 0 && (firstValue === 'name' || firstValue === 'subject' || firstValue === 'hallticket')) {
        continue;
      }
      
      if (isSubjects && values.length >= 2) {
        const subject = values[0] || '';
        const faculty = values[1] || '';
        
        if (subject && faculty) {
          result.push({
            subject: subject,
            faculty: faculty
          });
        }
      } else if (!isSubjects && values.length >= 3) {
        const name = values[0] || '';
        const hallticket = values[1] || '';
        const branch = values[2] || '';
        
        if (name && hallticket && branch) {
          result.push({
            name: name,
            hallticket: hallticket,
            branch: branch
          });
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('CSV parsing error:', error);
    return [];
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// =============================================
// FILE UPLOAD ENDPOINTS
// =============================================
// Add this to your server.js - Debug endpoint to find missing faculties
 
// Upload students CSV
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
      return res.status(400).json({ error: 'No valid student data found in CSV' });
    }

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    let newCount = 0;
    
    // Process in batches
    const batchSize = 25;
    
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      
      for (const student of batch) {
        try {
          // Check if student already exists with SAME ACADEMIC YEAR
          const existingStudent = await Student.findOne({ 
            hallticket: student.hallticket,
            academicYear: academicYear
          });
          
          if (existingStudent) {
            // Update existing student
            await Student.updateOne(
              { 
                hallticket: student.hallticket,
                academicYear: academicYear 
              },
              { 
                $set: { 
                  name: student.name, 
                  branch: student.branch,
                  academicYear: academicYear,
                  ...(existingStudent.email && { email: existingStudent.email }),
                  ...(existingStudent.password && { password: existingStudent.password })
                } 
              }
            );
            successCount++;
            duplicateCount++;
          } else {
            // Check if student exists in different academic year
            const studentInOtherYear = await Student.findOne({ 
              hallticket: student.hallticket 
            });
            
            if (studentInOtherYear) {
              // Create NEW record for this academic year
              await Student.create({
                name: student.name,
                hallticket: student.hallticket,
                branch: student.branch,
                academicYear: academicYear,
                password: bcrypt.hashSync(student.hallticket, 10)
              });
              successCount++;
              newCount++;
            } else {
              // Create completely new student
              await Student.create({
                name: student.name,
                hallticket: student.hallticket,
                branch: student.branch,
                academicYear: academicYear,
                password: bcrypt.hashSync(student.hallticket, 10)
              });
              successCount++;
              newCount++;
            }
          }
          
          // Create/update feedback submission record
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
            { upsert: true, new: true }
          );
          
        } catch (error) {
          errorCount++;
        }
      }
      
      // Small delay between batches
      if (i + batchSize < students.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    res.json({ 
      success: true, 
      message: `Students uploaded successfully! ${successCount} records processed (${newCount} new, ${duplicateCount} updated), ${errorCount} errors.`,
      fileName: req.file.originalname,
      stats: {
        total: students.length,
        successful: successCount,
        errors: errorCount,
        new: newCount,
        duplicates: duplicateCount
      }
    });
    
  } catch (error) {
    console.error('Error uploading students:', error);
    res.status(500).json({ 
      error: 'Failed to upload students: ' + error.message
    });
  }
});

// Upload subjects CSV
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
      return res.status(400).json({ error: 'No valid subject data found in CSV' });
    }

    // Delete existing subjects for this class/branch/year
    await Subject.deleteMany({ 
      class: cls, 
      branch: branch, 
      academicYear: academicYear 
    });
    
    // Prepare subjects with class/branch/year info
    const subjectsToInsert = subjects.map(subject => ({
      subject: subject.subject,
      faculty: subject.faculty,
      class: cls,
      branch: branch,
      academicYear: academicYear
    }));

    // Insert all subjects
    let insertedCount = 0;
    try {
      const result = await Subject.insertMany(subjectsToInsert, { ordered: false });
      insertedCount = result.length;
    } catch (error) {
      if (error.writeErrors) {
        insertedCount = subjectsToInsert.length - error.writeErrors.length;
      } else {
        insertedCount = subjectsToInsert.length;
      }
    }

    res.json({ 
      success: true, 
      message: `Subjects uploaded successfully! ${insertedCount} subjects processed.`,
      fileName: req.file.originalname,
      stats: {
        total: subjects.length,
        inserted: insertedCount
      }
    });
    
  } catch (error) {
    console.error('Error uploading subjects:', error);
    res.status(500).json({ 
      error: 'Failed to upload subjects: ' + error.message
    });
  }
});

// =============================================
// AUTHENTICATION ENDPOINTS
// =============================================

// Admin registration
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
      process.env.JWT_SECRET || 'fallback-secret-key', 
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
      process.env.JWT_SECRET || 'fallback-secret-key', 
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
      process.env.JWT_SECRET || 'fallback-secret-key', 
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

// =============================================
// FACULTY MANAGEMENT ENDPOINTS
// =============================================

// Get all unique faculties across all classes and branches
app.get('/all-faculties', async (req, res) => {
  try {
    const faculties = await Subject.distinct('faculty');
    
    // Filter out invalid faculty names
    const filteredFaculties = faculties
      .filter(faculty => {
        if (!faculty || typeof faculty !== 'string') return false;
        
        const cleanFaculty = faculty.trim();
        if (cleanFaculty === '') return false;
        
        // EXCLUDE hallticket patterns and numbers
        if (cleanFaculty.match(/^25C01A73\d{2}$/)) return false;
        if (cleanFaculty.match(/^\d+$/)) return false;
        if (cleanFaculty.match(/^\d{10,12}$/)) return false;
        
        // EXCLUDE common invalid patterns
        const invalidPatterns = [
          'unknown', 'not assigned', 'not available', 'na', 'n/a', 
          'tba', 'to be announced', 'pending', 'null', 'undefined'
        ];
        
        const lowerFaculty = cleanFaculty.toLowerCase();
        if (invalidPatterns.some(pattern => lowerFaculty.includes(pattern))) return false;
        
        // MUST contain alphabetic characters
        if (!cleanFaculty.match(/[a-zA-Z]/)) return false;
        
        return true;
      })
      .map(faculty => faculty.trim())
      .filter((faculty, index, self) => self.indexOf(faculty) === index)
      .sort((a, b) => a.localeCompare(b));
    
    res.json(filteredFaculties);
  } catch (error) {
    console.error('Failed to fetch faculties:', error);
    res.status(500).json({ 
      error: 'Failed to fetch faculties: ' + error.message 
    });
  }
});

// Get faculty name variations for correction
app.get('/faculty-variations', async (req, res) => {
  try {
    const faculties = await Subject.distinct('faculty');
    
    const filteredFaculties = faculties
      .filter(faculty => 
        faculty && 
        typeof faculty === 'string' && 
        faculty.trim() !== '' &&
        !faculty.match(/^\d+$/)
      )
      .sort((a, b) => a.localeCompare(b));
    
    // Group similar faculty names
    const groups = {};
    
    filteredFaculties.forEach(faculty => {
      const normalized = faculty
        .toLowerCase()
        .replace(/[.\s]/g, '')
        .replace(/dr\.?/g, '')
        .replace(/prof\.?/g, '')
        .replace(/\s+/g, '')
        .trim();
      
      if (!groups[normalized]) {
        groups[normalized] = [];
      }
      
      if (!groups[normalized].some(f => f.name === faculty)) {
        groups[normalized].push({
          name: faculty,
          original: faculty
        });
      }
    });
    
    const groupedArray = Object.entries(groups)
      .filter(([key, variations]) => variations.length > 1)
      .map(([key, variations]) => ({
        key,
        variations: variations.sort((a, b) => a.name.localeCompare(b.name))
      }));
    
    res.json(groupedArray);
  } catch (error) {
    console.error('Failed to get faculty variations:', error);
    res.status(500).json({ error: 'Failed to get faculty variations' });
  }
});

// Update faculty name across all records
app.put('/update-faculty-name', async (req, res) => {
  try {
    const { originalName, newName, class: cls, branch, academicYear } = req.body;
    
    if (!originalName || !newName) {
      return res.status(400).json({ error: 'Original name and new name are required' });
    }

    if (originalName === newName) {
      return res.status(400).json({ error: 'Original and new names are the same' });
    }

    // Build update criteria
    const updateCriteria = { faculty: originalName };
    if (cls) updateCriteria.class = cls;
    if (branch) updateCriteria.branch = branch;
    if (academicYear) updateCriteria.academicYear = academicYear;

    // Update subjects
    const subjectsResult = await Subject.updateMany(
      updateCriteria,
      { $set: { faculty: newName } }
    );

    // Update feedback records
    const feedbackResult = await Feedback.updateMany(
      updateCriteria,
      { $set: { faculty: newName } }
    );

    res.json({
      success: true,
      message: `Successfully renamed "${originalName}" to "${newName}"`,
      stats: {
        subjectsUpdated: subjectsResult.modifiedCount,
        feedbacksUpdated: feedbackResult.modifiedCount,
        totalUpdated: subjectsResult.modifiedCount + feedbackResult.modifiedCount
      }
    });

  } catch (error) {
    console.error('Failed to update faculty name:', error);
    res.status(500).json({ error: 'Failed to update faculty name: ' + error.message });
  }
});

// Get complete faculty history with performance data
app.get('/faculty-history', async (req, res) => {
  try {
    const { faculty, class: cls, branch, academicYear } = req.query;
    
    if (!faculty) {
      return res.status(400).json({ error: 'Faculty name is required' });
    }
    
    // Build match criteria for subjects
    const subjectMatchCriteria = { faculty: faculty.trim() };
    if (cls && cls !== '') subjectMatchCriteria.class = cls;
    if (branch && branch !== '') subjectMatchCriteria.branch = branch;
    if (academicYear && academicYear !== '') subjectMatchCriteria.academicYear = academicYear;
    
    // Get all subjects taught by the faculty
    const subjects = await Subject.find(subjectMatchCriteria);
    
    if (subjects.length === 0) {
      return res.json([]);
    }
    
    const facultyHistory = [];
    
    for (const subject of subjects) {
      try {
        // Get ALL feedback for this subject (both rounds)
        const feedbacks = await Feedback.find({
          faculty: subject.faculty,
          subject: subject.subject,
          class: subject.class,
          branch: subject.branch,
          academicYear: subject.academicYear
        });
        
        if (feedbacks.length === 0) {
          // If no feedback, still include the subject but with zero performance
          facultyHistory.push({
            faculty: subject.faculty,
            subject: subject.subject,
            class: subject.class,
            branch: subject.branch,
            academicYear: subject.academicYear,
            overallPercentage: 0,
            studentCount: 0,
            round: 'no-data',
            labs: subject.subject.toLowerCase().includes('lab') ? [subject.subject] : [],
            subjectsHandled: [subject.subject],
            totalSuggestions: 0
          });
          continue;
        }
        
        // Group feedback by round
        const initialFeedbacks = feedbacks.filter(f => f.round === 'initial');
        const finalFeedbacks = feedbacks.filter(f => f.round === 'final');
        
        // Calculate performance for each round
        let round = 'no-data';
        let overallPercentage = 0;
        let studentCount = 0;
        
        // Prefer final round if available, otherwise use initial
        if (finalFeedbacks.length > 0) {
          round = 'final';
          const totalScore = finalFeedbacks.reduce((sum, fb) => {
            return sum + fb.answers.reduce((scoreSum, answer) => scoreSum + answer.score, 0);
          }, 0);
          const totalQuestions = finalFeedbacks.reduce((sum, fb) => sum + fb.answers.length, 0);
          overallPercentage = totalQuestions > 0 ? (totalScore / (totalQuestions * 5)) * 100 : 0;
          studentCount = new Set(finalFeedbacks.map(f => f.hallticket)).size;
        } else if (initialFeedbacks.length > 0) {
          round = 'initial';
          const totalScore = initialFeedbacks.reduce((sum, fb) => {
            return sum + fb.answers.reduce((scoreSum, answer) => scoreSum + answer.score, 0);
          }, 0);
          const totalQuestions = initialFeedbacks.reduce((sum, fb) => sum + fb.answers.length, 0);
          overallPercentage = totalQuestions > 0 ? (totalScore / (totalQuestions * 5)) * 100 : 0;
          studentCount = new Set(initialFeedbacks.map(f => f.hallticket)).size;
        }
        
        // Count suggestions
        const totalSuggestions = feedbacks.filter(f => 
          f.suggestion && f.suggestion.trim() !== ''
        ).length;
        
        facultyHistory.push({
          faculty: subject.faculty,
          subject: subject.subject,
          class: subject.class,
          branch: subject.branch,
          academicYear: subject.academicYear,
          overallPercentage: parseFloat(overallPercentage.toFixed(2)),
          studentCount: studentCount,
          round: round,
          labs: subject.subject.toLowerCase().includes('lab') ? [subject.subject] : [],
          subjectsHandled: [subject.subject],
          totalSuggestions: totalSuggestions
        });
        
      } catch (error) {
        // Continue with next subject instead of returning null
        facultyHistory.push({
          faculty: subject.faculty,
          subject: subject.subject,
          class: subject.class,
          branch: subject.branch,
          academicYear: subject.academicYear,
          overallPercentage: 0,
          studentCount: 0,
          round: 'error',
          labs: [],
          subjectsHandled: [subject.subject],
          totalSuggestions: 0
        });
      }
    }
    
    // Sort by academic year (descending) and class (ascending)
    facultyHistory.sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return b.academicYear.localeCompare(a.academicYear);
      }
      return a.class.localeCompare(b.class);
    });
    
    res.json(facultyHistory);
    
  } catch (error) {
    console.error('Failed to fetch faculty history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch faculty history: ' + error.message
    });
  }
});

// Clean up faculty data - REMOVE HALLTICKETS FROM FACULTY FIELD
app.delete('/cleanup-faculty-data', async (req, res) => {
  try {
    // Pattern to match hallticket numbers
    const hallticketPattern = /^25C01A73\d{2}$/;
    
    // Find and delete subjects where faculty is a hallticket
    const deleteResult = await Subject.deleteMany({
      faculty: { $regex: hallticketPattern }
    });
    
    // Also clean up any feedback records with hallticket as faculty
    const feedbackDeleteResult = await Feedback.deleteMany({
      faculty: { $regex: hallticketPattern }
    });
    
    // Get updated faculty list
    const updatedFaculties = await Subject.distinct('faculty');
    const cleanedFaculties = updatedFaculties
      .filter(faculty => 
        faculty && 
        typeof faculty === 'string' && 
        faculty.trim() !== '' &&
        !faculty.match(/^\d+$/) &&
        !faculty.match(/^25C01A73\d{2}$/)
      )
      .sort((a, b) => a.localeCompare(b));
    
    res.json({
      success: true,
      message: `Cleaned up ${deleteResult.deletedCount} subject records and ${feedbackDeleteResult.deletedCount} feedback records`,
      deletedSubjects: deleteResult.deletedCount,
      deletedFeedbacks: feedbackDeleteResult.deletedCount,
      remainingFaculties: cleanedFaculties.length,
      sampleFaculties: cleanedFaculties.slice(0, 10)
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ 
      error: 'Cleanup failed: ' + error.message 
    });
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

// =============================================
// FEEDBACK & REPORTING ENDPOINTS
// =============================================

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

// Get class-wise report
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
        avgScore: { $divide: ["$totalScore", "$totalResponses"] },
        studentCount: { $size: "$studentCount" }
      }},
      { $project: {
        subject: 1,
        faculty: 1,
        studentCount: 1,
        overallPercentage: { $multiply: [{ $divide: ["$avgScore", 5] }, 100] }
      }}
    ]);
    
    res.json(agg);
  } catch (error) {
    console.error('Failed to fetch class report:', error);
    res.status(500).json({ error: 'Failed to fetch class report' });
  }
});

// Get department-wise report
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
        avgScore: { $divide: ["$totalScore", "$totalResponses"] },
        studentCount: { $size: "$studentCount" }
      }},
      { $project: {
        class: 1,
        studentCount: 1,
        overallPercentage: { $multiply: [{ $divide: ["$avgScore", 5] }, 100] }
      }}
    ]);
    
    res.json(agg);
  } catch (error) {
    console.error('Failed to fetch department report:', error);
    res.status(500).json({ error: 'Failed to fetch department report' });
  }
});

// =============================================
// STUDENT ENDPOINTS
// =============================================

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

// Get subjects for a class/branch
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

// Check if email is available
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

// Check if feedback already submitted
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

// =============================================
// ADMIN MANAGEMENT ENDPOINTS
// =============================================

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

// Enable/disable rounds
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
      if (enabled) updateData.finalEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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

// Get round status
app.get('/round-status', async (req, res) => {
  try {
    const { class: cls, branch, academicYear } = req.query;
    
    if (!cls || !branch || !academicYear) {
      return res.status(400).json({ error: 'Class, branch, and academic year are required' });
    }
    
    const control = await RoundControl.findOne({ class: cls, branch: branch, academicYear: academicYear });
    
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

// Get all students with registration status
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
    
    const studentsWithStatus = students.map(student => ({
      name: student.name,
      hallticket: student.hallticket,
      branch: student.branch,
      academicYear: student.academicYear,
      registered: !!student.email,
      email: student.email || null
    }));
    
    res.json(studentsWithStatus);
  } catch (error) {
    console.error('Failed to fetch students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Admin: Reset student password
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

// Get all feedback submissions
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

// =============================================
// ERROR HANDLING
// =============================================

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}...`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});