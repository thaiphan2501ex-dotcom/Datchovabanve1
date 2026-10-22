import { useEffect, useState } from 'react';
import './App.css';

const initialEventForm = {
  title: '',
  description: '',
  status: 'DRAFT',
  bannerUrl: '',
};

function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const apiRequest = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  };

  const loadSession = async () => {
    try {
      const data = await apiRequest('/api/v1/auth/session');
      setUser(data.user);
      await loadEvents();
    } catch {
      setUser(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await apiRequest('/api/v1/events');
      setEvents(data.events || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password }
        : {
            fullName: authForm.fullName,
            email: authForm.email,
            phone: authForm.phone,
            password: authForm.password,
          };

      const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setUser(data.user);
      setAuthForm({ fullName: '', email: '', phone: '', password: '' });
      setMessage({ type: 'success', text: data.message || 'Success' });
      await loadEvents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
      setUser(null);
      setSelectedEvent(null);
      setEvents([]);
      setMessage({ type: 'success', text: 'Logged out successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleEventChange = (event) => {
    const { name, value } = event.target;
    setEventForm((current) => ({ ...current, [name]: value }));
  };

  const handleEventSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        title: eventForm.title,
        description: eventForm.description,
        status: eventForm.status,
        bannerUrl: eventForm.bannerUrl,
      };

      const endpoint = selectedEvent
        ? `/api/v1/events/${selectedEvent.event_id}`
        : '/api/v1/events';

      const method = selectedEvent ? 'PUT' : 'POST';

      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      setMessage({ type: 'success', text: data.message || 'Saved successfully' });
      setEventForm(initialEventForm);
      setSelectedEvent(null);
      await loadEvents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleEdit = (eventItem) => {
    setSelectedEvent(eventItem);
    setEventForm({
      title: eventItem.title,
      description: eventItem.description || '',
      status: eventItem.status || 'DRAFT',
      bannerUrl: eventItem.banner_url || '',
    });
  };

  const handleDelete = async (eventId) => {
    try {
      const data = await apiRequest(`/api/v1/events/${eventId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: data.message || 'Deleted successfully' });
      await loadEvents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleStatusPatch = async (eventId, newStatus) => {
    try {
      const data = await apiRequest(`/api/v1/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      setMessage({ type: 'success', text: data.message || 'Status updated' });
      await loadEvents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  if (loading) {
    return <div className="page-shell"><div className="loading">Loading...</div></div>;
  }

  if (!user) {
    return (
      <div className="page-shell auth-shell">
        <div className="auth-card">
          <div className="auth-header">
            <span className="badge">TicketPro</span>
            <h1>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h1>
          </div>

          <form onSubmit={handleAuthSubmit} className="form-grid">
            {authMode === 'register' && (
              <>
                <label>
                  Full name
                  <input name="fullName" value={authForm.fullName} onChange={handleAuthChange} placeholder="Jane Doe" required />
                </label>
                <label>
                  Phone
                  <input name="phone" value={authForm.phone} onChange={handleAuthChange} placeholder="+123456789" required />
                </label>
              </>
            )}

            <label>
              Email
              <input name="email" type="email" value={authForm.email} onChange={handleAuthChange} placeholder="user@example.com" required />
            </label>

            <label>
              Password
              <input name="password" type="password" value={authForm.password} onChange={handleAuthChange} placeholder="••••••••" required />
            </label>

            {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

            <button type="submit" className="primary-button">
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>

          <button type="button" className="secondary-button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Authenticated dashboard</p>
          <h1>TicketPro Events</h1>
        </div>
        <div className="user-panel">
          <span>{user.fullName}</span>
          <button type="button" className="secondary-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <main className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>{selectedEvent ? 'Edit event' : 'Create new event'}</h2>
          </div>

          <form onSubmit={handleEventSubmit} className="form-grid">
            <label>
              Event title
              <input name="title" value={eventForm.title} onChange={handleEventChange} placeholder="Spring festival" required />
            </label>

            <label>
              Banner URL
              <input name="bannerUrl" value={eventForm.bannerUrl} onChange={handleEventChange} placeholder="https://example.com/banner.jpg" />
            </label>

            <label>
              Status
              <select name="status" value={eventForm.status} onChange={handleEventChange}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>

            <label>
              Description
              <textarea name="description" value={eventForm.description} onChange={handleEventChange} rows="4" placeholder="Describe the event" />
            </label>

            <div className="button-row">
              <button type="submit" className="primary-button">
                {selectedEvent ? 'Update event' : 'Create event'}
              </button>
              {selectedEvent && (
                <button type="button" className="secondary-button" onClick={() => { setSelectedEvent(null); setEventForm(initialEventForm); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel events-panel">
          <div className="panel-header">
            <h2>Events</h2>
          </div>

          <div className="event-list">
            {events.length === 0 ? (
              <p className="empty-state">No events yet.</p>
            ) : (
              events.map((eventItem) => (
                <article key={eventItem.event_id} className="event-card">
                  <div className="event-banner" style={{ backgroundImage: eventItem.banner_url ? `url(${eventItem.banner_url})` : 'linear-gradient(135deg, #0f172a, #1d4ed8)' }} />
                  <div className="event-body">
                    <div className="event-meta">
                      <span className="status-pill">{eventItem.status}</span>
                      <span>{eventItem.organizer_name}</span>
                    </div>
                    <h3>{eventItem.title}</h3>
                    <p>{eventItem.description || 'No description provided.'}</p>
                    <div className="event-actions">
                      <button type="button" className="secondary-button" onClick={() => handleEdit(eventItem)}>Edit</button>
                      <button type="button" className="secondary-button" onClick={() => handleDelete(eventItem.event_id)}>Delete</button>
                      <button type="button" className="primary-button small" onClick={() => handleStatusPatch(eventItem.event_id, eventItem.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}>
                        {eventItem.status === 'PUBLISHED' ? 'Move to draft' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
