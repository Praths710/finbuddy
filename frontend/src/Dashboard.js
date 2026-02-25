/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Form, Button, Tabs, Tab, Modal, ProgressBar, Navbar } from 'react-bootstrap';
import { FaMoneyBillWave, FaCoins, FaCreditCard, FaBalanceScale, FaChartLine, FaSignOutAlt } from 'react-icons/fa';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://finbuddy-api-86cc.onrender.com'; // <-- REPLACE WITH YOUR LIVE BACKEND URL

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loans, setLoans] = useState([]);
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category_id: '',
    date: new Date().toISOString().slice(0, 10)
  });
  const [loanForm, setLoanForm] = useState({
    name: '',
    amount: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    description: ''
  });
  const [suggestedCat, setSuggestedCat] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingLoanId, setEditingLoanId] = useState(null);

  const [activeIncome, setActiveIncome] = useState(() => {
    const saved = localStorage.getItem('activeIncome');
    return saved ? parseFloat(saved) : 0;
  });
  const [passiveIncome, setPassiveIncome] = useState(() => {
    const saved = localStorage.getItem('passiveIncome');
    return saved ? parseFloat(saved) : 0;
  });

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');

  // Persist incomes
  useEffect(() => {
    localStorage.setItem('activeIncome', activeIncome.toString());
  }, [activeIncome]);
  useEffect(() => {
    localStorage.setItem('passiveIncome', passiveIncome.toString());
  }, [passiveIncome]);

  useEffect(() => {
    axios.get(`${API_BASE}/categories/`).then(res => setCategories(res.data));
    fetchTransactions();
    fetchLoans();
  }, []);

  const fetchTransactions = () => {
    axios.get(`${API_BASE}/transactions/`).then(res => setTransactions(res.data));
  };

  const fetchLoans = () => {
    axios.get(`${API_BASE}/loans/`).then(res => setLoans(res.data));
  };

  const handleDescriptionChange = (e) => {
    const desc = e.target.value;
    setForm({ ...form, description: desc });
    if (desc.length > 2) {
      axios.get(`${API_BASE}/suggest-category/?description=${encodeURIComponent(desc)}`)
        .then(res => {
          if (res.data.suggested_category_id) {
            setSuggestedCat(res.data);
            setForm(prev => ({ ...prev, category_id: res.data.suggested_category_id }));
          } else {
            setSuggestedCat(null);
          }
        });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const transactionData = {
      amount: parseFloat(form.amount),
      description: form.description,
      category_id: form.category_id || null,
      date: new Date(form.date).toISOString()
    };

    if (editingId) {
      axios.put(`${API_BASE}/transactions/${editingId}`, transactionData)
        .then(() => {
          resetForm();
          setEditingId(null);
          setShowModal(false);
          fetchTransactions();
        })
        .catch(err => console.error("Error updating transaction:", err));
    } else {
      axios.post(`${API_BASE}/transactions/`, transactionData)
        .then(() => {
          resetForm();
          setShowModal(false);
          fetchTransactions();
        })
        .catch(err => console.error("Error creating transaction:", err));
    }
  };

  const resetForm = () => {
    setForm({
      amount: '',
      description: '',
      category_id: '',
      date: new Date().toISOString().slice(0, 10)
    });
    setSuggestedCat(null);
  };

  const handleEdit = (transaction) => {
    setEditingId(transaction.id);
    setForm({
      amount: transaction.amount,
      description: transaction.description,
      category_id: transaction.category_id || '',
      date: transaction.date.slice(0, 10)
    });
    setModalMode('edit');
    setShowModal(true);
    if (transaction.description.length > 2) {
      axios.get(`${API_BASE}/suggest-category/?description=${encodeURIComponent(transaction.description)}`)
        .then(res => {
          if (res.data.suggested_category_id) {
            setSuggestedCat(res.data);
          }
        });
    }
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      axios.delete(`${API_BASE}/transactions/${id}`)
        .then(() => {
          fetchTransactions();
        })
        .catch(err => {
          console.error("Error deleting transaction:", err);
          alert("Failed to delete transaction.");
        });
    }
  };

  const handleLoanSubmit = (e) => {
    e.preventDefault();

    const loanData = {
      name: loanForm.name,
      amount: parseFloat(loanForm.amount),
      start_date: new Date(loanForm.start_date).toISOString(),
      end_date: loanForm.end_date ? new Date(loanForm.end_date).toISOString() : null,
      description: loanForm.description || null
    };

    if (editingLoanId) {
      axios.put(`${API_BASE}/loans/${editingLoanId}`, loanData)
        .then(() => {
          resetLoanForm();
          setEditingLoanId(null);
          fetchLoans();
        })
        .catch(err => console.error("Error updating loan:", err));
    } else {
      axios.post(`${API_BASE}/loans/`, loanData)
        .then(() => {
          resetLoanForm();
          fetchLoans();
        })
        .catch(err => console.error("Error creating loan:", err));
    }
  };

  const resetLoanForm = () => {
    setLoanForm({
      name: '',
      amount: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      description: ''
    });
  };

  const handleEditLoan = (loan) => {
    setEditingLoanId(loan.id);
    setLoanForm({
      name: loan.name,
      amount: loan.amount,
      start_date: loan.start_date.slice(0, 10),
      end_date: loan.end_date ? loan.end_date.slice(0, 10) : '',
      description: loan.description || ''
    });
  };

  const handleDeleteLoan = (id) => {
    if (window.confirm("Are you sure you want to delete this loan/EMI?")) {
      axios.delete(`${API_BASE}/loans/${id}`)
        .then(() => {
          fetchLoans();
        })
        .catch(err => {
          console.error("Error deleting loan:", err);
          alert("Failed to delete loan.");
        });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Calculations
  const otherIncome = transactions.reduce((acc, tx) => {
    if (tx.category && tx.category.name.toLowerCase().includes('income')) {
      acc += tx.amount;
    }
    return acc;
  }, 0);

  const expensesFromTransactions = transactions.reduce((acc, tx) => {
    if (!tx.category || !tx.category.name.toLowerCase().includes('income')) {
      acc += tx.amount;
    }
    return acc;
  }, 0);

  const totalEMI = loans.reduce((acc, loan) => acc + loan.amount, 0);
  const totalExpenses = expensesFromTransactions + totalEMI;

  const totalIncome = activeIncome + passiveIncome + otherIncome;
  const net = totalIncome - totalExpenses;
  const spentPercent = totalIncome > 0 ? Math.min(100, (totalExpenses / totalIncome) * 100) : 0;

  // Pie data
  const expenseByCategory = transactions
    .filter(tx => !tx.category?.name.toLowerCase().includes('income'))
    .reduce((acc, tx) => {
      const catName = tx.category?.name || 'Uncategorized';
      acc[catName] = (acc[catName] || 0) + tx.amount;
      return acc;
    }, {});

  let pieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));
  if (totalEMI > 0) {
    pieData.push({ name: 'Loans/EMI', value: totalEMI });
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA336A', '#33AA33', '#8884d8', '#82ca9d', '#FF6363'];

  // Theme styles (you can keep your existing spaceStyles here)
  const themeStyles = `...`; // copy your existing spaceStyles from your current App.js

  return (
    <>
      <style>{themeStyles}</style>
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand>FinBuddy</Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse className="justify-content-end">
            <Navbar.Text className="me-3">
              Signed in as: {user?.full_name || user?.email}
            </Navbar.Text>
            <Button variant="outline-light" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="py-4" data-bs-theme="dark">
        {/* Rest of your dashboard UI – copy from your old App.js from here onward */}
        {/* ... everything after the <Container> tag ... */}
      </Container>
    </>
  );
}

export default Dashboard;