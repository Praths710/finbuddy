import React, { useState, useRef, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Badge
} from 'react-bootstrap';
import {
  FaRobot,
  FaUser,
  FaChartLine,
  FaExclamationTriangle,
  FaSmile,
  FaFrown,
  FaMeh,
  FaTimes,
  FaComments
} from 'react-icons/fa';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import './AIChat.css';

const API_BASE = 'https://finbuddy-api-python.onrender.com';

const AIChat = ({ onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'ai',
      content: `Hi ${user?.full_name || 'there'}! I'm your FinBuddy AI assistant. Ask me anything about your spending, loans, or finances. For example:
      • "How much did I spend on groceries last month?"
      • "What's my emotional spending pattern?"
      • "Compare my spending this month vs last month"
      • "Give me financial advice based on my habits"`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showInsights, setShowInsights] = useState(false);
  const [insights, setInsights] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial insights
  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await axios.get(`${API_BASE}/ai/insights`);
      setInsights(res.data);
    } catch (err) {
      console.error('Failed to fetch insights:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(`${API_BASE}/ai/chat`, {
        query: input
      });

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: formatAIResponse(res.data),
        analysis: res.data.analysis,
        advice: res.data.advice,
        emotionalInsights: res.data.emotional_insights,
        healthScore: res.data.health_score,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Refresh insights
      fetchInsights();
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get response. Please try again.');
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatAIResponse = (data) => {
    if (data.error) {
      return data.message || 'Sorry, I encountered an error.';
    }

    let response = '';

    if (data.analysis) {
      if (data.analysis.total !== undefined) {
        response += `💰 **Spending Analysis**\n`;
        response += `Total: ₹${data.analysis.total.toFixed(2)}\n`;
        response += `Daily average: ₹${data.analysis.daily_average.toFixed(2)}\n`;
        
        if (data.analysis.top_categories?.length > 0) {
          response += `\n📊 **Top Categories**\n`;
          data.analysis.top_categories.forEach(([cat, amount]) => {
            response += `• ${cat}: ₹${amount.toFixed(2)}\n`;
          });
        }
      }
      
      if (data.analysis.change !== undefined) {
        response += `\n📈 **Comparison**\n`;
        const trend = data.analysis.change > 0 ? '📈' : '📉';
        response += `${trend} ${Math.abs(data.analysis.percent_change).toFixed(1)}% (₹${Math.abs(data.analysis.change).toFixed(2)})\n`;
      }
    }

    if (data.emotional_insights?.insights?.length > 0) {
      response += `\n🧠 **Emotional Insights**\n`;
      data.emotional_insights.insights.forEach(insight => {
        const icon = insight.severity === 'high' ? '🔴' : insight.severity === 'medium' ? '🟡' : '🟢';
        response += `${icon} ${insight.message}\n`;
      });
    }

    if (data.advice?.advice) {
      response += `\n💡 **Financial Advice**\n${data.advice.advice}\n`;
    }

    if (data.health_score) {
      response += `\n🏥 **Financial Health Score**\n`;
      response += `${data.health_score.score}/100 - ${data.health_score.rating}\n`;
    }

    return response || data.message || "I've analyzed your request. Is there anything specific you'd like to know?";
  };

  const getEmotionIcon = (rating) => {
    switch(rating?.toLowerCase()) {
      case 'excellent': return <FaSmile className="text-success" />;
      case 'good': return <FaSmile className="text-info" />;
      case 'fair': return <FaMeh className="text-warning" />;
      case 'needs improvement': return <FaFrown className="text-danger" />;
      default: return null;
    }
  };

  return (
    <Card className="ai-chat-card">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <FaRobot className="me-2" />
          <strong>FinBuddy AI Assistant</strong>
          <Badge bg="info" className="ms-2">Powered by GPT-4</Badge>
        </div>
        <div>
          <Button
            variant="outline-light"
            size="sm"
            className="me-2"
            onClick={() => setShowInsights(!showInsights)}
          >
            <FaChartLine /> Insights
          </Button>
          <Button variant="outline-light" size="sm" onClick={onClose}>
            <FaTimes />
          </Button>
        </div>
      </Card.Header>

      <Card.Body>
        {showInsights && insights && (
          <div className="insights-panel mb-3 p-3">
            <h6>Quick Insights</h6>
            <Row>
              <Col xs={6}>
                <small>Total Spent</small>
                <div className="fw-bold">₹{insights.total_spent?.toFixed(2)}</div>
              </Col>
              <Col xs={6}>
                <small>Health Score</small>
                <div className="fw-bold">
                  {getEmotionIcon(insights.health_score?.rating)}
                  {insights.health_score?.score}/100
                </div>
              </Col>
            </Row>
            {insights.top_categories?.length > 0 && (
              <div className="mt-2">
                <small>Top Categories</small>
                {insights.top_categories.slice(0, 3).map(([cat, amt], i) => (
                  <div key={i} className="d-flex justify-content-between">
                    <span>{cat}</span>
                    <span>₹{Math.abs(amt).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="chat-messages">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}
            >
              <div className="message-icon">
                {msg.role === 'user' ? <FaUser /> : <FaRobot />}
              </div>
              <div className="message-content">
                <div className="message-header">
                  <strong>{msg.role === 'user' ? 'You' : 'FinBuddy AI'}</strong>
                  <small className="text-muted ms-2">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </small>
                </div>
                <div className="message-text" style={{ whiteSpace: 'pre-line' }}>
                  {msg.content}
                </div>
                
                {msg.emotionalInsights?.insights?.length > 0 && (
                  <div className="emotional-tags mt-2">
                    {msg.emotionalInsights.insights.map((insight, i) => (
                      <Badge
                        key={i}
                        bg={insight.severity === 'high' ? 'danger' : insight.severity === 'medium' ? 'warning' : 'info'}
                        className="me-1"
                      >
                        {insight.type}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="message ai-message">
              <div className="message-icon">
                <FaRobot />
              </div>
              <div className="message-content">
                <Spinner animation="border" size="sm" /> Thinking...
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <Alert variant="danger" className="mt-3" dismissible onClose={() => setError(null)}>
            <FaExclamationTriangle className="me-2" />
            {error}
          </Alert>
        )}

        <Form onSubmit={handleSubmit} className="mt-3">
          <Form.Group className="d-flex">
            <Form.Control
              type="text"
              placeholder="Ask about your spending, loans, or get advice..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="me-2"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !input.trim()}
            >
              {loading ? <Spinner animation="border" size="sm" /> : 'Send'}
            </Button>
          </Form.Group>
        </Form>

        <div className="mt-2 text-muted small">
          <FaComments className="me-1" />
          Try: "How much did I spend on dining?", "Any emotional spending patterns?", "Compare last two months"
        </div>
      </Card.Body>
    </Card>
  );
};

export default AIChat;