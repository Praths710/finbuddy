import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Form, Button, Tabs, Tab, Modal, ProgressBar } from 'react-bootstrap';
import { FaMoneyBillWave, FaCoins, FaCreditCard, FaBalanceScale, FaChartLine } from 'react-icons/fa';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Custom dark/neon/white-border theme
const themeStyles = `
  body {
    background: #000000 !important;
    color: #e0e0e0;
    font-family: 'Arial', sans-serif;
  }

  .card {
    background: #111 !important;
    border: 2px solid #ffffff !important;
    border-radius: 15px !important;
    box-shadow: 0 0 15px rgba(255,255,255,0.2);
    color: white;
  }

  .card.bg-primary {
    background: #1e3a8a !important;
    border-color: #3b82f6 !important;
    box-shadow: 0 0 20px #3b82f6;
  }
  .card.bg-success {
    background: #14532d !important;
    border-color: #22c55e !important;
    box-shadow: 0 0 20px #22c55e;
  }
  .card.bg-info {
    background: #1e3a5f !important;
    border-color: #06b6d4 !important;
    box-shadow: 0 0 20px #06b6d4;
  }
  .card.bg-danger {
    background: #7f1d1d !important;
    border-color: #ef4444 !important;
    box-shadow: 0 0 20px #ef4444;
  }
  .card.bg-warning {
    background: #854d0e !important;
    border-color: #eab308 !important;
    box-shadow: 0 0 20px #eab308;
  }
  .card.bg-secondary {
    background: #1e293b !important;
    border-color: #94a3b8 !important;
    box-shadow: 0 0 20px #94a3b8;
  }

  .transaction-card {
    background: white !important;
    border: 1px solid #ddd;
    border-radius: 20px !important;
    padding: 15px;
    margin-bottom: 15px;
    box-shadow: 0 8px 20px rgba(255,255,255,0.3);
    color: black !important;
    transition: transform 0.2s;
  }
  .transaction-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 28px rgba(255,255,255,0.5);
  }
  .transaction-card .amount {
    font-size: 1.4rem;
    font-weight: bold;
  }
  .transaction-card .description {
    font-size: 1.1rem;
  }
  .transaction-card .category {
    color: #555;
    font-style: italic;
  }
  .transaction-card .actions {
    margin-top: 10px;
  }

  .modal-content {
    background: #222 !important;
    border: 2px solid white;
    color: white;
  }
  .modal-header, .modal-footer {
    border-color: #444;
  }
  .modal-title {
    color: white;
  }
  .form-label {
    color: white !important;
  }
  .form-control, .form-select {
    background: #333 !important;
    border: 1px solid #555 !important;
    color: white !important;
  }
  .form-control::placeholder {
    color: #aaa;
  }

  .nav-tabs .nav-link {
    color: #ccc;
    border: 1px solid transparent;
  }
  .nav-tabs .nav-link.active {
    background: #222;
    color: white;
    border-color: white white #222 white;
  }

  .btn-primary {
    background: #3b82f6;
    border-color: #2563eb;
  }
  .btn-outline-primary {
    color: #3b82f6;
    border-color: #3b82f6;
  }
  .btn-outline-danger {
    color: #ef4444;
    border-color: #ef4444;
  }

  .progress {
    background: #333;
    border: 1px solid white;
    height: 25px;
    border-radius: 15px;
  }
  .progress-bar {
    background: linear-gradient(90deg, #3b82f6, #a855f7);
    font-weight: bold;
  }
`;

const API_BASE = 'http://localhost:8000';

function App() {
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

  // ========== FINANCIAL CALCULATIONS ==========
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

  // ---------- PIE DATA (includes EMI as a category) ----------
  // Expenses from transactions by category
  const transactionExpenseByCat = transactions
    .filter(tx => !tx.category?.name.toLowerCase().includes('income'))
    .reduce((acc, tx) => {
      const catName = tx.category?.name || 'Uncategorized';
      acc[catName] = (acc[catName] || 0) + tx.amount;
      return acc;
    }, {});

  // Convert to array for pie chart
  let pieData = Object.entries(transactionExpenseByCat).map(([name, value]) => ({ name, value }));

  // Add a separate slice for total EMI if it exists
  if (totalEMI > 0) {
    pieData.push({ name: 'Loans/EMI', value: totalEMI });
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA336A', '#33AA33', '#8884d8', '#82ca9d', '#FF6363'];

  return (
    <>
      <style>{themeStyles}</style>
      <Container className="py-4" data-bs-theme="dark">
        <h1 className="text-center mb-4" style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', textShadow: '0 0 15px cyan' }}>
          FinBuddy
        </h1>

        {/* Row 1: Active, Passive, Other Income, Expenses */}
        <Row className="mb-4">
          <Col md={3}>
            <Card className="text-white bg-primary h-100">
              <Card.Body>
                <FaMoneyBillWave size={30} className="mb-2" />
                <Card.Title>Active Income</Card.Title>
                <Card.Text className="display-6">₹{activeIncome.toFixed(2)}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-white bg-success h-100">
              <Card.Body>
                <FaCoins size={30} className="mb-2" />
                <Card.Title>Passive Income</Card.Title>
                <Card.Text className="display-6">₹{passiveIncome.toFixed(2)}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-white bg-info h-100">
              <Card.Body>
                <FaChartLine size={30} className="mb-2" />
                <Card.Title>Other Income</Card.Title>
                <Card.Text className="display-6">₹{otherIncome.toFixed(2)}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-white bg-danger h-100">
              <Card.Body>
                <FaCreditCard size={30} className="mb-2" />
                <Card.Title>Expenses</Card.Title>
                <Card.Text className="display-6">₹{totalExpenses.toFixed(2)}</Card.Text>
                {totalEMI > 0 && <small>(incl. ₹{totalEMI.toFixed(2)} EMI)</small>}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Row 2: Total Income and Net (with progress bar) */}
        <Row className="mb-4">
          <Col md={6}>
            <Card className="text-white bg-secondary h-100">
              <Card.Body>
                <Card.Title>Total Monthly Income</Card.Title>
                <Card.Text className="display-5">₹{totalIncome.toFixed(2)}</Card.Text>
                <small>Active + Passive + Other</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="text-white bg-warning h-100">
              <Card.Body>
                <FaBalanceScale size={30} className="mb-2" />
                <Card.Title>Net</Card.Title>
                <Card.Text className="display-5">₹{net.toFixed(2)}</Card.Text>
                <div className="mt-3">
                  <p className="mb-1">Spent: {spentPercent.toFixed(1)}% of income</p>
                  <ProgressBar now={spentPercent} label={`${spentPercent.toFixed(0)}%`} />
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Income Input Section */}
        <Row className="mb-4">
          <Col md={6}>
            <Card>
              <Card.Body>
                <Card.Title>Set Monthly Incomes</Card.Title>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Active Income (₹)</Form.Label>
                    <Form.Control
                      type="number"
                      value={activeIncome}
                      onChange={(e) => setActiveIncome(parseFloat(e.target.value) || 0)}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Passive Income (₹)</Form.Label>
                    <Form.Control
                      type="number"
                      value={passiveIncome}
                      onChange={(e) => setPassiveIncome(parseFloat(e.target.value) || 0)}
                    />
                  </Form.Group>
                  <Form.Text className="text-muted">
                    These amounts are saved automatically.
                  </Form.Text>
                </Form>
              </Card.Body>
            </Card>
          </Col>
          {totalEMI > 0 && (
            <Col md={6}>
              <Card>
                <Card.Body>
                  <Card.Title>Total Monthly EMI</Card.Title>
                  <Card.Text className="display-6">₹{totalEMI.toFixed(2)}</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>

        {/* Tabs */}
        <Tabs defaultActiveKey="transactions" id="main-tabs" className="mb-3">
          <Tab eventKey="transactions" title="Transactions">
            <Button 
              variant="primary" 
              onClick={() => { 
                setModalMode('add'); 
                resetForm(); 
                setEditingId(null);
                setShowModal(true); 
              }}
              className="mb-3"
            >
              + Add Transaction
            </Button>

            {/* Transactions as white cards */}
            <Row>
              {transactions.map(tx => (
                <Col md={6} lg={4} key={tx.id}>
                  <div className="transaction-card">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <span className="badge bg-secondary">{new Date(tx.date).toLocaleDateString()}</span>
                      </div>
                      <span className={`amount ${tx.category?.name.toLowerCase().includes('income') ? 'text-success' : 'text-danger'}`}>
                        ₹{tx.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="description mt-2">{tx.description}</div>
                    <div className="category">{tx.category?.name || 'Uncategorized'}</div>
                    <div className="actions">
                      <Button size="sm" variant="outline-primary" onClick={() => handleEdit(tx)}>Edit</Button>
                      <Button size="sm" variant="outline-danger" onClick={() => handleDelete(tx.id)} className="ms-2">Delete</Button>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Tab>

          <Tab eventKey="loans" title="Loans & EMIs">
            {/* Loan Form */}
            <Card className="mb-4">
              <Card.Body>
                <Card.Title>{editingLoanId ? 'Edit Loan' : 'Add New Loan/EMI'}</Card.Title>
                <Form onSubmit={handleLoanSubmit}>
                  <Row>
                    <Col md={3}>
                      <Form.Control
                        type="text"
                        placeholder="Loan Name"
                        value={loanForm.name}
                        onChange={e => setLoanForm({ ...loanForm, name: e.target.value })}
                        required
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Control
                        type="number"
                        placeholder="Monthly Amount"
                        value={loanForm.amount}
                        onChange={e => setLoanForm({ ...loanForm, amount: e.target.value })}
                        required
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Control
                        type="date"
                        value={loanForm.start_date}
                        onChange={e => setLoanForm({ ...loanForm, start_date: e.target.value })}
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Control
                        type="date"
                        placeholder="End Date"
                        value={loanForm.end_date}
                        onChange={e => setLoanForm({ ...loanForm, end_date: e.target.value })}
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Control
                        type="text"
                        placeholder="Description"
                        value={loanForm.description}
                        onChange={e => setLoanForm({ ...loanForm, description: e.target.value })}
                      />
                    </Col>
                    <Col md={1}>
                      <Button type="submit" variant="primary">
                        {editingLoanId ? 'Update' : 'Add'}
                      </Button>
                      {editingLoanId && (
                        <Button 
                          variant="secondary" 
                          onClick={() => { 
                            resetLoanForm(); 
                            setEditingLoanId(null); 
                          }}
                          className="mt-2"
                        >
                          Cancel
                        </Button>
                      )}
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>

            {/* Loan List */}
            <h4>Your Loans/EMIs</h4>
            {loans.length > 0 ? (
              <Row>
                {loans.map(loan => (
                  <Col md={6} key={loan.id} className="mb-3">
                    <Card>
                      <Card.Body>
                        <Card.Title>{loan.name}</Card.Title>
                        <Card.Subtitle className="mb-2 text-muted">₹{loan.amount}/month</Card.Subtitle>
                        <Card.Text>
                          Started: {new Date(loan.start_date).toLocaleDateString()}
                          {loan.end_date && ` • Ends: ${new Date(loan.end_date).toLocaleDateString()}`}
                          {loan.description && <br />}{loan.description}
                        </Card.Text>
                        <Button size="sm" variant="outline-primary" onClick={() => handleEditLoan(loan)}>Edit</Button>
                        <Button size="sm" variant="outline-danger" onClick={() => handleDeleteLoan(loan.id)} className="ms-2">Delete</Button>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <p>No loans or EMIs added yet.</p>
            )}
          </Tab>

          <Tab eventKey="analytics" title="Analytics">
            <Card>
              <Card.Body>
                <Card.Title>Spending Breakdown by Category</Card.Title>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={entry => `${entry.name}: ₹${entry.value.toFixed(2)}`}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₹${value.toFixed(2)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p>No expense data to display. Add some transactions or loans first!</p>
                )}
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>

        {/* Transaction Modal */}
        <Modal show={showModal} onHide={() => setShowModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>{modalMode === 'add' ? 'Add Transaction' : 'Edit Transaction'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Amount</Form.Label>
                <Form.Control
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  type="text"
                  value={form.description}
                  onChange={handleDescriptionChange}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Category</Form.Label>
                <Form.Select
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              {suggestedCat && (
                <p className="text-success">
                  Suggested: {suggestedCat.suggested_category_name} (auto-selected)
                </p>
              )}
              <Button variant="primary" type="submit">
                {modalMode === 'add' ? 'Add' : 'Update'}
              </Button>
            </Form>
          </Modal.Body>
        </Modal>
      </Container>
    </>
  );
}

export default App;
