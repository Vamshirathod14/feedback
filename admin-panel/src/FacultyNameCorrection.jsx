import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './FacultyNameCorrection.css';

const FacultyNameCorrection = () => {
  const [faculties, setFaculties] = useState([]);
  const [groupedFaculties, setGroupedFaculties] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [correctName, setCorrectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [endpointsAvailable, setEndpointsAvailable] = useState({
    variations: false,
    preview: false,
    correction: false
  });

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://feedback-mlan.onrender.com';

  // Check which endpoints are available
  const checkEndpoints = async () => {
    try {
      const testResponse = await axios.get(`${API_BASE_URL}/test-faculty-endpoints`);
      console.log('Endpoints test:', testResponse.data);
      setEndpointsAvailable({
        variations: true,
        preview: true,
        correction: true
      });
    } catch (error) {
      console.log('Testing individual endpoints...');
      
      // Test each endpoint individually
      const endpoints = {
        variations: `${API_BASE_URL}/faculty-variations`,
        preview: `${API_BASE_URL}/faculty-preview`,
        correction: `${API_BASE_URL}/correct-faculty-name`
      };

      const results = await Promise.allSettled([
        axios.get(endpoints.variations).then(() => true).catch(() => false),
        axios.get(endpoints.preview + '?originalName=test&newName=test').then(() => true).catch(() => false),
        axios.get(endpoints.correction).then(() => true).catch(() => false)
      ]);

      setEndpointsAvailable({
        variations: results[0].value,
        preview: results[1].value,
        correction: results[2].value
      });

      console.log('Endpoint availability:', endpointsAvailable);
    }
  };

  // Load all data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await checkEndpoints();
      
      // Load basic faculties first
      const facultiesResponse = await axios.get(`${API_BASE_URL}/all-faculties`);
      setFaculties(facultiesResponse.data);
      
      if (endpointsAvailable.variations) {
        // Use the variations endpoint if available
        const variationsResponse = await axios.get(`${API_BASE_URL}/faculty-variations`);
        setGroupedFaculties(variationsResponse.data);
      } else {
        // Fallback: create basic grouping manually
        console.log('Using manual faculty grouping');
        groupFacultiesManually(facultiesResponse.data);
      }
      
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load faculty data');
    } finally {
      setLoading(false);
    }
  };

  // Manual grouping if variations endpoint is not available
  const groupFacultiesManually = (facultyList) => {
    const groups = {};
    
    facultyList.forEach(faculty => {
      const normalized = faculty
        .toLowerCase()
        .replace(/[.\s]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
      
      if (!groups[normalized]) {
        groups[normalized] = [];
      }
      
      if (!groups[normalized].some(f => f.toLowerCase() === faculty.toLowerCase())) {
        groups[normalized].push(faculty);
      }
    });
    
    // Convert to array format and only keep groups with multiple variations
    const variations = Object.entries(groups)
      .filter(([key, variations]) => variations.length > 1)
      .map(([key, variations]) => ({
        key,
        variations: variations.map(name => ({ name, subjectsCount: '?', feedbacksCount: '?', totalCount: '?' })),
        totalRecords: 0
      }));
    
    setGroupedFaculties(variations);
  };

  // Get preview of changes
  const getPreview = async (originalName, newName) => {
    if (!originalName || !newName) {
      toast.error('Please select original faculty name and enter correct name');
      return;
    }

    try {
      if (endpointsAvailable.preview) {
        const response = await axios.get(`${API_BASE_URL}/faculty-preview`, {
          params: { originalName, newName }
        });
        setPreview(response.data);
      } else {
        // Fallback preview
        setPreview({
          originalName,
          newName,
          subjectsCount: 'Unknown (endpoint not available)',
          feedbacksCount: 'Unknown (endpoint not available)',
          performanceCount: 'Unknown (endpoint not available)'
        });
      }
    } catch (error) {
      console.error('Failed to get preview:', error);
      toast.error('Preview endpoint not available');
    }
  };

  // Apply name correction
  const applyCorrection = async (originalName, newName) => {
    if (!originalName || !newName) {
      toast.error('Please select original faculty name and enter correct name');
      return;
    }

    if (!window.confirm(`Are you sure you want to rename "${originalName}" to "${newName}"? This will affect all related records.`)) {
      return;
    }

    try {
      setLoading(true);
      
      if (endpointsAvailable.correction) {
        const response = await axios.post(`${API_BASE_URL}/correct-faculty-name`, {
          originalName,
          newName
        });
        toast.success(`Successfully renamed "${originalName}" to "${newName}"`);
      } else {
        // Fallback: show manual instructions
        toast.info(`Faculty correction endpoint not available. You need to manually update in MongoDB:\n\nUpdate subjects: db.subjects.updateMany({faculty: "${originalName}"}, {$set: {faculty: "${newName}"}})\nUpdate feedbacks: db.feedbacks.updateMany({faculty: "${originalName}"}, {$set: {faculty: "${newName}"}})`);
      }
      
      setPreview(null);
      setCorrectName('');
      setSelectedGroup('');
      
      // Reload data
      loadAllData();
    } catch (error) {
      console.error('Failed to correct faculty name:', error);
      if (error.response?.data?.error) {
        toast.error(`Failed: ${error.response.data.error}`);
      } else {
        toast.error('Failed to correct faculty name. Endpoint may not be available.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-suggest correct name
  const suggestCorrectName = (variations) => {
    if (!variations || variations.length === 0) return '';
    
    const sorted = [...variations].sort((a, b) => {
      const scoreA = getNameScore(a.name);
      const scoreB = getNameScore(b.name);
      return scoreB - scoreA;
    });
    
    return sorted[0].name;
  };

  const getNameScore = (name) => {
    let score = 0;
    if (name.includes('.')) score += 2;
    if (name === name.toUpperCase()) score -= 1;
    if (name.match(/^[A-Z][a-z]+/)) score += 1;
    if (name.includes('Dr.')) score += 3;
    if (name.includes('Prof.')) score += 3;
    return score;
  };

  return (
    <div className="faculty-correction-page">
      <div className="page-header">
        <h1>Faculty Name Correction</h1>
        <p>Fix spelling variations and merge duplicate faculty records</p>
        
        {/* Endpoint Status */}
        <div className="endpoint-status">
          <div className={`status-item ${endpointsAvailable.variations ? 'available' : 'unavailable'}`}>
            Variations Endpoint: {endpointsAvailable.variations ? '✅ Available' : '❌ Not Available'}
          </div>
          <div className={`status-item ${endpointsAvailable.preview ? 'available' : 'unavailable'}`}>
            Preview Endpoint: {endpointsAvailable.preview ? '✅ Available' : '❌ Not Available'}
          </div>
          <div className={`status-item ${endpointsAvailable.correction ? 'available' : 'unavailable'}`}>
            Correction Endpoint: {endpointsAvailable.correction ? '✅ Available' : '❌ Not Available'}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="stats-section">
        <div className="stat-card">
          <h3>Total Faculties</h3>
          <div className="stat-number">{faculties.length}</div>
        </div>
        <div className="stat-card">
          <h3>Groups with Variations</h3>
          <div className="stat-number">{groupedFaculties.length}</div>
        </div>
        <div className="stat-card">
          <h3>Total Variations</h3>
          <div className="stat-number">
            {groupedFaculties.reduce((sum, group) => sum + group.variations.length, 0)}
          </div>
        </div>
      </div>

      {/* Faculty Groups with Variations */}
      <div className="faculty-groups">
        <h2>Faculty Name Variations</h2>
        
        {!endpointsAvailable.variations && (
          <div className="warning-banner">
            ⚠️ Using manual grouping. For better results, add the faculty-variations endpoint to your server.
          </div>
        )}
        
        {groupedFaculties.length === 0 && !loading && (
          <div className="no-variations">
            🎉 No name variations found! All faculty names are consistent.
          </div>
        )}

        {groupedFaculties.map((group, index) => (
          <div key={group.key} className="faculty-group">
            <div className="group-header">
              <h3>Similar Names Group {index + 1}</h3>
              <span className="variation-count">{group.variations.length} variations</span>
            </div>
            
            <div className="variations-list">
              {group.variations.map((variation, idx) => (
                <div key={idx} className="variation-item">
                  <span className="faculty-name">{variation.name}</span>
                  {variation.subjectsCount !== '?' && (
                    <span className="record-count">
                      ({variation.subjectsCount} subjects, {variation.feedbacksCount} feedbacks)
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="correction-controls">
              <div className="suggestion">
                <strong>Suggested name:</strong> 
                <span className="suggested-name">
                  {suggestCorrectName(group.variations)}
                </span>
              </div>
              
              <div className="action-buttons">
                <input
                  type="text"
                  placeholder="Enter correct faculty name..."
                  value={selectedGroup === group.key ? correctName : ''}
                  onChange={(e) => {
                    setCorrectName(e.target.value);
                    setSelectedGroup(group.key);
                  }}
                  className="name-input"
                />
                
                <button
                  onClick={() => getPreview(group.variations[0].name, correctName || suggestCorrectName(group.variations))}
                  className="preview-btn"
                >
                  Preview Changes
                </button>
                
                <button
                  onClick={() => applyCorrection(group.variations[0].name, correctName || suggestCorrectName(group.variations))}
                  className="apply-btn"
                >
                  {endpointsAvailable.correction ? 'Apply Correction' : 'Show Manual Instructions'}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <strong>Quick merge to "{suggestCorrectName(group.variations)}":</strong>
              {group.variations.slice(1).map((variation, idx) => (
                <button
                  key={idx}
                  onClick={() => applyCorrection(variation.name, suggestCorrectName(group.variations))}
                  className="quick-merge-btn"
                >
                  Merge "{variation.name}"
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="preview-section">
          <h3>Preview Changes</h3>
          <div className="preview-content">
            <div className="preview-stats">
              <div><strong>Changing:</strong> "{preview.originalName}" → "{preview.newName}"</div>
              <div><strong>Subjects affected:</strong> {preview.subjectsCount}</div>
              <div><strong>Feedback records affected:</strong> {preview.feedbacksCount}</div>
              {preview.subjectsCount !== 'Unknown (endpoint not available)' && (
                <div><strong>Total records to update:</strong> {preview.subjectsCount + preview.feedbacksCount}</div>
              )}
            </div>
            
            <div className="preview-actions">
              <button
                onClick={() => applyCorrection(preview.originalName, preview.newName)}
                className="confirm-btn"
              >
                {endpointsAvailable.correction ? 'Confirm Changes' : 'Show Manual Instructions'}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Processing...</div>
        </div>
      )}
    </div>
  );
};

export default FacultyNameCorrection;