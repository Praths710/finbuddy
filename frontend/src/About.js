import React from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function About() {
  return (
    <Container className="py-5">
      <Row className="justify-content-center text-center mb-4">
        <Col md={8}>
          <img src="/logo.png" alt="FinBuddy Logo" style={{ maxWidth: '150px', marginBottom: '20px' }} />
          <h1 className="display-4">FinBuddy</h1>
          <p className="lead">Your AI-powered financial companion</p>
        </Col>
      </Row>

      <Row className="mb-4">
        <Col md={10} className="mx-auto">
          <Card className="p-4 shadow-sm">
            <Card.Body>
              <h2>About Us – What is FinBuddy?</h2>
              <p><strong>FinBuddy</strong> is an AI-powered financial intelligence platform designed to help individuals understand, manage, and optimize their money with clarity and confidence.</p>
              <p>In today’s fast-moving digital economy, financial decisions happen instantly — but understanding their long-term impact does not. FinBuddy bridges this gap by combining smart expense tracking, income analytics, and machine learning-driven insights into one unified financial ecosystem.</p>

              <h3 className="mt-4">What FinBuddy Does</h3>
              <p>FinBuddy goes beyond basic transaction tracking. It:</p>
              <ul>
                <li>Automatically categorizes expenses in real time</li>
                <li>Tracks active and passive income streams</li>
                <li>Calculates monthly and annual income trends</li>
                <li>Monitors EMIs, loans, and recurring obligations</li>
                <li>Provides advanced spending analytics and behavioral insights</li>
              </ul>
              <p>By analyzing financial patterns using AI and machine learning, FinBuddy identifies spending habits, detects risk signals, and generates personalized financial guidance.</p>

              <h3 className="mt-4">Intelligent Financial Insights</h3>
              <p>FinBuddy transforms raw financial data into actionable intelligence. Users receive:</p>
              <ul>
                <li>Predictive cash flow analysis</li>
                <li>Financial stability scoring</li>
                <li>Smart budgeting recommendations</li>
                <li>Investment readiness insights</li>
                <li>Behavioral spending alerts</li>
              </ul>
              <p>The platform not only shows where money is going, but also explains why patterns are forming and how to improve them.</p>

              <h3 className="mt-4">Rewarding Smart Financial Behavior</h3>
              <p>FinBuddy encourages responsible financial decisions. Users earn reward points for:</p>
              <ul>
                <li>Maintaining savings consistency</li>
                <li>Reducing unnecessary spending</li>
                <li>Timely EMI payments</li>
                <li>Achieving financial goals</li>
              </ul>
              <p>These points can be redeemed for exclusive partner offers, creating a system that promotes long-term financial discipline.</p>

              <h3 className="mt-4">Our Vision</h3>
              <p>FinBuddy aims to become a personal financial operating system — empowering users with transparency, intelligence, and control over their financial future while enabling financial institutions to build more responsible and data-driven ecosystems.</p>
              <p>We believe financial awareness should not be reactive. It should be predictive, personalized, and intelligent.</p>
              <p className="fw-bold">FinBuddy is where financial clarity meets AI-powered decision-making.</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="text-center">
        <Col>
          <Link to="/login">
            <Button variant="primary" size="lg" className="me-3">Login</Button>
          </Link>
          <Link to="/register">
            <Button variant="outline-primary" size="lg">Register</Button>
          </Link>
        </Col>
      </Row>
    </Container>
  );
}

export default About;