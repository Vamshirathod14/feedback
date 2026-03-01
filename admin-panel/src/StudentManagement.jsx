import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './StudentManagement.css';

function StudentManagement() {
  const [classSel, setClassSel] = useState("");
  const [branchSel, setBranchSel] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  
  // Form states
  const [newStudent, setNewStudent] = useState({
    name: "",
    hallticket: "",
    branch: "",
    academicYear: "",
    class: ""
  });
  
  const [editStudent, setEditStudent] = useState({
    name: "",
    hallticket: "",
    branch: "",
    email: ""
  });

  const classes = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2"];
  const branches = ["CSE-A", "CSE-B", "CSE-C", "CSE-D", "CSM", "AIML", "ECE", "EEE", "CSE-E"];
  const academicYears = ["2025-2026", "2026-2027", "2027-2028", "2028-2029"];

  // Convert academic year to graduation year format
  const convertToGraduationYear = (academicYear, classSel) => {
    if (!academicYear) return "";
    
    const startYear = parseInt(academicYear.split('-')[0]);
    
    if (classSel) {
      const yearPart = classSel.split('-')[0];
      const yearNumber = parseInt(yearPart);
      
      if (!isNaN(yearNumber)) {
        const graduationYear = startYear + (4 - yearNumber);
        return `${startYear}-${graduationYear}`;
      }
    }
    
    return `${startYear}-${startYear + 4}`;
  };

  // Load students with registration status
  const loadStudents = async () => {
    if (!classSel || !branchSel || !academicYear) {
      toast.error("Please select class, branch and academic year first!");
      return;
    }

    setLoading(true);
    try {
      const graduationYear = convertToGraduationYear(academicYear, classSel);
      
      const response = await axios.get('https://feedback-mlan.onrender.com/admin/students-with-status', {
        params: {
          class: classSel,
          branch: branchSel,
          academicYear: graduationYear
        }
      });
      
      setStudents(response.data);
      toast.success(`Loaded ${response.data.length} students`);
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  // Add new student
  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.hallticket) {
      toast.error("Name and hallticket are required");
      return;
    }

    if (!/^[A-Z0-9]+$/.test(newStudent.hallticket)) {
      toast.error("Hallticket should contain only uppercase letters and numbers");
      return;
    }

    setLoading(true);
    try {
      const graduationYear = convertToGraduationYear(academicYear, classSel);
      
      const response = await axios.post('https://feedback-mlan.onrender.com/admin/add-student', {
        name: newStudent.name,
        hallticket: newStudent.hallticket,
        branch: branchSel,
        academicYear: graduationYear,
        class: classSel
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setShowAddModal(false);
        setNewStudent({
          name: "",
          hallticket: "",
          branch: "",
          academicYear: "",
          class: ""
        });
        loadStudents();
      }
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error(error.response?.data?.error || "Failed to add student");
    } finally {
      setLoading(false);
    }
  };

  // Edit student
  const handleEditStudent = async () => {
    if (!editStudent.name || !editStudent.branch) {
      toast.error("Name and branch are required");
      return;
    }

    setLoading(true);
    try {
      const graduationYear = convertToGraduationYear(academicYear, classSel);
      
      const response = await axios.put(
        `https://feedback-mlan.onrender.com/admin/update-student/${editStudent.hallticket}`,
        {
          name: editStudent.name,
          branch: editStudent.branch,
          email: editStudent.email,
          academicYear: graduationYear,
          class: classSel
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setShowEditModal(false);
        setSelectedStudent(null);
        loadStudents();
      }
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error(error.response?.data?.error || "Failed to update student");
    } finally {
      setLoading(false);
    }
  };

  // Delete student
  const handleDeleteStudent = async (hallticket) => {
    if (!window.confirm("Are you sure you want to delete this student?")) {
      return;
    }

    setLoading(true);
    try {
      const graduationYear = convertToGraduationYear(academicYear, classSel);
      
      const response = await axios.delete(
        `https://feedback-mlan.onrender.com/admin/delete-student/${hallticket}`,
        {
          params: { academicYear: graduationYear }
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        loadStudents();
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error(error.response?.data?.error || "Failed to delete student");
    } finally {
      setLoading(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) {
      toast.warning("No students selected");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedStudents.length} selected students?`)) {
      return;
    }

    setLoading(true);
    try {
      const graduationYear = convertToGraduationYear(academicYear, classSel);
      
      const response = await axios.post(
        'https://feedback-mlan.onrender.com/admin/bulk-delete-students',
        {
          halltickets: selectedStudents,
          academicYear: graduationYear
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        setSelectedStudents([]);
        loadStudents();
      }
    } catch (error) {
      console.error('Error bulk deleting students:', error);
      toast.error(error.response?.data?.error || "Failed to delete students");
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetStudentPassword = async (student) => {
    if (!window.confirm(`Reset password for ${student.name}? Password will be reset to hallticket number.`)) {
      return;
    }

    setLoading(true);
    try {
      const graduationYear = convertToGraduationYear(academicYear, classSel);
      
      const response = await axios.post(
        `https://feedback-mlan.onrender.com/admin/reset-student-password/${student.hallticket}`,
        { academicYear: graduationYear }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        loadStudents();
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(error.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  // Toggle student selection
  const toggleSelectStudent = (hallticket) => {
    setSelectedStudents(prev =>
      prev.includes(hallticket)
        ? prev.filter(h => h !== hallticket)
        : [...prev, hallticket]
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.hallticket));
    }
  };

  // Filter students based on search term
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.hallticket.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset all selections
  const resetSelections = () => {
    setClassSel("");
    setBranchSel("");
    setAcademicYear("");
    setStudents([]);
    setSearchTerm("");
    setSelectedStudents([]);
  };

  // Open edit modal
  const openEditModal = (student) => {
    setEditStudent({
      name: student.name,
      hallticket: student.hallticket,
      branch: student.branch,
      email: student.email || ""
    });
    setSelectedStudent(student);
    setShowEditModal(true);
  };

  return (
    <div className="student-management-page">
      {/* Header */}
      <div className="page-header">
        <h2>Student Management</h2>
        <p>Add, edit, delete, and manage students in the selected class</p>
      </div>

      {/* Selection Section */}
      <div className="selection-section">
        <h3>Select Class, Branch and Academic Year</h3>
        <div className="selection-row">
          <select value={classSel} onChange={e => setClassSel(e.target.value)}>
            <option value="">Select Class</option>
            {classes.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
          
          <select value={branchSel} onChange={e => setBranchSel(e.target.value)}>
            <option value="">Select Branch</option>
            {branches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>

          <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
            <option value="">Select Academic Year</option>
            {academicYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <button 
            onClick={loadStudents} 
            disabled={!classSel || !branchSel || !academicYear || loading}
            className="btn-load"
          >
            {loading ? 'Loading...' : 'Load Students'}
          </button>

          <button onClick={resetSelections} className="btn-reset">
            Reset
          </button>
        </div>
      </div>

      {/* Students List Section */}
      {students.length > 0 && (
        <div className="students-section">
          <div className="section-header">
            <div className="header-left">
              <h3>Students List - {classSel} {branchSel} ({academicYear})</h3>
              <div className="students-count">
                Total: {students.length} students
              </div>
            </div>
            <div className="header-actions">
              <button 
                onClick={() => setShowAddModal(true)}
                className="btn-add"
                disabled={loading}
              >
                ➕ Add Student
              </button>
              {selectedStudents.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="btn-bulk-delete"
                  disabled={loading}
                >
                  🗑️ Delete Selected ({selectedStudents.length})
                </button>
              )}
            </div>
          </div>

          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name or hallticket..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>

          <div className="students-table-container">
            <table className="students-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>#</th>
                  <th>Hall Ticket</th>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Academic Year</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => (
                  <tr key={student.hallticket} className={student.registered ? 'registered' : 'not-registered'}>
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.hallticket)}
                        onChange={() => toggleSelectStudent(student.hallticket)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td className="hallticket">{student.hallticket}</td>
                    <td className="name">{student.name}</td>
                    <td className="branch">{student.branch}</td>
                    <td className="academic-year">{student.academicYear}</td>
                    <td className="status">
                      <span className={`status-badge ${student.registered ? 'registered' : 'not-registered'}`}>
                        {student.registered ? 'Registered' : 'Not Registered'}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        onClick={() => openEditModal(student)}
                        className="btn-icon edit"
                        title="Edit student"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => resetStudentPassword(student)}
                        disabled={!student.registered}
                        className={`btn-icon reset ${!student.registered ? 'disabled' : ''}`}
                        title={student.registered ? "Reset password" : "Student not registered"}
                      >
                        🔑
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student.hallticket)}
                        className="btn-icon delete"
                        title="Delete student"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredStudents.length === 0 && (
              <div className="no-results">
                No students found matching your search criteria.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New Student</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                  placeholder="Enter student name"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Hallticket *</label>
                <input
                  type="text"
                  value={newStudent.hallticket}
                  onChange={(e) => setNewStudent({...newStudent, hallticket: e.target.value.toUpperCase()})}
                  placeholder="Enter hallticket (e.g., 25C01A7301)"
                />
              </div>
              <div className="form-info">
                <p>Student will be added to:</p>
                <ul>
                  <li><strong>Class:</strong> {classSel}</li>
                  <li><strong>Branch:</strong> {branchSel}</li>
                  <li><strong>Academic Year:</strong> {academicYear}</li>
                </ul>
                <p className="note">Default password will be the hallticket number</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleAddStudent}
                disabled={loading}
              >
                {loading ? "Adding..." : "Add Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Student</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Hallticket</label>
                <input
                  type="text"
                  value={editStudent.hallticket}
                  disabled
                  className="disabled"
                />
              </div>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={editStudent.name}
                  onChange={(e) => setEditStudent({...editStudent, name: e.target.value})}
                  placeholder="Enter student name"
                />
              </div>
              <div className="form-group">
                <label>Branch *</label>
                <input
                  type="text"
                  value={editStudent.branch}
                  onChange={(e) => setEditStudent({...editStudent, branch: e.target.value})}
                  placeholder="Enter branch"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editStudent.email}
                  onChange={(e) => setEditStudent({...editStudent, email: e.target.value})}
                  placeholder="Enter email (optional)"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleEditStudent}
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Section */}
      <div className="instructions-section">
        <h4>How to Use This Page:</h4>
        <div className="instructions-grid">
          <div className="instruction-card">
            <div className="instruction-icon">1</div>
            <h5>Select Class</h5>
            <p>Choose class, branch, and academic year to filter students</p>
          </div>
          <div className="instruction-card">
            <div className="instruction-icon">2</div>
            <h5>Load Students</h5>
            <p>Click "Load Students" to display all students in the selected class</p>
          </div>
          <div className="instruction-card">
            <div className="instruction-icon">3</div>
            <h5>Add Student</h5>
            <p>Click "Add Student" to add a new student to the current class</p>
          </div>
          <div className="instruction-card">
            <div className="instruction-icon">4</div>
            <h5>Manage Students</h5>
            <p>Use action buttons to edit, reset password, or delete individual students</p>
          </div>
        </div>

        <div className="important-notes">
          <h5>Important Notes:</h5>
          <ul>
            <li>✅ Add individual students for middle-of-year admissions</li>
            <li>✅ Edit student information when corrections are needed</li>
            <li>✅ Reset password if a student forgets their credentials</li>
            <li>✅ Delete students who have left or were added by mistake</li>
            <li>✅ Use checkboxes for bulk delete operations</li>
            <li>✅ Default password for new students is their hallticket number</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default StudentManagement;