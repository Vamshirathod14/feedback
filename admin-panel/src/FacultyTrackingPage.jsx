import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './FacultyTrackingPage.css';

const FacultyTrackingPage = () => {
  const [faculties, setFaculties] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [facultyHistory, setFacultyHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    class: '',
    branch: '',
    academicYear: ''
  });

  const tableRef = useRef();

  // Sample data for classes, branches, academic years
  const classes = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2"];
  const branches = ["CSE-A", "CSE-B", "CSE-C", "CSE-D", "CSM", "AIML", "ECE", "EEE", "CSE-E"];
  const academicYears = ["2025-2026", "2026-2027", "2027-2028", "2028-2029"];

  // Load all faculties
  useEffect(() => {
    loadAllFaculties();
  }, []);

  const loadAllFaculties = async () => {
    try {
      const response = await axios.get('http://localhost:4000/all-faculties');
      setFaculties(response.data);
    } catch (error) {
      console.error('Failed to load faculties:', error);
      toast.error('Failed to load faculty list');
    }
  };

  // Load faculty history when faculty is selected
  useEffect(() => {
    if (selectedFaculty) {
      loadFacultyHistory();
    }
  }, [selectedFaculty, filters]);

  const loadFacultyHistory = async () => {
    if (!selectedFaculty) return;

    setLoading(true);
    try {
      const params = {
        faculty: selectedFaculty,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await axios.get('http://localhost:4000/faculty-history', { params });
      setFacultyHistory(response.data);
    } catch (error) {
      console.error('Failed to load faculty history:', error);
      toast.error('Failed to load faculty history');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      class: '',
      branch: '',
      academicYear: ''
    });
  };

  // Calculate overall performance percentage
  const calculateOverallPerformance = (history) => {
    if (!history || history.length === 0) return 0;
    
    const totalPerformance = history.reduce((sum, record) => {
      return sum + (record.overallPercentage || 0);
    }, 0);
    
    return (totalPerformance / history.length).toFixed(2);
  };

  // Get unique subjects taught by faculty
  const getUniqueSubjects = (history) => {
    if (!history) return [];
    const subjects = [...new Set(history.map(record => record.subject))];
    return subjects;
  };

  // Get unique departments taught by faculty
  const getUniqueDepartments = (history) => {
    if (!history) return [];
    const departments = [...new Set(history.map(record => record.branch))];
    return departments;
  };

  // Get performance by class
  const getPerformanceByClass = (history) => {
    if (!history) return {};
    
    const performanceByClass = {};
    history.forEach(record => {
      if (!performanceByClass[record.class]) {
        performanceByClass[record.class] = [];
      }
      performanceByClass[record.class].push(record.overallPercentage || 0);
    });

    // Calculate average for each class
    Object.keys(performanceByClass).forEach(className => {
      const performances = performanceByClass[className];
      const average = performances.reduce((sum, perf) => sum + perf, 0) / performances.length;
      performanceByClass[className] = average.toFixed(2);
    });

    return performanceByClass;
  };

  // Generate PDF Report
  const generatePDFReport = () => {
    if (!selectedFaculty || !facultyHistory || facultyHistory.length === 0) {
      toast.error('No data available to generate report');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Add header with logo and institute info
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 150);
      doc.text("SCIENT INSTITUTE OF TECHNOLOGY", pageWidth / 2, 15, { align: "center" });
      
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 180);
      doc.text("(UGC AUTONOMOUS)", pageWidth / 2, 22, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Accredited by NAAC with A+ Grade", pageWidth / 2, 29, { align: "center" });
      doc.text("Affiliated to JNTUH & Approved by AICTE", pageWidth / 2, 36, { align: "center" });
      doc.text("Ibrahimpatnam, Rangareddy, Telangana-501506", pageWidth / 2, 43, { align: "center" });
      
      // Add line separator
      doc.setDrawColor(40, 40, 150);
      doc.setLineWidth(0.8);
      doc.line(14, 48, pageWidth - 14, 48);
      
      let startY = 60;
      
      // Report Title
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text("FACULTY PERFORMANCE TRACKING REPORT", pageWidth / 2, startY, { align: "center" });
      startY += 15;
      
      // Faculty Information
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Faculty Name: ${selectedFaculty}`, 14, startY);
      startY += 7;
      
      doc.setFont(undefined, 'normal');
      if (filters.class) {
        doc.text(`Class: ${filters.class}`, 14, startY);
        startY += 5;
      }
      if (filters.branch) {
        doc.text(`Branch: ${filters.branch}`, 14, startY);
        startY += 5;
      }
      if (filters.academicYear) {
        doc.text(`Academic Year: ${filters.academicYear}`, 14, startY);
        startY += 5;
      }
      
      doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 14, startY);
      startY += 10;
      
      // Summary Section
      doc.setFont(undefined, 'bold');
      doc.text("SUMMARY", 14, startY);
      startY += 8;
      
      const overallPerformance = calculateOverallPerformance(facultyHistory);
      const uniqueSubjects = getUniqueSubjects(facultyHistory);
      const uniqueDepartments = getUniqueDepartments(facultyHistory);
      const performanceByClass = getPerformanceByClass(facultyHistory);
      
      const summaryData = [
        ['Overall Performance', `${overallPerformance}%`],
        ['Total Subjects Handled', uniqueSubjects.length],
        ['Departments', uniqueDepartments.join(', ')],
        ['Total Records', facultyHistory.length],
        ['Classes Taught', Object.keys(performanceByClass).join(', ')]
      ];
      
      autoTable(doc, {
        startY: startY,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 10,
          cellPadding: 3
        },
        margin: { left: 14, right: 14 }
      });
      
      startY = doc.lastAutoTable.finalY + 15;
      
      // Performance by Class Section
      if (Object.keys(performanceByClass).length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text("PERFORMANCE BY CLASS", 14, startY);
        startY += 8;
        
        const classPerformanceData = Object.entries(performanceByClass).map(([className, performance]) => [
          className,
          `${performance}%`
        ]);
        
        autoTable(doc, {
          startY: startY,
          head: [['Class', 'Average Performance (%)']],
          body: classPerformanceData,
          theme: 'grid',
          headStyles: {
            fillColor: [52, 152, 219],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 10,
            cellPadding: 3
          },
          margin: { left: 14, right: 14 }
        });
        
        startY = doc.lastAutoTable.finalY + 15;
      }
      
      // Detailed History Section
      doc.setFont(undefined, 'bold');
      doc.text("DETAILED TEACHING HISTORY", 14, startY);
      startY += 8;
      
      const tableData = facultyHistory.map(record => [
        record.academicYear || 'N/A',
        record.class || 'N/A',
        record.branch || 'N/A',
        record.subject || 'N/A',
        record.round ? record.round.toUpperCase() : 'N/A',
        `${record.overallPercentage?.toFixed(2) || '0.00'}%`,
        record.studentCount || 'N/A'
      ]);
      
      autoTable(doc, {
        startY: startY,
        head: [['Academic Year', 'Class', 'Branch', 'Subject', 'Round', 'Performance (%)', 'Students']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [44, 62, 80],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak'
        },
        margin: { left: 14, right: 14 },
        pageBreak: 'auto'
      });
      
      // Add footer with page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
        doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: "center" });
      }
      
      // Save the PDF
      const fileName = `Faculty_Report_${selectedFaculty.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success('PDF report generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  // Generate Detailed Performance PDF
  const generateDetailedPerformancePDF = () => {
    if (!selectedFaculty || !facultyHistory || facultyHistory.length === 0) {
      toast.error('No data available to generate report');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 150);
      doc.text("DETAILED FACULTY PERFORMANCE ANALYSIS", pageWidth / 2, 15, { align: "center" });
      
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 180);
      doc.text(selectedFaculty, pageWidth / 2, 25, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("SCIENT INSTITUTE OF TECHNOLOGY", pageWidth / 2, 32, { align: "center" });
      
      // Line separator
      doc.setDrawColor(40, 40, 150);
      doc.setLineWidth(0.8);
      doc.line(14, 38, pageWidth - 14, 38);
      
      let startY = 50;
      
      // Performance Analysis by Subject
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text("PERFORMANCE ANALYSIS BY SUBJECT", 14, startY);
      startY += 10;
      
      // Group by subject and calculate averages
      const subjectPerformance = {};
      facultyHistory.forEach(record => {
        if (!subjectPerformance[record.subject]) {
          subjectPerformance[record.subject] = {
            performances: [],
            classes: new Set(),
            rounds: new Set()
          };
        }
        subjectPerformance[record.subject].performances.push(record.overallPercentage || 0);
        subjectPerformance[record.subject].classes.add(record.class);
        if (record.round) subjectPerformance[record.subject].rounds.add(record.round);
      });
      
      const subjectAnalysisData = Object.entries(subjectPerformance).map(([subject, data]) => {
        const avgPerformance = (data.performances.reduce((a, b) => a + b, 0) / data.performances.length).toFixed(2);
        return [
          subject,
          avgPerformance + '%',
          data.classes.size,
          Array.from(data.rounds).join(', ')
        ];
      });
      
      autoTable(doc, {
        startY: startY,
        head: [['Subject', 'Avg Performance', 'Classes', 'Rounds']],
        body: subjectAnalysisData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        margin: { left: 14, right: 14 }
      });
      
      startY = doc.lastAutoTable.finalY + 15;
      
      // Department-wise Performance
      doc.setFont(undefined, 'bold');
      doc.text("DEPARTMENT-WISE PERFORMANCE", 14, startY);
      startY += 8;
      
      const departmentPerformance = {};
      facultyHistory.forEach(record => {
        if (!departmentPerformance[record.branch]) {
          departmentPerformance[record.branch] = [];
        }
        departmentPerformance[record.branch].push(record.overallPercentage || 0);
      });
      
      const departmentData = Object.entries(departmentPerformance).map(([dept, performances]) => {
        const avg = (performances.reduce((a, b) => a + b, 0) / performances.length).toFixed(2);
        return [dept, performances.length, avg + '%'];
      });
      
      autoTable(doc, {
        startY: startY,
        head: [['Department', 'Records', 'Avg Performance']],
        body: departmentData,
        theme: 'grid',
        headStyles: {
          fillColor: [52, 152, 219],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        margin: { left: 14, right: 14 }
      });
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
      }
      
      const fileName = `Detailed_Performance_${selectedFaculty.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast.success('Detailed performance report generated!');
    } catch (error) {
      console.error('Error generating detailed PDF:', error);
      toast.error('Failed to generate detailed report');
    }
  };

  return (
    <div className="faculty-tracking-page">
      <div className="page-header">
        <h1>Faculty Performance Tracking</h1>
        <p>Track and analyze faculty performance across different classes and subjects</p>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Select Faculty:</label>
          <select 
            value={selectedFaculty} 
            onChange={(e) => setSelectedFaculty(e.target.value)}
            className="faculty-select"
          >
            <option value="">Choose a faculty...</option>
            {faculties.map((faculty, index) => (
              <option key={index} value={faculty}>
                {faculty}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label>Class:</label>
            <select 
              value={filters.class} 
              onChange={(e) => handleFilterChange('class', e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Branch:</label>
            <select 
              value={filters.branch} 
              onChange={(e) => handleFilterChange('branch', e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Academic Year:</label>
            <select 
              value={filters.academicYear} 
              onChange={(e) => handleFilterChange('academicYear', e.target.value)}
            >
              <option value="">All Years</option>
              {academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <button onClick={clearFilters} className="clear-filters-btn">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Report Generation Buttons */}
      {selectedFaculty && facultyHistory && facultyHistory.length > 0 && (
        <div className="report-buttons-section">
          <h3>Generate Reports</h3>
          <div className="report-buttons">
            <button onClick={generatePDFReport} className="report-btn primary">
              📊 Generate Summary PDF Report
            </button>
            <button onClick={generateDetailedPerformancePDF} className="report-btn secondary">
              📈 Generate Detailed Performance PDF
            </button>
          </div>
        </div>
      )}

      {/* Faculty Summary */}
      {selectedFaculty && facultyHistory && (
        <div className="faculty-summary">
          <h2>Faculty Summary: {selectedFaculty}</h2>
          <div className="summary-cards">
            <div className="summary-card">
              <h3>Overall Performance</h3>
              <div className="performance-score">
                {calculateOverallPerformance(facultyHistory)}%
              </div>
            </div>
            
            <div className="summary-card">
              <h3>Subjects Taught</h3>
              <div className="count">{getUniqueSubjects(facultyHistory).length}</div>
              <div className="subjects-list">
                {getUniqueSubjects(facultyHistory).slice(0, 3).join(', ')}
                {getUniqueSubjects(facultyHistory).length > 3 && '...'}
              </div>
            </div>
            
            <div className="summary-card">
              <h3>Departments</h3>
              <div className="count">{getUniqueDepartments(facultyHistory).length}</div>
              <div className="departments-list">
                {getUniqueDepartments(facultyHistory).join(', ')}
              </div>
            </div>
            
            <div className="summary-card">
              <h3>Total Records</h3>
              <div className="count">{facultyHistory.length}</div>
              <div className="records-info">
                Across {Object.keys(getPerformanceByClass(facultyHistory)).length} classes
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance by Class */}
      {selectedFaculty && facultyHistory && (
        <div className="performance-by-class">
          <h3>Performance by Class</h3>
          <div className="class-performance-grid">
            {Object.entries(getPerformanceByClass(facultyHistory)).map(([className, performance]) => (
              <div key={className} className="class-performance-card">
                <div className="class-name">{className}</div>
                <div className="class-performance">{performance}%</div>
                <div className="performance-bar">
                  <div 
                    className="performance-fill" 
                    style={{ width: `${performance}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed History Table */}
      {selectedFaculty && (
        <div className="history-section">
          <div className="section-header">
            <h3>Detailed Teaching History</h3>
            <div className="action-buttons">
              <button onClick={loadFacultyHistory} className="refresh-btn" disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading faculty history...</div>
          ) : facultyHistory && facultyHistory.length > 0 ? (
            <div className="table-container" ref={tableRef}>
              <table className="faculty-history-table">
                <thead>
                  <tr>
                    <th>Academic Year</th>
                    <th>Class</th>
                    <th>Branch</th>
                    <th>Subject</th>
                    <th>Round</th>
                    <th>Performance</th>
                    <th>Student Count</th>
                    <th>Subjects Handled</th>
                    <th>Labs</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyHistory.map((record, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'even' : 'odd'}>
                      <td>{record.academicYear}</td>
                      <td>{record.class}</td>
                      <td>{record.branch}</td>
                      <td className="subject-cell">{record.subject}</td>
                      <td>
                        <span className={`round-badge ${record.round}`}>
                          {record.round}
                        </span>
                      </td>
                      <td>
                        <div className="performance-cell">
                          <span className="percentage">{record.overallPercentage?.toFixed(2)}%</span>
                          <div className="performance-bar-small">
                            <div 
                              className="performance-fill-small" 
                              style={{ width: `${record.overallPercentage || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>{record.studentCount || 'N/A'}</td>
                      <td>
                        {record.subjectsHandled && record.subjectsHandled.length > 0 
                          ? record.subjectsHandled.join(', ')
                          : record.subject
                        }
                      </td>
                      <td>
                        {record.labs && record.labs.length > 0 
                          ? record.labs.join(', ')
                          : 'No Labs'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data">
              No teaching history found for {selectedFaculty} with the current filters.
            </div>
          )}
        </div>
      )}

      {!selectedFaculty && (
        <div className="placeholder">
          <div className="placeholder-icon">👨‍🏫</div>
          <h3>Select a Faculty to View Details</h3>
          <p>Choose a faculty member from the dropdown above to see their complete teaching history and performance metrics.</p>
        </div>
      )}
    </div>
  );
};

export default FacultyTrackingPage;