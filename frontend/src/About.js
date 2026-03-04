import React from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaRocket, FaChartLine, FaLock, FaMobileAlt, FaRobot, FaGift } from 'react-icons/fa';

// Custom dark theme
const aboutStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap');

  body {
    background: #000000 !important;
    color: #e0e0e0;
    font-family: 'Poppins', sans-serif;
  }
  .hero-section {
    padding: 80px 0 40px;
    text-align: center;
  }
  .hero-logo {
    max-width: 250px;
    width: 100%;
    margin-bottom: 20px;
    /* Glowing border effect */
    border: 2px solid #3b82f6;
    border-radius: 50%;
    padding: 10px;
    box-shadow: 0 0 20px #3b82f6, 0 0 40px #3b82f6, inset 0 0 10px #3b82f6;
    transition: box-shadow 0.3s ease;
    display: inline-block;
  }
  .hero-logo:hover {
    box-shadow: 0 0 30px #3b82f6, 0 0 60px #3b82f6, inset 0 0 15px #3b82f6;
  }
  .multicolor-title {
    font-family: 'Poppins', sans-serif;
    font-size: 4rem;
    font-weight: 700;
    margin-bottom: 15px;
    letter-spacing: 2px;
  }
  .multicolor-title span {
    display: inline-block;
  }
  .letter-f { color: #4285F4; }  /* Google Blue */
  .letter-i { color: #EA4335; }  /* Google Red */
  .letter-n { color: #FBBC05; }  /* Google Yellow */
  .letter-b { color: #4285F4; }  /* Blue */
  .letter-u { color: #34A853; }  /* Google Green */
  .letter-d { color: #EA4335; }  /* Red */
  .letter-d2 { color: #FBBC05; } /* Yellow */
  .letter-y { color: #4285F4; }  /* Blue */

  .hero-subtitle {
    font-size: 1.5rem;
    color: #aaccff;
    margin-bottom: 30px;
    font-family: 'Poppins', sans-serif;
  }
  .feature-card {
    background: #111 !important;
    border: 2px solid #2a3a5a !important;
    border-radius: 15px !important;
    padding: 25px 20px;
    height: 100%;
    transition: transform 0.3s, box-shadow 0.3s;
    color: white;
  }
  .feature-card:hover {
    transform: translateY(-10px);
    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
    border-color: #3b82f6 !important;
  }
  .feature-icon {
    font-size: 3rem;
    color: #3b82f6;
    margin-bottom: 20px;
  }
  .feature-title {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 15px;
    color: white;
  }
  .feature-text {
    color: #aaa;
    line-height: 1.6;
  }
  .cta-section {
    background: linear-gradient(135deg, #1e3a8a, #6b21a5);
    border-radius: 20px;
    padding: 60px 20px;
    margin: 60px 0;
    text-align: center;
  }
  .cta-title {
    font-size: 2.5rem;
    font-weight: bold;
    color: white;
    margin-bottom: 20px;
  }
  .cta-text {
    font-size: 1.2rem;
    color: rgba(255,255,255,0.8);
    margin-bottom: 30px;
  }
  .btn-custom {
    padding: 12px 40px;
    font-size: 1.2rem;
    border-radius: 50px;
    margin: 0 10px;
  }
  .btn-primary-custom {
    background: white;
    color: #1e3a8a;
    border: none;
  }
  .btn-primary-custom:hover {
    background: #e0e0e0;
    color: #1e3a8a;
  }
  .btn-outline-custom {
    background: transparent;
    border: 2px solid white;
    color: white;
  }
  .btn-outline-custom:hover {
    background: white;
    color: #1e3a8a;
  }
`;

function About() {
  return (
    <>
      <style>{aboutStyles}</style>
      <Container fluid className="p-0">
        {/* Hero Section */}
        <div className="hero-section">
          <Container>
            <img src="/FinBuddy-new.png" alt="FinBuddy Logo" className="hero-logo" />
            <div className="multicolor-title">
              <span className="letter-f">F</span>
              <span className="letter-i">i</span>
              <span className="letter-n">n</span>
              <span className="letter-b">B</span>
              <span className="letter-u">u</span>
              <span className="letter-d">d</span>
              <span className="letter-d2">d</span>
              <span className="letter-y">y</span>
            </div>
            <p className="hero-subtitle">Your AI-powered financial companion</p>
            <p style={{ fontSize: '1.2rem', color: '#ccc', maxWidth: '800px', margin: '0 auto 40px' }}>
              Take control of your finances with intelligent tracking, predictive insights, and rewards that motivate smart money habits.
            </p>
            <div>
              <Link to="/login">
                <Button variant="primary" size="lg" className="me-3" style={{ borderRadius: '50px', padding: '12px 40px' }}>
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="outline-primary" size="lg" style={{ borderRadius: '50px', padding: '12px 40px' }}>
                  Register
                </Button>
              </Link>
            </div>
          </Container>
        </div>

        {/* Features Section */}
        <Container className="my-5">
          <h2 className="text-center mb-5" style={{ fontSize: '2.5rem', color: 'white' }}>Why Choose FinBuddy?</h2>
          <Row>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body className="text-center">
                  <FaRobot className="feature-icon" />
                  <h3 className="feature-title">AI-Powered Insights</h3>
                  <p className="feature-text">Machine learning analyzes your spending patterns and provides personalized financial advice.</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body className="text-center">
                  <FaChartLine className="feature-icon" />
                  <h3 className="feature-title">Smart Tracking</h3>
                  <p className="feature-text">Automatically categorizes expenses, tracks income, and monitors loans and EMIs in real time.</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body className="text-center">
                  <FaGift className="feature-icon" />
                  <h3 className="feature-title">Rewards Program</h3>
                  <p className="feature-text">Earn points for good financial habits and redeem them for exclusive partner offers.</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body className="text-center">
                  <FaLock className="feature-icon" />
                  <h3 className="feature-title">Secure & Private</h3>
                  <p className="feature-text">Your data is encrypted and stored securely. Each user has their own private space.</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body className="text-center">
                  <FaMobileAlt className="feature-icon" />
                  <h3 className="feature-title">Mobile Friendly</h3>
                  <p className="feature-text">Access your finances on the go with our responsive design – works on any device.</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4} className="mb-4">
              <Card className="feature-card">
                <Card.Body className="text-center">
                  <FaRocket className="feature-icon" />
                  <h3 className="feature-title">Future-Ready</h3>
                  <p className="feature-text">Predictive analytics help you plan for the future and achieve your financial goals.</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>

        {/* CTA Section */}
        <Container>
          <div className="cta-section">
            <h2 className="cta-title">Ready to take control of your finances?</h2>
            <p className="cta-text">Join thousands of users who are already managing their money smarter with FinBuddy.</p>
            <div>
              <Link to="/register">
                <Button className="btn-custom btn-primary-custom me-3">Get Started Now</Button>
              </Link>
              <Link to="/login">
                <Button className="btn-custom btn-outline-custom">Sign In</Button>
              </Link>
            </div>
          </div>
        </Container>

        {/* Footer */}
        <footer className="text-center py-4" style={{ color: '#666', borderTop: '1px solid #222' }}>
          <p>© 2026 FinBuddy. All rights reserved. Your AI-powered financial companion.</p>
        </footer>
      </Container>
    </>
  );
}

export default About;