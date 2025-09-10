// src/pages/Login.jsx
import React, { useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import './Login.css';

function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [register, setRegister] = useState({ email: "", password: "", hallticket: "" });
  const [login, setLogin] = useState({ hallticket: "", password: "" });
  const [validation, setValidation] = useState({
    hallticket: { isValid: false, message: "" },
    email: { isValid: false, message: "" }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState(""); // "login" or "register"

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
      const res = await axios.get(`http://localhost:4000/check-hallticket/${hallticket}`);
      
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
      setValidation(prev => ({
        ...prev,
        hallticket: { isValid: false, message: "Error checking hallticket" }
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
      const res = await axios.get(`http://localhost:4000/check-email/${email}`);
      
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
      setValidation(prev => ({
        ...prev,
        email: { isValid: false, message: "Error checking email" }
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

  // Register only if hallticket exists and is not already registered
  const handleRegister = async () => {
    if (!register.email || !register.password || !register.hallticket) {
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
    
    setIsLoading(true);
    setLoadingType("register");
    
    try {
      await axios.post("http://localhost:4000/register", register);
      toast.success("Registered successfully!");
      setIsRegistering(false);
    } catch(e) {
      toast.error(e.response?.data?.error || "Registration failed");
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
  };

  // Login
  const handleLogin = async () => {
    if (!login.hallticket || !login.password) {
      toast.error("Please fill all fields!");
      return;
    }
    
    setIsLoading(true);
    setLoadingType("login");
    
    try {
      const res = await axios.post("http://localhost:4000/login", login);
      localStorage.setItem('token', res.data.token);
      // Save student data to localStorage for persistence
      localStorage.setItem('studentData', JSON.stringify(res.data.student));
      onLogin(res.data.student);
      toast.success("Login successful!");
    } catch(e) {
      toast.error(e.response?.data?.error || "Login failed");
    } finally {
      setIsLoading(false);
      setLoadingType("");
    }
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
          <ToastContainer />
          
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
              <div className="form-group">
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={login.password} 
                  onChange={e => setLogin({...login, password: e.target.value})}
                  required
                  disabled={isLoading}
                />
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
              
              <div className="form-group">
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={register.password} 
                  onChange={e => setRegister({...register, password: e.target.value})}
                  required
                  disabled={isLoading}
                />
              </div>
              
              <button 
                onClick={handleRegister} 
                className="btn-primary"
                disabled={!validation.hallticket.isValid || !validation.email.isValid || !register.password || isLoading}
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
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Login;