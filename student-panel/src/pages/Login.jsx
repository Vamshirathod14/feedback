// src/pages/Login.jsx
import React, { useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import './Login.css';
 

// API base URL configuration
const API_BASE_URL = 'https://feedback-mlan.onrender.com';

function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [register, setRegister] = useState({ 
    email: "", 
    password: "", 
    confirmPassword: "",
    hallticket: "" 
  });
  const [login, setLogin] = useState({ hallticket: "", password: "" });
  const [validation, setValidation] = useState({
    hallticket: { isValid: false, message: "" },
    email: { isValid: false, message: "" },
    password: { isValid: false, message: "" }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(""); // "login" or "register"
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTechSupport, setShowTechSupport] = useState(false);

  // Technical Support Component
   // Technical Support Component
const TechnicalSupport = () => {
  if (!showTechSupport) return null;

   const contactDetails = {
  developer: {
    name: "Vamshi Ramavath",
    email: "vamshinaikramavath@gmail.com",
    phone: "+91 9014243908",
    role: "Lead Developer - V Soft",
    photo: "/vsoft_founder.jpg" // Note the leading slash
  }
};

  const handleContact = (method) => {
    switch (method) {
      case 'whatsapp':
        window.open(`https://wa.me/919014243908?text=Hello%20Vamshi,%20I%20need%20help%20with%20the%20feedback%20system.`);
        break;
      case 'phone':
        window.open(`tel:${contactDetails.developer.phone}`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="support-modal-overlay" onClick={() => setShowTechSupport(false)}>
      <div className="support-modal" onClick={(e) => e.stopPropagation()}>
        <div className="support-header">
          <h3>🛠️ Developer Support</h3>
          <button className="support-close" onClick={() => setShowTechSupport(false)}>×</button>
        </div>
        
        <div className="support-content">
          <div className="support-section">
            <div className="contact-card">
              {/* Your Photo Section */}
              <div className="developer-photo-section">
                <img 
                  src={contactDetails.developer.photo} 
                  alt={contactDetails.developer.name}
                  className="developer-photo"
                />
                <div className="developer-badge">
                  <span className="badge-icon">👨‍💻</span>
                  <span>Developer</span>
                </div>
              </div>
              
              <div className="contact-info">
                <h4>{contactDetails.developer.name}</h4>
                <p className="developer-role">{contactDetails.developer.role}</p>
                <div className="contact-details">
                  <p className="contact-item">
                    <span className="contact-icon">📱</span>
                    <span>{contactDetails.developer.phone}</span>
                  </p>
                </div>
              </div>
              
              <div className="contact-actions">
                <button onClick={() => handleContact('whatsapp')} className="btn-whatsapp">
                  💬 WhatsApp
                </button>
                <button onClick={() => handleContact('phone')} className="btn-call">
                  📞 Call
                </button>
              </div>
            </div>
          </div>

          <div className="quick-solutions">
            <h4>🚀 Quick Solutions</h4>
            <div className="solutions-list">
              <div className="solution-item">
                <span className="solution-icon">🌐</span>
                <div>
                  <strong>Check Internet Connection</strong>
                  <p>Ensure you have stable internet access</p>
                </div>
              </div>
              <div className="solution-item">
                <span className="solution-icon">🧹</span>
                <div>
                  <strong>Clear Browser Cache</strong>
                  <p>Clear cache and try again</p>
                </div>
              </div>
              <div className="solution-item">
                <span className="solution-icon">🔍</span>
                <div>
                  <strong>Try Different Browser</strong>
                  <p>Use Chrome, Firefox, or Edge</p>
                </div>
              </div>
              <div className="solution-item">
                <span className="solution-icon">🔄</span>
                <div>
                  <strong>Restart Device</strong>
                  <p>Sometimes a simple restart helps</p>
                </div>
              </div>
            </div>
          </div>

          <div className="support-footer">
            <p>I'll respond to your query as soon as possible! ⚡</p>
          </div>
        </div>
      </div>
    </div>
  );
};

  // Check if hallticket is valid and available for registration
  const checkHallticket = async (hallticket) => {
    if (!hallticket || hallticket.length < 3) {
      setValidation(prev => ({
        ...prev,
        hallticket: { isValid: false, message: "Please enter a hallticket number" }
      }));
      return;
    }
    
    try {
      const res = await axios.get(`${API_BASE_URL}/check-hallticket/${hallticket}`, {
        timeout: 10000
      });
      
      if (!res.data.exists) {
        setValidation(prev => ({
          ...prev,
          hallticket: { isValid: false, message: "Hallticket not found in system" }
        }));
      } else if (res.data.registered) {
        setValidation(prev => ({
          ...prev,
          hallticket: { isValid: false, message: "Hallticket already registered" }
        }));
      } else {
        setValidation(prev => ({
          ...prev,
          hallticket: { isValid: true, message: "Hallticket available" }
        }));
      }
    } catch (error) {
      console.error('Hallticket check error:', error);
      setValidation(prev => ({
        ...prev,
        hallticket: { isValid: false, message: "Error checking hallticket. Please try again." }
      }));
    }
  };

  // Check if email is available
  const checkEmail = async (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      setValidation(prev => ({
        ...prev,
        email: { isValid: false, message: "Please enter an email" }
      }));
      return;
    }
    
    if (!emailRegex.test(email)) {
      setValidation(prev => ({
        ...prev,
        email: { isValid: false, message: "Please enter a valid email address" }
      }));
      return;
    }
    
    try {
      const res = await axios.get(`${API_BASE_URL}/check-email/${email}`, {
        timeout: 10000
      });
      
      if (!res.data.available) {
        setValidation(prev => ({
          ...prev,
          email: { isValid: false, message: "Email already registered" }
        }));
      } else {
        setValidation(prev => ({
          ...prev,
          email: { isValid: true, message: "Email available" }
        }));
      }
    } catch (error) {
      console.error('Email check error:', error);
      setValidation(prev => ({
        ...prev,
        email: { isValid: false, message: "Error checking email. Please try again." }
      }));
    }
  };

  // Check password strength and confirm password match
  const checkPassword = (password, confirmPassword = register.confirmPassword) => {
    if (!password) {
      setValidation(prev => ({
        ...prev,
        password: { isValid: false, message: "Please enter a password" }
      }));
      return;
    }

    // Password strength validation
    if (password.length < 6) {
      setValidation(prev => ({
        ...prev,
        password: { isValid: false, message: "Password must be at least 6 characters long" }
      }));
      return;
    }

    // Check if passwords match
    if (confirmPassword && password !== confirmPassword) {
      setValidation(prev => ({
        ...prev,
        password: { isValid: false, message: "Passwords do not match" }
      }));
      return;
    }

    if (!confirmPassword) {
      setValidation(prev => ({
        ...prev,
        password: { isValid: true, message: "Password is valid" }
      }));
      return;
    }

    if (password === confirmPassword) {
      setValidation(prev => ({
        ...prev,
        password: { isValid: true, message: "Passwords match" }
      }));
    }
  };

  // Handle hallticket input change
  const handleHallticketChange = (e) => {
    const value = e.target.value;
    setRegister({ ...register, hallticket: value });
    checkHallticket(value);
  };

  // Handle email input change
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setRegister({ ...register, email: value });
    checkEmail(value);
  };

  // Handle password change
  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setRegister({ ...register, password: value });
    checkPassword(value);
  };

  // Handle confirm password change
  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setRegister({ ...register, confirmPassword: value });
    checkPassword(register.password, value);
  };

  // Register only if hallticket exists and is not already registered
  const handleRegister = async () => {
    if (!register.email || !register.password || !register.confirmPassword || !register.hallticket) {
      toast.error("Please fill all fields!");
      return;
    }
    
    if (!validation.hallticket.isValid) {
      toast.error("Please enter a valid hallticket number");
      return;
    }
    
    if (!validation.email.isValid) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!validation.password.isValid) {
      toast.error("Please ensure passwords match and meet requirements");
      return;
    }
    
    if (register.password !== register.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    
    setIsLoading(true);
    setLoadingType("register");
    
    try {
      // Remove confirmPassword before sending to API
      const { confirmPassword, ...registerData } = register;
      const res = await axios.post(`${API_BASE_URL}/register`, registerData, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.data.success) {
        toast.success("Registered successfully!");
        setIsRegistering(false);
        // Reset form
        setRegister({ email: "", password: "", confirmPassword: "", hallticket: "" });
        setValidation({
          hallticket: { isValid: false, message: "" },
          email: { isValid: false, message: "" },
          password: { isValid: false, message: "" }
        });
      } else {
        toast.error(res.data.error || "Registration failed");
      }
    } catch(error) {
      console.error('Registration error:', error);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.error("⌛ Registration timeout. Please check your internet and try again.");
      } 
      else if (error.message === 'Network Error' || !error.response) {
        toast.error("🌐 Network error. Please check your internet connection.");
      }
      else if (error.response?.status === 400) {
        toast.error(error.response.data.error || "Registration data invalid.");
      }
      else if (error.response?.status === 409) {
        toast.error("📧 Email or hallticket already registered.");
      }
      else {
        toast.error(error.response?.data?.error || "Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  // Login with enhanced error handling
  const handleLogin = async () => {
    if (!login.hallticket || !login.password) {
      toast.error("Please fill all fields!");
      return;
    }
    
    setIsLoading(true);
    setLoadingType("login");
    
    try {
      const res = await axios.post(`${API_BASE_URL}/login`, login, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        // Save student data to localStorage for persistence
        localStorage.setItem('studentData', JSON.stringify(res.data.student));
        onLogin(res.data.student);
        toast.success("Login successful!");
      } else {
        toast.error(res.data.error || "Login failed");
      }
    } catch(error) {
      console.error('Login error details:', error);
      
      // Network-related errors
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.error("⌛ Connection timeout. Please check your internet and try again.");
      } 
      else if (error.message === 'Network Error' || !error.response) {
        toast.error("🌐 Network error. Please check your internet connection.");
      }
      // Server errors (5xx)
      else if (error.response?.status >= 500) {
        toast.error("🔧 Server error. Please try again in a few minutes.");
      }
      // Client errors (4xx)
      else if (error.response?.status === 400) {
        toast.error(error.response.data.error || "❌ Invalid hallticket or password.");
      }
      else if (error.response?.status === 401) {
        toast.error("🔐 Authentication failed. Please login again.");
      }
      else if (error.response?.status === 403) {
        toast.error("🚫 Access forbidden. Please contact administrator.");
      }
      else if (error.response?.status === 404) {
        toast.error("🔍 Service not found. Please contact support.");
      }
      // CORS errors
      else if (error.response?.status === 0) {
        toast.error("🛡️ Connection blocked by browser. Try refreshing or using different browser.");
      }
      else {
        toast.error(error.response?.data?.error || "Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Header Component
  const Header = () => (
    <header className="college-header">
      <div className="header-container">
        <div className="logo-container">
          <img 
            src="IMG_3594.jpg" 
            alt="SCIENT INSTITUTE OF TECHNOLOGY Logo" 
            className="college-logo"
          />
        </div>
        <div className="college-info">
          <h1>SCIENT INSTITUTE OF TECHNOLOGY</h1>
          <p className="ugc-autonomous">(UGC AUTONOMOUS)</p>
          <p className="college-address">Ibrahimpatnam R.R.Dist Telangana 501359</p>
        </div>
      </div>
    </header>
  );

  // Footer Component
  const Footer = () => (
    <footer className="college-footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="copyright">
            <p>&copy; {new Date().getFullYear()} SCIENT INSTITUTE OF TECHNOLOGY. All rights reserved.</p>
          </div>
          <div className="developer-info">
            <p>Designed and developed by </p>
            <div className="vsoft-info">
              <img 
                src="/vamshi.PNG" 
                alt="V Soft Logo" 
                className="vsoft-logo"
              />
              <span>V Soft</span>
              Follow us on
              <a 
                href="https://www.linkedin.com/public-profile/settings?trk=d_flagship3_profile_self_view_public_profile" 
                target="_blank" 
                rel="noopener noreferrer"
                className="linkedin-link"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#0077b5">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );

  return (
    <div className="login-full-page">
      <Header />
      <div className="login-content-wrapper">
        <div className="login-container">
          <ToastContainer 
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
          
          {!isRegistering ? (
            <div className="auth-form">
              <h2>Student Login</h2>
              <p>Login with your hallticket and password</p>
              <div className="form-group">
                <input 
                  placeholder="Hallticket Number" 
                  value={login.hallticket} 
                  onChange={e => setLogin({...login, hallticket: e.target.value})}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="form-group password-input-group">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Password" 
                  value={login.password} 
                  onChange={e => setLogin({...login, password: e.target.value})}
                  required
                  disabled={isLoading}
                />
                <span 
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? "🙈" : "👁️"}
                </span>
              </div>
              <button 
                onClick={handleLogin} 
                className="btn-primary"
                disabled={isLoading}
              >
                {isLoading && loadingType === "login" ? (
                  <>
                    <span className="loading-spinner"></span>
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </button>
              
              <p className="auth-switch">
                Not registered? <span onClick={() => !isLoading && setIsRegistering(true)}>Register here</span>
              </p>
              
              <p className="tech-support-link">
                Having trouble? <span onClick={() => setShowTechSupport(true)}>Contact Developer</span>
              </p>
            </div>
          ) : (
            <div className="auth-form">
              <h2>Student Registration</h2>
              <p>Register with your hallticket number</p>
              
              <div className="form-group">
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={register.email} 
                  onChange={handleEmailChange}
                  onBlur={() => checkEmail(register.email)}
                  required
                  className={validation.email.isValid ? "valid" : validation.email.message ? "invalid" : ""}
                  disabled={isLoading}
                />
                {validation.email.message && (
                  <div className={`validation-message ${validation.email.isValid ? "valid" : "invalid"}`}>
                    {validation.email.message}
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <input 
                  placeholder="Hallticket Number" 
                  value={register.hallticket} 
                  onChange={handleHallticketChange}
                  onBlur={() => checkHallticket(register.hallticket)}
                  required
                  className={validation.hallticket.isValid ? "valid" : validation.hallticket.message ? "invalid" : ""}
                  disabled={isLoading}
                />
                {validation.hallticket.message && (
                  <div className={`validation-message ${validation.hallticket.isValid ? "valid" : "invalid"}`}>
                    {validation.hallticket.message}
                  </div>
                )}
              </div>
              
              <div className="form-group password-input-group">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Password" 
                  value={register.password} 
                  onChange={handlePasswordChange}
                  onBlur={() => checkPassword(register.password)}
                  required
                  className={validation.password.isValid ? "valid" : validation.password.message ? "invalid" : ""}
                  disabled={isLoading}
                />
                <span 
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? "🙈" : "👁️"}
                </span>
                {validation.password.message && (
                  <div className={`validation-message ${validation.password.isValid ? "valid" : "invalid"}`}>
                    {validation.password.message}
                  </div>
                )}
              </div>

              <div className="form-group password-input-group">
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Password" 
                  value={register.confirmPassword} 
                  onChange={handleConfirmPasswordChange}
                  onBlur={() => checkPassword(register.password, register.confirmPassword)}
                  required
                  className={validation.password.isValid && register.confirmPassword ? "valid" : validation.password.message && register.confirmPassword ? "invalid" : ""}
                  disabled={isLoading}
                />
                <span 
                  className="password-toggle"
                  onClick={toggleConfirmPasswordVisibility}
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </span>
              </div>
              
              <button 
                onClick={handleRegister} 
                className="btn-primary"
                disabled={!validation.hallticket.isValid || !validation.email.isValid || !validation.password.isValid || !register.password || !register.confirmPassword || isLoading}
              >
                {isLoading && loadingType === "register" ? (
                  <>
                    <span className="loading-spinner"></span>
                    Registering...
                  </>
                ) : (
                  "Register"
                )}
              </button>
              
              <p className="auth-switch">
                Already registered? <span onClick={() => !isLoading && setIsRegistering(false)}>Login here</span>
              </p>
              
              <p className="tech-support-link">
                Having trouble? <span onClick={() => setShowTechSupport(true)}>Contact Developer</span>
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Technical Support Modal */}
      <TechnicalSupport />
      
      <Footer />
    </div>
  );
}

export default Login;